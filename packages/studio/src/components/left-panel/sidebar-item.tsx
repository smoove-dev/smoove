import { cn } from "../../lib/cn.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

export type SidebarItemProps = {
  active?: boolean;
  icon?: IconName;
  title: string;
  sub?: string;
  badge?: number;
  dot?: boolean;
  onClick?: () => void;
};

/** A sidebar row — used for compositions and for top-level nav items. */
export function SidebarItem({ active, icon, title, sub, badge, dot, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 w-full px-2.5 py-[7px] my-px rounded-control text-left text-[13px] font-medium transition-colors",
        active ? "bg-accent-soft text-white" : "text-ink-2 hover:bg-bg-2 hover:text-ink-1",
      )}
    >
      {active && (
        <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent" />
      )}
      {icon && (
        <span
          className={cn(
            "size-[26px] flex-none rounded-[6px] grid place-items-center border transition-colors",
            active
              ? "bg-accent/20 border-accent-line text-accent-2"
              : "bg-bg-2 border-line text-ink-2 group-hover:text-ink-1",
          )}
        >
          <Icon name={icon} size={15} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-snug">{title}</span>
        {sub && (
          <span
            className={cn(
              "block text-[10.5px] font-mono",
              active ? "text-accent-2/80" : "text-ink-3",
            )}
          >
            {sub}
          </span>
        )}
      </span>
      {badge != null && badge > 0 && (
        <span className="font-mono text-[10.5px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1.5 grid place-items-center shadow-[0_0_8px_var(--color-accent-soft)]">
          {badge}
        </span>
      )}
      {dot && (
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_7px_var(--color-accent-soft)] flex-none" />
      )}
    </button>
  );
}

/** A leaf nav row (alias of SidebarItem, for semantics). */
export const NavItem = SidebarItem;
