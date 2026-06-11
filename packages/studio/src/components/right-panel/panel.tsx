import type { ReactNode } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { PanelHandle } from "./panel-handle.js";
import { PanelTabs } from "./panel-tabs.js";

/** Right inspector. Collapses to a handle; defaults to the Props/Info tabs. */
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
  if (!open) return <PanelHandle />;
  const w = width ?? "var(--spacing-panel)";
  return (
    <div
      className={cn("flex flex-col min-h-0 bg-bg-1 border-l border-line", className)}
      style={{ width: w, flex: `0 0 ${w}` }}
    >
      {children ?? <PanelTabs />}
    </div>
  );
}
