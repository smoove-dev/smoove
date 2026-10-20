import {
  type ActiveComposition,
  AgentError,
  type CheckParams,
  type CheckResult,
  DEFAULT_SNAPSHOT_WIDTH,
  DEFAULT_TILE_WIDTH,
  FALLBACK_SHEET_FRAMES,
  type MaySwitch,
  type RenderParams,
  type RenderQueued,
  resolveAt,
  type SeekData,
  type SeekParams,
  SHEET_COLUMNS,
  type SheetParams,
  type SheetResult,
  type SheetTile,
  type SnapshotParams,
  type SnapshotResult,
  type StudioStatus,
  type TimelineData,
  type TimelineNode,
  type TimelineParams,
} from "@smoove/agent";
import {
  type HandlerContext,
  isHeadless,
  type JobProgress,
  type TabHandlers,
} from "@smoove/agent/client";
import { type Composition, isClip } from "@smoove/core";
import type Konva from "konva";
import { inferKind, sequencesOf, stripPrefix } from "../hooks/use-layers.js";
import { estMB } from "../lib/constants.js";
import type { StudioStore } from "../store/store.js";
import type { RenderRequest } from "../types.js";
import { beatsOf } from "./beats.js";
import { captureFrames, encodePng, scaleCanvas } from "./capture.js";
import { answerCheck } from "./check.js";
import { abortable, until, watch } from "./until.js";

