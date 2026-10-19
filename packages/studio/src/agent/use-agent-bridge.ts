import { type AgentTabConnection, connectAgentTab } from "@smoove/agent/client";
import { useEffect } from "react";
import type { StudioStore } from "../store/store.js";
import { createAgentHandlers } from "./handlers.js";
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
    connectAgentTab({ handlers: createAgentHandlers(store), composition: showing })
      .then((c) => {
        if (disposed) {
          c?.close();
          return;
        }
        conn = c;
        if (c) stopWatch = watch(showing, () => c.notify());
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stopWatch?.();
      conn?.close();
    };
  }, [store, enabled]);
}
