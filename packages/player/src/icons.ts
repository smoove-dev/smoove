import { type TemplateResult, svg } from "lit";

/**
 * Inline-SVG icon set, ported from the demo studio's icon sheet. Each entry is
 * the inner markup of an 18×18 viewBox; {@link icon} wraps it in an `<svg>`.
 * No icon dependency — controls render `${icon("play")}` directly.
 */
const PATHS: Record<string, TemplateResult> = {
  play: svg`<path d="M6 4.5l9 5.5-9 5.5z" fill="currentColor" stroke="none" />`,
  pause: svg`<g fill="currentColor" stroke="none">
      <rect x="5" y="4" width="3.2" height="12" rx="1" />
      <rect x="11.8" y="4" width="3.2" height="12" rx="1" />
    </g>`,
  prev: svg`<g fill="currentColor" stroke="none">
      <path d="M14 5v10l-7-5z" />
      <rect x="4.5" y="5" width="2.2" height="10" rx="1" />
    </g>`,
  next: svg`<g fill="currentColor" stroke="none">
      <path d="M6 5v10l7-5z" />
      <rect x="13.3" y="5" width="2.2" height="10" rx="1" />
    </g>`,
  volume: svg`<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.2 7.2a3.6 3.6 0 010 5.6M15 5.4a6 6 0 010 9.2" />
    </g>`,
  mute: svg`<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.5 8l3 4M16.5 8l-3 4" />
    </g>`,
  loop: svg`<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 7h7a3 3 0 013 3M15 13H8a3 3 0 01-3-3" />
      <path d="M13 5l2 2-2 2M7 15l-2-2 2-2" />
    </g>`,
  fullscreen: svg`<path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />`,
  fullscreenExit: svg`<path d="M7 4v3H4M13 4v3h3M7 16v-3H4M13 16v-3h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />`,
};

/** Render a named icon as an `<svg>` of the given pixel size. */
export function icon(name: keyof typeof PATHS | string, size = 18): TemplateResult {
  return svg`<svg
    width=${size}
    height=${size}
    viewBox="0 0 18 18"
    aria-hidden="true"
    style="display:block;flex:0 0 auto"
  >${PATHS[name] ?? null}</svg>`;
}
