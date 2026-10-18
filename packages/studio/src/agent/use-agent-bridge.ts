import { type AgentTabConnection, connectAgentTab } from "@smoove/agent/client";
import { useEffect } from "react";
import type { StudioStore } from "../store/store.js";
import { createAgentHandlers } from "./handlers.js";

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
    connectAgentTab({ handlers: createAgentHandlers(store) })
      .then((c) => {
        if (disposed) c?.close();
        else conn = c;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      conn?.close();
    };
  }, [store, enabled]);
}
