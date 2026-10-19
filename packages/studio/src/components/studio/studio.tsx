import { Toast } from "@base-ui/react/toast";
import { Tooltip } from "@base-ui/react/tooltip";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAgentBridge } from "../../agent/use-agent-bridge.js";
import { cn } from "../../lib/cn.js";
import { createStore, type StudioStore } from "../../store/store.js";
import type { Registry, RenderBackend } from "../../types.js";
import { PortalContainerContext } from "../primitives/portal-context.js";
import { StudioContext } from "./studio-context.js";

export type StudioProps = {
  registry: Registry;
  /** Injected render transport (the package ships none). */
  render?: RenderBackend;
  /** Active composition id, typically synced from the route param. */
  selectedId?: string;
  /** Called when a composition is selected, so a router can sync the URL. */
  onNavigate?: (id: string) => void;
  /**
   * Answer a coding agent through the dev server's agent bridge (status, seek
   * and snapshots). Only does anything when the smoove Vite plugin mounted the
   * bridge, which it does in development. Default `true`.
   */
  agent?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The compound root. Owns the central store + context, the Base UI Tooltip/Toast
 * providers, the `.smoove-studio` themed frame, and a studio-owned portal container
 * so Base UI popups inherit the scope + theme. Which regions appear is decided
 * purely by what you compose as children — there are no feature flags.
 */
export function StudioRoot({
  registry,
  render,
  selectedId,
  onNavigate,
  agent = true,
  className,
  children,
}: StudioProps) {
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Keep onNavigate fresh without rebuilding the store.
  const navRef = useRef(onNavigate);
  navRef.current = onNavigate;

  const storeRef = useRef<StudioStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createStore({
      registry,
      render,
      initialId: selectedId,
      onNavigate: (id) => navRef.current?.(id),
    });
  }
  const store = storeRef.current;
  useAgentBridge(store, agent);

  // The layout band comes from the studio's own size, so it follows the box a
  // host gives it, not the window. Remembered layout loads after mount, so the
  // server render and the first client render agree.
  useEffect(() => {
    store.restoreLayout();
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = (): void => store.setSize(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [store]);

  // Sync the active id from the route (selection itself happens in the route).
  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable.
  useEffect(() => {
    if (selectedId) store.syncSelected(selectedId);
  }, [selectedId]);

  return (
    <StudioContext.Provider value={store}>
      <Tooltip.Provider delay={400} closeDelay={80}>
        <Toast.Provider>
          <PortalContainerContext.Provider value={portalEl}>
            <div
              ref={rootRef}
              className={cn(
                "smoove-studio relative h-full w-full flex flex-col bg-bg-0 text-ink-1 font-sans select-none overflow-hidden",
                className,
              )}
            >
              {children}
              <div className="smoove-studio-portal" ref={setPortalEl} />
            </div>
          </PortalContainerContext.Provider>
        </Toast.Provider>
      </Tooltip.Provider>
    </StudioContext.Provider>
  );
}
