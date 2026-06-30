import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

// Default attrs for the line-art icon set (18×18 viewBox, rounded strokes).
function Line(props: IconProps & { children: React.ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------- brand ---------------- */
// Play triangle with a fading motion-afterimage trail — the smoove mark.
// Native 0 0 256 256 art; colored via currentColor (opacities give the trail).
export function BrandMark(props: IconProps) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" {...props}>
      <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
        <path d="M131 128 L67 80 Q85 128 67 176 Z" opacity="0.16" strokeWidth="2" />
        <path d="M149 128 L85 80 Q103 128 85 176 Z" opacity="0.30" strokeWidth="5" />
        <path d="M167 128 L103 80 Q121 128 103 176 Z" opacity="0.55" strokeWidth="9" />
        <path d="M185 128 L121 80 Q139 128 121 176 Z" opacity="1" strokeWidth="14" />
      </g>
    </svg>
  );
}

/* ---------------- chrome / ui ---------------- */
export const IconMenu = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 5h12M3 9h12M3 13h12" />
  </Line>
);
export const IconClose = (p: IconProps) => (
  <Line {...p}>
    <path d="M5 5l8 8M13 5l-8 8" />
  </Line>
);
export const IconSearch = (p: IconProps) => (
  <Line {...p}>
    <circle cx="7.5" cy="7.5" r="4.5" />
    <path d="M11 11l3.5 3.5" />
  </Line>
);
export const IconChevronRight = (p: IconProps) => (
  <Line {...p}>
    <path d="M6.5 4l4 4-4 4" />
  </Line>
);
export const IconArrowRight = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 9h10M10 5l4 4-4 4" />
  </Line>
);
export const IconChevronLeftSm = (p: IconProps) => (
  <Line {...p}>
    <path d="M11 4l-4 5 4 5" />
  </Line>
);
export const IconChevronRightSm = (p: IconProps) => (
  <Line {...p}>
    <path d="M7 4l4 5-4 5" />
  </Line>
);
export const IconExternal = (p: IconProps) => (
  <Line strokeWidth={1.6} {...p}>
    <path d="M7 4h7v7M14 4L4 14" />
  </Line>
);
export const IconEdit = (p: IconProps) => (
  <Line {...p}>
    <path d="M11.5 3.5l3 3L7 14l-3.5.5L4 11z" />
    <path d="M10.5 4.5l3 3" />
  </Line>
);
export const IconInfo = (p: IconProps) => (
  <Line {...p}>
    <circle cx="9" cy="9" r="6.2" />
    <path d="M9 6v3.6M9 11.8v.01" />
  </Line>
);

/* ---------------- theme ---------------- */
export const IconSun = (p: IconProps) => (
  <Line {...p}>
    <circle cx="9" cy="9" r="3.4" />
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" />
  </Line>
);
export const IconMoon = (p: IconProps) => (
  <Line {...p}>
    <path d="M14.5 10.2A5.8 5.8 0 017.8 3.5a5.8 5.8 0 102.9 11.2 5.8 5.8 0 003.8-4.5z" />
  </Line>
);

/* ---------------- social (24×24 filled) ---------------- */
export const IconGithub = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
export const IconDiscord = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);
export const IconNpm = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
  </svg>
);
export const IconX = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
export const IconStar = (p: IconProps) => (
  <svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M9 2l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 11.8 5.2 13.8l.7-4.3-3.1-3 4.3-.6z" />
  </svg>
);

/* ---------------- doc / nav topic icons ---------------- */
export const IconBook = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 4.5h6a2 2 0 012 2v8a2 2 0 00-2-2H3z" />
    <path d="M15 4.5H9a2 2 0 00-2 2v8a2 2 0 012-2h6z" />
  </Line>
);
export const IconCube = (p: IconProps) => (
  <Line {...p}>
    <path d="M9 2.5l5.5 3v7L9 15.5 3.5 12.5v-7z" />
    <path d="M3.7 5.6L9 8.5l5.3-2.9M9 8.5v7" />
  </Line>
);
export const IconBolt = (p: IconProps) => (
  <svg viewBox="0 0 18 18" aria-hidden="true" {...p}>
    <path d="M4 9l3.5-6 1 4.5H14l-3.5 6-1-4.5z" fill="currentColor" />
  </svg>
);
export const IconTimeline = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 9h12" />
    <path d="M6 6v6M10.5 7v4" />
  </Line>
);
export const IconWave = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 13c4-9 8-9 12 0" />
  </Line>
);
export const IconLayers = (p: IconProps) => (
  <Line {...p}>
    <path d="M9 3l6 3-6 3-6-3 6-3z" />
    <path d="M3 9l6 3 6-3M3 12l6 3 6-3" />
  </Line>
);
export const IconType = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 5h10M9 5v9M6.5 14h5" />
  </Line>
);
export const IconStage = (p: IconProps) => (
  <Line {...p}>
    <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" />
    <path d="M3.5 7.5h11M8 7.5v7" />
  </Line>
);
export const IconTransition = (p: IconProps) => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M3 9h12" />
    <circle cx="11.5" cy="9" r="2.2" fill="currentColor" stroke="none" />
  </svg>
);
export const IconCode = (p: IconProps) => (
  <Line {...p}>
    <path d="M7 6l-3 3 3 3M11 6l3 3-3 3" />
  </Line>
);
export const IconClock = (p: IconProps) => (
  <Line {...p}>
    <circle cx="9" cy="9" r="6" />
    <path d="M9 5.4V9l2.6 1.6" />
  </Line>
);

// Frontmatter `icon:` key -> component. Falls back to a book icon.
const DOC_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  book: IconBook,
  cube: IconCube,
  bolt: IconBolt,
  timeline: IconTimeline,
  wave: IconWave,
  layers: IconLayers,
  type: IconType,
  stage: IconStage,
  transition: IconTransition,
  code: IconCode,
  clock: IconClock,
  github: IconGithub,
  discord: IconDiscord,
};

export function DocIcon({ name, ...rest }: IconProps & { name?: string }) {
  const Cmp = (name && DOC_ICONS[name]) || IconBook;
  return <Cmp {...rest} />;
}
