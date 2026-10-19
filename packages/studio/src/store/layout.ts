import { Signal } from "signal-polyfill";

/**
 * Which layout the studio uses, from its own width (not the window's, since a
 * host can embed it in a smaller box):
 * - `narrow`, under 640 px: one column; the library and the inspector are
 *   drawers over the stage.
 * - `medium`, 640 to 1099 px: the library stays docked but can collapse; the
 *   inspector is a drawer.
 * - `wide`, 1100 px and up: everything docked.
 */
export type LayoutBand = "narrow" | "medium" | "wide";

export const NARROW_BELOW = 640;
export const WIDE_FROM = 1100;

/** The layered timeline's default height, and the bounds a drag can set. */
export const TIMELINE_DEFAULT_H = 210;
export const TIMELINE_MIN_H = 72;
/** Unless the user drags it, the layered tracks take at most this share of the studio (the timeline header and transport come on top). */
export const TIMELINE_AUTO_SHARE = 0.25;
/** A drag can give the layered timeline at most this share of the studio. */
export const TIMELINE_MAX_SHARE = 0.6;

export function bandFor(width: number): LayoutBand {
  // Zero means "not measured yet" (server render, first paint): lay out wide,
  // as the studio always has.
  if (width <= 0 || width >= WIDE_FROM) return "wide";
  return width < NARROW_BELOW ? "narrow" : "medium";
}

const KEY_COLLAPSED = "smoove-studio:library-collapsed";
const KEY_TIMELINE_H = "smoove-studio:timeline-height";

/** Read a remembered value. Storage can be missing, blocked or throw. */
function load(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function save(key: string, value: string | null): void {
  try {
    if (value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // A convenience only; the studio works the same without it.
  }
}

/** The studio's size, its band, and the state of the parts that fold away. */
export function createLayoutState() {
  const size = new Signal.State<{ width: number; height: number }>({ width: 0, height: 0 });
  const band = new Signal.Computed<LayoutBand>(() => bandFor(size.get().width));

  /** The library drawer, in the narrow band. */
  const libraryOpen = new Signal.State<boolean>(false);
  /** The docked library, folded away in the medium band. Remembered. */
  const libraryCollapsed = new Signal.State<boolean>(false);
  /** The layered timeline's height after a drag, or null for the default. Remembered. */
  const timelineHeight = new Signal.State<number | null>(null);
  /** How many sidebars and panels are mounted, so the header knows to offer their buttons. */
  const sidebars = new Signal.State<number>(0);
  const panels = new Signal.State<number>(0);

  // Remembered values load after mount (see `restoreLayout`), never at
  // construction: a server render has no storage, and reading it during the
  // first client render would make hydration disagree.
  const restoreLayout = (): void => {
    libraryCollapsed.set(load(KEY_COLLAPSED) === "1");
    const h = Number(load(KEY_TIMELINE_H));
    timelineHeight.set(Number.isFinite(h) && h > 0 ? h : null);
  };

  const setSize = (width: number, height: number): void => {
    const cur = size.get();
    if (cur.width === width && cur.height === height) return;
    size.set({ width, height });
  };
  const setLibraryOpen = (open: boolean): void => libraryOpen.set(open);
  const setLibraryCollapsed = (collapsed: boolean): void => {
    libraryCollapsed.set(collapsed);
    save(KEY_COLLAPSED, collapsed ? "1" : null);
  };
  const setTimelineHeight = (h: number | null): void => {
    timelineHeight.set(h);
    save(KEY_TIMELINE_H, h == null ? null : String(Math.round(h)));
  };
  /** Count a mounted sidebar or panel; returns the matching unmount. */
  const registerRegion = (kind: "sidebar" | "panel"): (() => void) => {
    const sig = kind === "sidebar" ? sidebars : panels;
    sig.set(sig.get() + 1);
    return () => sig.set(sig.get() - 1);
  };

  /** The layered timeline's height in pixels, for the current studio height. */
  const timelineMaxHeight = new Signal.Computed<number>(() => {
    const studioH = size.get().height;
    const chosen = timelineHeight.get();
    if (studioH <= 0) return chosen ?? TIMELINE_DEFAULT_H;
    if (chosen != null) {
      return Math.max(TIMELINE_MIN_H, Math.min(chosen, studioH * TIMELINE_MAX_SHARE));
    }
    return Math.max(TIMELINE_MIN_H, Math.min(TIMELINE_DEFAULT_H, studioH * TIMELINE_AUTO_SHARE));
  });

  return {
    size,
    band,
    libraryOpen,
    libraryCollapsed,
    timelineHeight,
    timelineMaxHeight,
    sidebars,
    panels,
    restoreLayout,
    setSize,
    setLibraryOpen,
    setLibraryCollapsed,
    setTimelineHeight,
    registerRegion,
  };
}
