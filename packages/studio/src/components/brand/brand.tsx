import { type ReactNode, useId } from "react";

function BrandMark({ size = 24 }: { size?: number }) {
  const gradId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="35.5 31.5 57 57"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="40" y1="60" x2="84" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5640" />
          <stop offset="1" stopColor="#15CDA8" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradId})`} strokeWidth="9" strokeLinecap="round">
        <line x1="40" y1="38" x2="40" y2="82" />
        <line x1="52" y1="44" x2="52" y2="76" />
        <line x1="64" y1="50" x2="64" y2="70" />
        <line x1="76" y1="56" x2="76" y2="64" />
      </g>
      <circle cx="89" cy="60" r="3.5" fill="#FFC23C" />
    </svg>
  );
}

/** Sidebar header: logo + wordmark + version tag. */
export function Brand({
  name = (
    <>
      <b className="text-ink-1">Smoove</b>
      <span className="text-ink-3 font-semibold">Studio</span>
    </>
  ),
  tag = "v1.0",
  icon = <BrandMark size={16} />,
  onClick,
}: {
  name?: ReactNode;
  tag?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 h-14 flex-none px-4.5 border-b border-line">
      <button className="flex items-center gap-2.5 h-14 outline-0" type="button" onClick={onClick}>
        {icon}
        <div className="font-display text-[15px] font-bold tracking-tight">{name}</div>
      </button>
      {tag && (
        <div className="ml-auto text-[10px] font-semibold tracking-[.08em] text-ink-3 uppercase border border-line-2 rounded-[5px] px-1.5 py-0.5">
          {tag}
        </div>
      )}
    </div>
  );
}