/** The handlers a studio tab answers the bridge with. */
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

  /**
   * The composition a snapshot, sheet or timeline is about, open and ready.
   * Only a tab the server says nobody watches (`maySwitch`) switches to it;
   * a user's tab answers only for what it already shows.
   */
  async function open(
    params: { composition?: string } & MaySwitch,
    ctx: HandlerContext,
  ): Promise<{ id: string; comp: Composition; switched: boolean }> {
    if (params.composition != null && !known(params.composition)) {
      throw unknown(params.composition);
    }
    const selected = store.selectedId.get();
    let id = params.composition ?? (hasActive() ? selected : null);
    if (id == null) {
      const first = store.entries[0]?.id;
      if (!params.maySwitch || !first) {
        throw new AgentError(
          "not-active",
          'No composition is open in the studio tab. Name one: {"composition": "<id>"}.',
        );
      }
      id = first;
    }
    let switched = false;
    if (id !== selected || !hasActive()) {
      if (!params.maySwitch) {
        throw new AgentError(
          "not-active",
          `The studio tab shows "${selected}", not "${id}". Run the request again.`,
        );
      }
      // The same path a click in the library takes, so the URL follows.
      store.select(id);
      switched = true;
    }
    return { id, comp: await ready(id, ctx), switched };
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

  /**
   * A warning when the image left video out: only from a headless browser,
   * and only one that can't decode H.264 (some headless builds ship without
   * it; an installed Chrome usually has it).
   */
  async function videoWarnings(videos: Konva.Node[]): Promise<string[]> {
    if (videos.length === 0 || !isHeadless() || (await canDecodeH264())) return [];
    const named = videos.map((v) => v.name() || v.id()).filter((n) => n !== "");
    const unnamed = videos.length - named.length;
    const parts = [
      ...named,
      ...(unnamed > 0 ? [`${unnamed} unnamed video${unnamed === 1 ? "" : "s"}`] : []),
    ];
    return [
      `This image came from a headless browser that can't decode H.264 video, so these video nodes are empty in it: ${parts.join(", ")}. The layout around them is accurate. The user's studio tab draws them; ask the user to open this composition if the video itself matters.`,
    ];
  }

  // ---------------------------------------------------------------- beats

  function frameFor(
    comp: Composition,
    params: { frame?: number; at?: string },
    fallback: number,
  ): number {
    if (params.at) return resolveAt(params.at, beatsOf(comp).beats);
    return params.frame ?? fallback;
  }

  // ---------------------------------------------------------------- handlers

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
    const frame = frameFor(comp, params, params.frame);
    checkFrame(id, comp, frame);
    // Through the player, so it reports the seek like any other. Playback
    // carries on from the new frame if it was playing.
    const player = store.player.get();
    if (player?.composition === comp) player.seekTo(frame);
    else comp.setFrame(frame);
    return { composition: id, frame: comp.frame.get() };
  }

  async function snapshot(params: SnapshotParams, ctx: HandlerContext): Promise<SnapshotResult> {
    const { id, comp } = await open(params, ctx);
    // Nobody watches the headless tab, so its playhead means nothing: frame 0.
    const frame = frameFor(comp, params, params.maySwitch ? 0 : comp.frame.get());
    checkFrame(id, comp, frame);

    const compW = comp.width();
    const compH = comp.height();
    const width = Math.max(1, Math.min(params.width ?? DEFAULT_SNAPSHOT_WIDTH, compW));
    const height = Math.max(1, Math.round((width * compH) / compW));

    let scaled: HTMLCanvasElement | null = null;
    const videos = await captureFrames(comp, [frame], width / compW, (canvas) => {
      scaled = scaleCanvas(canvas, width, height);
    });
    if (!scaled) throw new Error("The snapshot drew nothing.");
    const warnings = await videoWarnings(videos);
    return {
      png: encodePng(scaled),
      composition: id,
      frame,
      width,
      height,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  async function sheet(params: SheetParams, ctx: HandlerContext): Promise<SheetResult> {
    const { id, comp } = await open(params, ctx);
    const total = comp.durationInFrames.get();

    let mode: "beats" | "even" = "even";
    let tiles: SheetTile[];
    if (params.frames != null) {
      tiles = evenFrames(total, params.frames);
    } else {
      const { beats } = beatsOf(comp);
      if (beats.length >= 2) {
        mode = "beats";
        tiles = beats.map((b) => ({ frame: b.sheet, beat: b.name }));
      } else {
        tiles = evenFrames(total, FALLBACK_SHEET_FRAMES);
      }
    }

    const compW = comp.width();
    const compH = comp.height();
    const tileW = Math.max(1, Math.min(params.width ?? DEFAULT_TILE_WIDTH, compW));
    const tileH = Math.max(1, Math.round((tileW * compH) / compW));
    const pad = 8;
    const labelH = Math.max(18, Math.round(tileW * 0.075));
    const cols = Math.min(SHEET_COLUMNS, tiles.length);
    const rows = Math.ceil(tiles.length / cols);
    const width = cols * tileW + (cols + 1) * pad;
    const height = rows * (tileH + labelH) + (rows + 1) * pad;

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const g = out.getContext("2d");
    if (!g) throw new Error("The browser couldn't create a 2D canvas for the sheet.");
    g.fillStyle = "#16161a";
    g.fillRect(0, 0, width, height);
    const fontPx = Math.round(labelH * 0.62);
    g.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    g.textBaseline = "middle";

    const videos = await captureFrames(
      comp,
      tiles.map((t) => t.frame),
      tileW / compW,
      (canvas, i) => {
        const tile = tiles[i] as SheetTile;
        const x = pad + (i % cols) * (tileW + pad);
        const y = pad + Math.floor(i / cols) * (tileH + labelH + pad);
        g.drawImage(scaleCanvas(canvas, tileW, tileH), x, y);
        const label = tile.beat ? `${tile.frame}  ${tile.beat}` : `frame ${tile.frame}`;
        g.fillStyle = "#e8e8ec";
        g.fillText(fit(g, label, tileW), x + 2, y + tileH + labelH / 2);
      },
    );
    const warnings = await videoWarnings(videos);
    return {
      png: encodePng(out),
      composition: id,
      mode,
      tileWidth: tileW,
      tileHeight: tileH,
      width,
      height,
      tiles,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  async function timeline(params: TimelineParams, ctx: HandlerContext): Promise<TimelineData> {
    const { id, comp } = await open(params, ctx);
    const { from, beats } = beatsOf(comp);
    const sequences: TimelineNode[] = sequencesOf(comp).map((s, i) => {
      const label = s.name() || s.id() || "";
      const end = s.from + s.durationInFrames;
      // A scene from a series has no name of its own; its beat does.
      const beat = beats.find((b) => b.start === s.from && b.end === end);
      return {
        name: stripPrefix(label) || beat?.name || `sequence ${i + 1}`,
        kind: inferKind(label),
        start: s.from,
        end: s.from + s.durationInFrames,
        children: clipsUnder(s),
      };
    });
    return {
      composition: id,
      width: comp.width(),
      height: comp.height(),
      fps: comp.fps,
      durationInFrames: comp.durationInFrames.get(),
      beatsFrom: from,
      beats,
      sequences,
    };
  }

  async function render(
    params: RenderParams,
    _ctx: HandlerContext,
    report: (progress: JobProgress) => void,
  ): Promise<RenderQueued> {
    const id = params.composition ?? (hasActive() ? store.selectedId.get() : null);
    if (id == null) {
      throw new AgentError(
        "not-active",
        'No composition is open in the studio tab. Name one: {"composition": "<id>"}.',
      );
    }
    if (!known(id)) throw unknown(id);
    // Rendering never changes what the tab shows: build the composition
    // without opening it if it isn't the open one.
    const open = store.selectedId.get() === id ? store.composition.get() : null;
    let comp: Composition;
    try {
      comp = open ?? (await store.registry.load(id));
    } catch (err) {
      throw new AgentError(
        "composition-error",
        `"${id}" failed to build: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const total = comp.durationInFrames.get();
    const format = params.format ?? "mp4";
    if (params.from != null && params.to != null && params.to > total - 1) {
      throw new AgentError(
        "frame-out-of-range",
        `Frame ${params.to} is outside "${id}". Its frames run from 0 to ${total - 1}.`,
      );
    }
    const frames = params.from != null && params.to != null ? params.to - params.from + 1 : total;
    const w = comp.width();
    const h = comp.height();
    const title = store.getEntry(id)?.title ?? id;
    const req: RenderRequest = {
      id,
      kind: "video",
      comp: title,
      props: store.getPropsSignal(id).get(),
      format,
      quality: "standard",
      w,
      h,
      fps: comp.fps,
      frames,
      ...(params.from != null && params.to != null ? { from: params.from, to: params.to } : {}),
      rangeLabel:
        params.from != null && params.to != null ? `Frames ${params.from} to ${params.to}` : "Full",
      sizeEst: estMB(w, h, frames, 0.16, format === "webm" ? 0.82 : 1),
    };
    const jobId = store.startRender(req);

    let last = "";
    const stop = watch(
      () => store.jobs.get().find((j) => j.jobId === jobId),
      (job) => {
        if (!job) return;
        const progress: JobProgress = {
          status: job.status,
          progress: job.progress,
          ...(job.result ? { result: job.result } : {}),
          ...(job.error ? { error: job.error } : {}),
        };
        const key = JSON.stringify(progress);
        if (key === last) return;
        last = key;
        report(progress);
        if (job.status === "done" || job.status === "error" || job.status === "canceled") {
          queueMicrotask(() => stop());
        }
      },
    );
    return { jobId, composition: id, format };
  }

  async function check(params: CheckParams, ctx: HandlerContext): Promise<CheckResult> {
    const { id, comp } = await open(params, ctx);
    return answerCheck(id, comp, store.entries, params);
  }

  return { status, seek, snapshot, sheet, timeline, render, check };
}

let h264: Promise<boolean> | null = null;

/** Can this browser decode H.264, the way the preview decodes video (WebCodecs)? */
function canDecodeH264(): Promise<boolean> {
  h264 ??= (async () => {
    try {
      if (typeof VideoDecoder === "undefined") return false;
      const { supported } = await VideoDecoder.isConfigSupported({ codec: "avc1.640028" });
      return supported === true;
    } catch {
      return false;
    }
  })();
  return h264;
}

/** `count` frames spread evenly from the first to the last, without repeats. */
function evenFrames(total: number, count: number): SheetTile[] {
  const last = Math.max(0, total - 1);
  const n = Math.max(1, Math.min(count, total));
  const frames = new Set<number>();
  for (let i = 0; i < n; i++) {
    frames.add(n === 1 ? 0 : Math.round((i * last) / (n - 1)));
  }
  return [...frames].map((frame) => ({ frame, beat: null }));
}

/** Clips nested under a timeline, each with its own clips, in absolute frames. */
function clipsUnder(node: Konva.Container): TimelineNode[] {
  const out: TimelineNode[] = [];
  for (const child of node.getChildren()) {
    if (isClip(child)) {
      const start = child._kmAbsoluteStart();
      out.push({
        name: child.name() || child.id() || "clip",
        kind: "clip",
        start,
        end: start + child.durationInFrames,
        children: clipsUnder(child),
      });
    } else if ("getChildren" in child && typeof child.getChildren === "function") {
      out.push(...clipsUnder(child as Konva.Container));
    }
  }
  return out;
}

/** Trim `text` with an ellipsis to fit `max` pixels. */
function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max - 4) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max - 4) t = t.slice(0, -1);
  return `${t}…`;
}
