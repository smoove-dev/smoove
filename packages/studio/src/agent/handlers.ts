import {
  type ActiveComposition,
  AgentError,
  DEFAULT_SNAPSHOT_WIDTH,
  type SeekData,
  type SeekParams,
  type SnapshotParams,
  type SnapshotResult,
  type StudioStatus,
} from "@smoove/agent";
import type { HandlerContext, TabHandlers } from "@smoove/agent/client";
import type { Composition } from "@smoove/core";
import type { StudioStore } from "../store/store.js";
import { encodePng, ensurePixelRatio, redrawVisible, scaleCanvas } from "./capture.js";
import { abortable, until } from "./until.js";

/** The status, seek and snapshot handlers a studio tab answers the bridge with. */
export function createAgentHandlers(store: StudioStore): TabHandlers {
  const known = (id: string): boolean => store.entries.some((e) => e.id === id);

  function unknown(id: string): AgentError {
    const ids = store.entries.map((e) => e.id).join(", ");
    return new AgentError(
      "unknown-composition",
      `There's no composition with id "${id}". The ids are: ${ids}.`,
    );
  }

  /** Is anything open? On a page with no stage (the home page), nothing is. */
  function hasActive(): boolean {
    const id = store.selectedId.get();
    return store.composition.get() != null || (store.loadStatus.get()[id] ?? "idle") !== "idle";
  }

  /**
   * Wait until `id` is the open composition, built, mounted in the Stage's
   * player, and done loading its fonts and media. Covers a selection that is
   * still loading and a hot reload that is rebuilding it.
   */
  async function ready(id: string, ctx: HandlerContext): Promise<Composition> {
    for (;;) {
      const comp = await until(() => {
        if (store.selectedId.get() !== id) {
          throw new AgentError(
            "not-active",
            `The studio switched to "${store.selectedId.get()}" while the request waited.`,
          );
        }
        const status = store.loadStatus.get()[id];
        if (status === "error") {
          throw new AgentError(
            "composition-error",
            `"${id}" failed to build: ${store.loadError.get() ?? "unknown error"}`,
          );
        }
        const c = store.composition.get();
        return status === "ready" && c && store.mounted.get() === c ? c : null;
      }, ctx.signal);
      await abortable(comp.whenReady(), ctx.signal);
      // A hot reload may have swapped the composition while assets loaded.
      if (store.composition.get() === comp && store.mounted.get() === comp) return comp;
    }
  }

  function checkFrame(id: string, comp: Composition, frame: number): void {
    const last = comp.durationInFrames.get() - 1;
    if (frame > last) {
      throw new AgentError(
        "frame-out-of-range",
        `Frame ${frame} is outside "${id}". Its frames run from 0 to ${last}.`,
      );
    }
  }

  function status(): StudioStatus {
    const catalog = store.entries.map((e) => ({
      id: e.id,
      title: e.title ?? null,
      group: e.group ?? null,
    }));
    if (!hasActive()) return { catalog, active: null };
    const id = store.selectedId.get();
    const comp = store.composition.get();
    const loadStatus = store.loadStatus.get()[id] ?? "idle";
    const active: ActiveComposition = {
      id,
      loadStatus,
      assets: comp?.buffer.get() === "buffering" ? "buffering" : "ready",
      error: loadStatus === "error" ? store.loadError.get() : null,
      width: comp ? comp.width() : null,
      height: comp ? comp.height() : null,
      fps: comp ? comp.fps : null,
      durationInFrames: comp ? comp.durationInFrames.get() : null,
      frame: comp ? comp.frame.get() : null,
      playing: comp ? comp.isPlaying.get() : false,
    };
    return { catalog, active };
  }

  async function seek(params: SeekParams, ctx: HandlerContext): Promise<SeekData> {
    const id = params.composition ?? store.selectedId.get();
    if (params.composition != null) {
      if (!known(id)) throw unknown(id);
      // The same path a click in the library takes, so the URL follows.
      store.select(id);
    } else if (!hasActive()) {
      throw new AgentError(
        "not-active",
        'No composition is open. Pass one: {"composition": "<id>", "frame": 0}.',
      );
    }
    const comp = await ready(id, ctx);
    checkFrame(id, comp, params.frame);
    // Through the player, so it reports the seek like any other. Playback
    // carries on from the new frame if it was playing.
    const player = store.player.get();
    if (player?.composition === comp) player.seekTo(params.frame);
    else comp.setFrame(params.frame);
    return { composition: id, frame: comp.frame.get() };
  }

  async function snapshot(params: SnapshotParams, ctx: HandlerContext): Promise<SnapshotResult> {
    const id = store.selectedId.get();
    if (params.composition != null && params.composition !== id) {
      if (!known(params.composition)) throw unknown(params.composition);
      throw new AgentError(
        "not-active",
        `Snapshots are of the open composition, "${id}". Seek to "${params.composition}" first: POST seek with {"composition": "${params.composition}", "frame": 0}.`,
      );
    }
    if (!hasActive()) {
      throw new AgentError(
        "not-active",
        'No composition is open. Seek to one first: POST seek with {"composition": "<id>", "frame": 0}.',
      );
    }
    const comp = await ready(id, ctx);
    const frame = params.frame ?? comp.frame.get();
    checkFrame(id, comp, frame);

    const compW = comp.width();
    const compH = comp.height();
    const width = Math.max(1, Math.min(params.width ?? DEFAULT_SNAPSHOT_WIDTH, compW));
    const height = Math.max(1, Math.round((width * compH) / compW));

    // Remember what the user sees, and hold playback still for the capture.
    const original = comp.frame.get();
    const wasPlaying = comp.isPlaying.get();
    if (wasPlaying) comp.pause();

    let scaled: HTMLCanvasElement;
    const restoreRatio = ensurePixelRatio(comp, width / compW);
    try {
      // Microtasks only when nothing gates the frame, so the browser gets no
      // chance to paint the target frame on screen.
      await comp.renderFrame(frame);
      scaled = scaleCanvas(comp.captureCanvas(), width, height);
    } finally {
      restoreRatio();
      comp.setFrame(original);
      redrawVisible(comp);
      if (wasPlaying) comp.play();
    }

    const png = encodePng(scaled);
    return { png, composition: id, frame, width, height };
  }

  return { status, seek, snapshot };
}
