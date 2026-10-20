import { type ReactNode, useEffect } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { Drawer } from "../primitives/drawer.js";

/**
 * Left rail container. Docked in a wide studio; in a medium one it can be
 * collapsed from the header; in a narrow one it's a drawer over the stage,
 * opened from the header and closed once you pick something.
 */
export function Sidebar({
  children,
  className,
  width,
}: {
  children: ReactNode;
  className?: string;
  width?: string;
}) {
  const store = useStudio();
  const band = useSignalValue(store.band);
  const open = useSignalValue(store.libraryOpen);
  const collapsed = useSignalValue(store.libraryCollapsed);
  useEffect(() => store.registerRegion("sidebar"), [store]);

  const w = width ?? "var(--spacing-sidebar)";
  if (band === "narrow") {
    return (
      <Drawer
        side="left"
        open={open}
        onClose={() => store.setLibraryOpen(false)}
        width={w}
        label="Library"
      >
        <aside className={cn("flex flex-col min-h-0 h-full", className)}>{children}</aside>
      </Drawer>
    );
  }
  if (band === "medium" && collapsed) return null;
  return (
    <aside
      className={cn("flex flex-col min-h-0 bg-bg-1 border-r border-line", className)}
      style={{ width: w, flex: `0 0 ${w}` }}
    >
      {children}
    </aside>
  );
}
