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
  /** Show a spinner in the trailing slot (e.g. a composition resolving). */
  loading?: boolean;
  onClick?: () => void;
};

/** A sidebar row — used for compositions and for top-level nav items. */
export function SidebarItem({
  active,
  icon,
  title,
  sub,
  badge,
  dot,
  loading,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors",
        active ? "bg-accent-soft text-ink-1" : "text-ink-2 hover:bg-bg-2 hover:text-ink-1",
      )}
    >
      {/* Active rail — sits flush to the row's left edge, no clipping. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      {icon && (
        <span
          className={cn(
            "grid size-7 flex-none place-items-center rounded-[7px] border transition-colors",
            active
              ? "border-accent-line bg-accent/15 text-accent-2"
              : "border-line bg-bg-2 text-ink-2 group-hover:border-line-2 group-hover:text-ink-1",
          )}
        >
          <Icon name={icon} size={15} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-tight">{title}</span>
        {sub && (
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px] leading-tight",
              active ? "text-ink-2" : "text-ink-3",
            )}
          >
            {sub}
          </span>
        )}
      </span>
      {loading ? (
        <Icon name="loader" size={14} className="spin flex-none text-ink-3" />
      ) : badge != null && badge > 0 ? (
        <span className="grid h-[18px] min-w-[18px] flex-none place-items-center rounded-full bg-accent px-1.5 font-mono text-[10.5px] font-bold text-white shadow-[0_0_8px_var(--color-accent-soft)]">
          {badge}
        </span>
      ) : (
        dot && (
          <span className="size-1.5 flex-none rounded-full bg-accent shadow-[0_0_7px_var(--color-accent-soft)]" />
        )
      )}
    </button>
  );
}

/** A leaf nav row (alias of SidebarItem, for semantics). */
export const NavItem = SidebarItem;
