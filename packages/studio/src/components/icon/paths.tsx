import type { ReactNode } from "react";

const p = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Inline-SVG glyph set (viewBox 0 0 18 18). Ported from the SmooveStudio design. */
export const PATHS = {
  search: (
    <>
      <circle cx="7.5" cy="7.5" r="4.5" {...p} />
      <path d="M11 11l3.5 3.5" {...p} />
    </>
  ),
  chevron: <path d="M4 6.5l4 4 4-4" {...p} />,
  chevronRight: <path d="M6.5 4l4 4-4 4" {...p} />,
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
      <path d="M13.2 7.2a3.6 3.6 0 010 5.6M15 5.4a6 6 0 010 9.2" {...p} />
    </>
  ),
  mute: (
    <>
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.5 8l3 4M16.5 8l-3 4" {...p} />
    </>
  ),
  loop: (
    <>
      <path d="M4 8V7.5A2.5 2.5 0 016.5 5H12" {...p} />
      <path d="M10.5 3l2 2-2 2" {...p} />
      <path d="M14 10v.5A2.5 2.5 0 0111.5 13H6" {...p} />
      <path d="M7.5 15l-2-2 2-2" {...p} />
    </>
  ),
  fullscreen: <path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3" {...p} />,
  fullscreenExit: <path d="M7 4v3H4M13 4v3h3M7 16v-3H4M13 16v-3h3" {...p} />,
  check: <path d="M4 8.5l3 3 6-6.5" {...p} />,
  close: <path d="M5 5l8 8M13 5l-8 8" {...p} />,
  sliders: (
    <>
      <path d="M4 6h6M14 6h2M4 12h2M10 12h6" {...p} />
      <circle cx="12" cy="6" r="2" {...p} />
      <circle cx="8" cy="12" r="2" {...p} />
    </>
  ),
  info: (
    <>
      <circle cx="9" cy="9" r="6.2" {...p} />
      <path d="M9 8v4M9 5.6v.01" {...p} />
    </>
  ),
  code: <path d="M7 6l-3 3 3 3M11 6l3 3-3 3" {...p} />,
  panelRight: (
    <>
      <rect x="3" y="4" width="12" height="10" rx="1.6" {...p} />
      <path d="M11 4v10" {...p} />
    </>
  ),
  text: <path d="M4 5h10M9 5v9M6.5 14h5" {...p} />,
  layout: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" {...p} />
      <path d="M3.5 7.5h11M8 7.5v7" {...p} />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4" width="11" height="10" rx="1.5" {...p} />
      <circle cx="7" cy="7.5" r="1.2" {...p} />
      <path d="M4 13l3.5-3.5 3 2.5L13 9l1.5 1.3" {...p} />
    </>
  ),
  media: (
    <>
      <circle cx="9" cy="9" r="6" {...p} />
      <path d="M7.5 6.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  basic: (
    <>
      <circle cx="9" cy="9" r="6" {...p} />
      <path d="M9 5.5v7M5.5 9h7" {...p} />
    </>
  ),
  spark: (
    // smoove mark: play triangle + motion-afterimage trail. Native art is
    // 0 0 256 256; scale(18/256) fits it into the shared 18×18 icon viewBox.
    <g
      transform="scale(0.0703125)"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
    >
      <path d="M131 128 L67 80 Q85 128 67 176 Z" opacity="0.16" strokeWidth="2" />
      <path d="M149 128 L85 80 Q103 128 85 176 Z" opacity="0.30" strokeWidth="5" />
      <path d="M167 128 L103 80 Q121 128 103 176 Z" opacity="0.55" strokeWidth="9" />
      <path d="M185 128 L121 80 Q139 128 121 176 Z" opacity="1" strokeWidth="14" />
    </g>
  ),
  dots: (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="4.4" r="1.45" />
      <circle cx="9" cy="9" r="1.45" />
      <circle cx="9" cy="13.6" r="1.45" />
    </g>
  ),
  layers: (
    <>
      <path d="M9 3l6 3-6 3-6-3 6-3z" {...p} />
      <path d="M3 9l6 3 6-3M3 12l6 3 6-3" {...p} />
    </>
  ),
  progress: (
    <>
      <path d="M3 9h12" {...p} />
      <circle cx="11.5" cy="9" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M2 9s2.6-4.6 7-4.6S16 9 16 9s-2.6 4.6-7 4.6S2 9 2 9z" {...p} />
      <circle cx="9" cy="9" r="1.9" {...p} />
    </>
  ),
  eyeOff: (
    <>
      <path
        d="M2.2 9s2.6-4.6 6.8-4.6c1.2 0 2.3.4 3.2.9M16 9s-1 1.8-2.9 3M9 13.6c-4.4 0-6.8-4.6-6.8-4.6"
        {...p}
      />
      <path d="M3.4 3.4l11.2 11.2" {...p} />
    </>
  ),
  markIn: <path d="M10.5 4H6v10h4.5" {...p} />,
  markOut: <path d="M7.5 4H12v10H7.5" {...p} />,
  server: (
    <>
      <rect x="3" y="3.5" width="12" height="4.6" rx="1.3" {...p} />
      <rect x="3" y="9.9" width="12" height="4.6" rx="1.3" {...p} />
      <path d="M5.6 5.8h.01M5.6 12.2h.01" {...p} />
    </>
  ),
  camera: (
    <>
      <rect x="2.6" y="6" width="12.8" height="8.4" rx="1.8" {...p} />
      <circle cx="9" cy="10.2" r="2.5" {...p} />
      <path d="M6.6 6l1-1.6h2.8l1 1.6" {...p} />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4" width="12" height="10" rx="1.5" {...p} />
      <path d="M6.5 4v10M11.5 4v10M3 7.2h3.5M11.5 7.2H15M3 10.8h3.5M11.5 10.8H15" {...p} />
    </>
  ),
  download: (
    <>
      <path d="M9 3v8M5.6 7.6L9 11l3.4-3.4" {...p} />
      <path d="M3.6 13.6h10.8" {...p} />
    </>
  ),
  queue: <path d="M4 5h10M4 9h10M4 13h6" {...p} />,
  trash: <path d="M4 5.6h10M7.4 5.6V4.2h3.2v1.4M5.4 5.6l.7 8.8h5.8l.7-8.8" {...p} />,
  clock: (
    <>
      <circle cx="9" cy="9" r="6" {...p} />
      <path d="M9 5.4V9l2.6 1.6" {...p} />
    </>
  ),
  loader: <path d="M9 3a6 6 0 11-5.2 3" {...p} />,
  plus: <path d="M9 4v10M4 9h10" {...p} />,
  minus: <path d="M4 9h10" {...p} />,
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
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
