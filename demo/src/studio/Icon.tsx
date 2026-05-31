/* Shared inline-SVG icon set for KmStudio. Ported from the design's icons.jsx. */
import type { CSSProperties, ReactNode } from "react";

const _p = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="7.5" cy="7.5" r="4.5" {..._p} />
      <path d="M11 11l3.5 3.5" {..._p} />
    </>
  ),
  chevron: <path d="M4 6.5l4 4 4-4" {..._p} />,
  chevronUp: <path d="M4 9.5l4-4 4 4" {..._p} />,
  play: <path d="M6 4.5l9 5.5-9 5.5z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="5" y="4" width="3.2" height="12" rx="1" />
      <rect x="11.8" y="4" width="3.2" height="12" rx="1" />
    </g>
  ),
  prev: (
    <g fill="currentColor" stroke="none">
      <path d="M14 5v10l-7-5z" />
      <rect x="4.5" y="5" width="2.2" height="10" rx="1" />
    </g>
  ),
  next: (
    <g fill="currentColor" stroke="none">
      <path d="M6 5v10l7-5z" />
      <rect x="13.3" y="5" width="2.2" height="10" rx="1" />
    </g>
  ),
  volume: (
    <>
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.2 7.2a3.6 3.6 0 010 5.6M15 5.4a6 6 0 010 9.2" {..._p} />
    </>
  ),
  mute: (
    <>
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.5 8l3 4M16.5 8l-3 4" {..._p} />
    </>
  ),
  loop: (
    <>
      <path d="M5 7h7a3 3 0 013 3M15 13H8a3 3 0 01-3-3" {..._p} />
      <path d="M13 5l2 2-2 2M7 15l-2-2 2-2" {..._p} />
    </>
  ),
  fullscreen: <path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3" {..._p} />,
  fullscreenExit: <path d="M7 4v3H4M13 4v3h3M7 16v-3H4M13 16v-3h3" {..._p} />,
  check: <path d="M4 8.5l3 3 6-6.5" {..._p} />,
  close: <path d="M5 5l8 8M13 5l-8 8" {..._p} />,
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="7" cy="5" r="1.3" />
      <circle cx="11" cy="5" r="1.3" />
      <circle cx="7" cy="9" r="1.3" />
      <circle cx="11" cy="9" r="1.3" />
      <circle cx="7" cy="13" r="1.3" />
      <circle cx="11" cy="13" r="1.3" />
    </g>
  ),
  plus: <path d="M9 4v10M4 9h10" {..._p} />,
  sliders: (
    <>
      <path d="M4 6h6M14 6h2M4 12h2M10 12h6" {..._p} />
      <circle cx="12" cy="6" r="2" {..._p} />
      <circle cx="8" cy="12" r="2" {..._p} />
    </>
  ),
  info: (
    <>
      <circle cx="9" cy="9" r="6.2" {..._p} />
      <path d="M9 8v4M9 5.6v.01" {..._p} />
    </>
  ),
  code: <path d="M7 6l-3 3 3 3M11 6l3 3-3 3" {..._p} />,
  panelRight: (
    <>
      <rect x="3" y="4" width="12" height="10" rx="1.6" {..._p} />
      <path d="M11 4v10" {..._p} />
    </>
  ),
  // subject icons
  text: <path d="M4 5h10M9 5v9M6.5 14h5" {..._p} />,
  layout: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" {..._p} />
      <path d="M3.5 7.5h11M8 7.5v7" {..._p} />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4" width="11" height="10" rx="1.5" {..._p} />
      <circle cx="7" cy="7.5" r="1.2" {..._p} />
      <path d="M4 13l3.5-3.5 3 2.5L13 9l1.5 1.3" {..._p} />
    </>
  ),
  media: (
    <>
      <circle cx="9" cy="9" r="6" {..._p} />
      <path d="M7.5 6.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  basic: (
    <>
      <circle cx="9" cy="9" r="6" {..._p} />
      <path d="M9 5.5v7M5.5 9h7" {..._p} />
    </>
  ),
  spark: (
    <path
      d="M9 3l1.6 4.4L15 9l-4.4 1.6L9 15l-1.6-4.4L3 9l4.4-1.6z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

export function Icon({
  name,
  size = 16,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      aria-hidden="true"
      style={{ display: "block", flex: "0 0 auto", ...style }}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
