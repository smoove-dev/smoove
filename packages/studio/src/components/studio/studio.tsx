import { Toast } from "@base-ui/react/toast";
import { Tooltip } from "@base-ui/react/tooltip";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { type StudioStore, createStore } from "../../store/store.js";
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
  className?: string;
  children: ReactNode;
};

/**
 * The compound root. Owns the central store + context, the Base UI Tooltip/Toast
 * providers, the `.km-studio` themed frame, and a studio-owned portal container
 * so Base UI popups inherit the scope + theme. Which regions appear is decided
 * purely by what you compose as children — there are no feature flags.
 */
export function StudioRoot({
  registry,
  render,
  selectedId,
  onNavigate,
  className,
  children,
}: StudioProps) {
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);

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
              className={cn(
                "km-studio h-full w-full flex flex-col bg-bg-0 text-ink-1 font-sans select-none overflow-hidden",
                className,
              )}
            >
              {children}
              <div className="km-studio-portal" ref={setPortalEl} />
            </div>
          </PortalContainerContext.Provider>
        </Toast.Provider>
      </Tooltip.Provider>
    </StudioContext.Provider>
  );
}
