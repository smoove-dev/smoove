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

/** Collapsible composition group — closed by default. */
export function SidebarGroup({
  label,
  count,
  defaultOpen = false,
  forceOpen,
  children,
}: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen != null ? forceOpen : open;
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-2 py-[7px] rounded-control text-ink-2 hover:bg-bg-2 hover:text-ink-1 text-[11px] font-bold tracking-[.06em] uppercase"
      >
        <span className={cn("flex text-ink-3 transition-transform", !isOpen && "-rotate-90")}>
          <Icon name="chevron" size={14} />
        </span>
        {label}
        {count != null && (
          <span className="ml-auto text-[10.5px] text-ink-3 font-semibold normal-case tracking-normal">
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
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
