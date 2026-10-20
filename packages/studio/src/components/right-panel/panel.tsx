import { type ReactNode, useEffect } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { Drawer } from "../primitives/drawer.js";
import { PanelHandle } from "./panel-handle.js";
import { PanelTabs } from "./panel-tabs.js";

/**
 * Right inspector. In a wide studio it's docked and collapses to a handle;
 * narrower, it's a drawer over the stage, opened from the header, so it never
 * takes width from the frame. Defaults to the Props/Info tabs.
 */
export function Panel({
  children,
  width,
  className,
}: {
  children?: ReactNode;
  width?: string;
  className?: string;
}) {
  const store = useStudio();
  const open = useSignalValue(store.panelOpen);
  const band = useSignalValue(store.band);
  useEffect(() => store.registerRegion("panel"), [store]);

  const w = width ?? "var(--spacing-panel)";
  if (band !== "wide") {
    return (
      <Drawer
        side="right"
        open={open}
        onClose={() => store.setPanelOpen(false)}
        width={w}
        label="Inspector"
      >
        <div className={cn("flex flex-col min-h-0 h-full", className)}>
          {children ?? <PanelTabs />}
        </div>
      </Drawer>
    );
  }
  if (!open) return <PanelHandle />;
  return (
    <div
      className={cn("flex flex-col min-h-0 bg-bg-1 border-l border-line", className)}
      style={{ width: w, flex: `0 0 ${w}` }}
    >
      {children ?? <PanelTabs />}
    </div>
  );
}
