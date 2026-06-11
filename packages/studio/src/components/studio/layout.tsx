import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/** The horizontal band between header and footer that holds sidebar/stage/panel. */
export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 min-h-0 flex", className)}>{children}</div>;
}

/** The center column (header + stage + timeline, or the queue). */
export function Main({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 min-w-0 flex flex-col bg-bg-0", className)}>{children}</div>;
}

/** A small padded section, e.g. wrapping a top-level nav item in the sidebar. */
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-2 pt-2", className)}>{children}</div>;
}

/** A flexible gap that pushes following content to the end. */
export const Spacer = () => <div className="flex-1" />;
