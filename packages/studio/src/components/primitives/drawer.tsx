import { type ReactNode, useEffect } from "react";
import { cn } from "../../lib/cn.js";

/**
 * A panel that slides over the studio from one side, with a dimmed backdrop.
 * Clicking the backdrop or pressing Escape closes it. Positioned against the
 * studio root, so it stays inside the box a host gives the studio.
 */
export function Drawer({
  side,
  open,
  onClose,
  width,
  label,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  /** CSS width; capped so a sliver of the stage always shows beside it. */
  width: string;
  /** Accessible name for the drawer. */
  label: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex"
      style={{ justifyContent: side === "left" ? "flex-start" : "flex-end" }}
    >
      <button
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
        className="drawer-backdrop absolute inset-0 bg-black/55 cursor-default"
      />
      <div
        role="dialog"
        aria-label={label}
        className={cn(
          "relative flex flex-col min-h-0 h-full bg-bg-1 shadow-[0_0_40px_rgba(0,0,0,.5)]",
          side === "left"
            ? "drawer-left border-r border-line"
            : "drawer-right border-l border-line",
        )}
        style={{ width: `min(${width}, calc(100% - 48px))` }}
      >
        {children}
      </div>
    </div>
  );
}
