import { type AgentTabConnection, connectAgentTab, isHeadless } from "@smoove/agent/client";
import { useEffect } from "react";
import type { StudioStore } from "../store/store.js";
import { createAgentHandlers } from "./handlers.js";
import { buildMark } from "./mark.js";
import { watch } from "./until.js";

/**
 * Connect this tab to the dev server's agent bridge, if one is mounted (the
 * smoove Vite plugin mounts it in development). Without a bridge it makes one
 * request and stays quiet.
 */
export function useAgentBridge(store: StudioStore, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let disposed = false;
    let conn: AgentTabConnection | null = null;
    let stopWatch: (() => void) | null = null;
    // What this tab shows, as the server routes by it: nothing on a page
    // without an open composition (the home page).
    const showing = (): string | null =>
      store.composition.get() != null ? store.selectedId.get() : null;
    connectAgentTab({
      handlers: createAgentHandlers(store),
      composition: showing,
      onMark: (id) => store.onServerMark(id),
    })
      .then((c) => {
        if (disposed) {
          c?.close();
          return;
        }
        conn = c;
        if (!c) return;
        stopWatch = watch(showing, () => c.notify());
        // Nobody draws in a headless tab.
        if (!isHeadless()) {
          store.setMarkSink({
            async send(rect) {
              // Only a built, mounted composition with its fonts and media in:
              // a drag during a load or a hot reload marks nothing.
              const id = store.selectedId.get();
              const comp = store.composition.get();
              if (
                !comp ||
                store.mounted.get() !== comp ||
                store.loadStatus.get()[id] !== "ready" ||
                comp.buffer.get() === "buffering"
              ) {
                return null;
              }
              const { mark, png } = await buildMark(comp, id, rect);
              await c.sendMark(mark, png);
              return { id: mark.id, composition: id, frame: mark.frame, rect };
            },
            clear: (id) => c.clearMark(id),
          });
          const held = c.heldMark;
          if (held) {
            store.restoreMark({
              id: held.id,
              composition: held.composition,
              frame: held.frame,
              rect: held.rect,
            });
          }
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stopWatch?.();
      store.setMarkSink(null);
      conn?.close();
    };
  }, [store, enabled]);
}
