import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

/** The gradient mark. */
export function Logo({ icon = "spark", onClick }: { icon?: IconName; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-[22px] rounded-[6px] grid place-items-center bg-gradient-to-br from-accent-2 to-accent shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset,0_2px_10px_var(--color-accent-soft)] outline-none"
    >
      <Icon name={icon} size={13} style={{ color: "#fff" }} />
    </button>
  );
}

/** Sidebar header: logo + wordmark + version tag. */
export function Brand({
  name = "SmooveStudio",
  tag = "v1.0",
  icon = "spark",
  onClick,
}: {
  name?: string;
  tag?: string;
  icon?: IconName;
  onClick?: () => void;
}) {
  const m = /^([A-Z][a-z]*)(.*)$/.exec(name);
  const [head, tail] = m ? [m[1], m[2]] : [name, ""];
  return (
    <div className="flex items-center gap-2.5 h-14 flex-none px-4.5 border-b border-line">
      <Logo icon={icon} onClick={onClick} />
      <div className="font-display text-[15px] font-bold tracking-tight">
        <b className="text-ink-1">{head}</b>
        <span className="text-ink-3 font-semibold">{tail}</span>
      </div>
      {tag && (
        <div className="ml-auto text-[10px] font-semibold tracking-[.08em] text-ink-3 uppercase border border-line-2 rounded-[5px] px-1.5 py-0.5">
          {tag}
        </div>
      )}
    </div>
  );
}
