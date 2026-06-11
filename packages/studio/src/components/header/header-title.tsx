import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

/** Composition title block: icon + title + mono subtitle. */
export function HeaderTitle({ icon, title, sub }: { icon: IconName; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="size-8 flex-none rounded-ui grid place-items-center bg-bg-2 border border-line text-accent-2">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-bold tracking-tight text-ink-1 truncate leading-tight">
          {title}
        </div>
        {sub && <div className="text-[11px] text-ink-3 font-mono truncate mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
