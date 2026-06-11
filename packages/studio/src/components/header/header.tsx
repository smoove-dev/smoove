import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/** Top bar container. */
export function Header({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "flex items-center gap-3 px-4 h-14 flex-none bg-bg-1 border-b border-line",
        className,
      )}
    >
      {children}
    </header>
  );
}
