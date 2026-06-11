import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/** Left rail container. */
export function Sidebar({
  children,
  className,
  width,
}: {
  children: ReactNode;
  className?: string;
  width?: string;
}) {
  const w = width ?? "var(--spacing-sidebar)";
  return (
    <aside
      className={cn("flex flex-col min-h-0 bg-bg-1 border-r border-line", className)}
      style={{ width: w, flex: `0 0 ${w}` }}
    >
      {children}
    </aside>
  );
}
