import { type ReactNode, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Icon } from "../icon/icon.js";

export type SidebarGroupProps = {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  /** When set, controls open state externally (e.g. force-open while searching). */
  forceOpen?: boolean;
  children: ReactNode;
};

/** Collapsible composition group — its rows are indented behind a guide rail. */
export function SidebarGroup({
  label,
  count,
  defaultOpen = true,
  forceOpen,
  children,
}: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen != null ? forceOpen : open;
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-1.5 rounded-control px-1.5 py-1.5 text-ink-3 transition-colors hover:text-ink-1"
      >
        <span className={cn("flex transition-transform duration-200", !isOpen && "-rotate-90")}>
          <Icon name="chevron" size={13} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[.07em]">{label}</span>
        {count != null && (
          <span className="ml-auto grid h-[17px] min-w-[17px] place-items-center rounded-full bg-bg-2 px-1.5 font-mono text-[10px] font-medium text-ink-3 transition-colors group-hover:text-ink-2">
            {count}
          </span>
        )}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative ml-1.5 pl-2">
            <span className="absolute bottom-0.5 left-0 top-0.5 w-px bg-line" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
