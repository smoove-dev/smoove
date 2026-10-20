import type Konva from "konva";
import { contrastRatio, parseColor, type RGBA } from "../animation/color.js";
import { measure } from "../layout/measure.js";
import type { Box, Hit } from "./findings.js";
import type { SweepContext } from "./purity.js";

/** Text this faint is decoration (ghost type), not something to read. */
const MIN_OPACITY = 0.3;
/** The share of background pixels that decides: the worst tenth. */
const WORST_SHARE = 0.1;
/** Background pixels read per Text, at most. */
const MAX_PIXELS = 4096;

type ProbeText = {
  _kmProbeText(): { fontSize: number; fill: string | null; gradient: (number | string)[] | null };
};
const hasProbeText = (node: Konva.Node): node is Konva.Node & ProbeText =>
  typeof (node as Partial<ProbeText>)._kmProbeText === "function";

const hex = (c: { r: number; g: number; b: number }): string =>
  `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function tryParse(color: string): RGBA | null {
  try {
    return parseColor(color);
  } catch {
    return null;
  }
}

/** The text colors to judge: the fill, or every stop of a gradient fill. */
function textColors(p: ReturnType<ProbeText["_kmProbeText"]>): RGBA[] {
  if (p.gradient) {
    return p.gradient
      .filter((v): v is string => typeof v === "string")
      .map(tryParse)
      .filter((c): c is RGBA => c !== null && c.a > 0);
  }
  const c = p.fill ? tryParse(p.fill) : null;
  return c && c.a > 0 ? [c] : [];
}

/** Where the glyphs are: the union of the lines' ink, or the box. */
function inkBox(node: Konva.Node): Box {
  const m = measure(node);
  const inks = (m.lines ?? []).map((l) => l.ink);
  if (inks.length === 0) return { x: m.x, y: m.y, width: m.width, height: m.height };
  const x = Math.min(...inks.map((r) => r.x));
  const y = Math.min(...inks.map((r) => r.y));
  const right = Math.max(...inks.map((r) => r.x + r.width));
  const bottom = Math.max(...inks.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** A pixel channel has to move this much for the Text to count as painting it. */
const PAINT_DIFF = 8;

/**
 * The background under the pixels the Text actually paints: compare the frame
 * with the Text (`painted`, the whole canvas) against a capture without it,
 * inside `box`. A Text that a clip, a typewriter or a zero scale keeps from
 * painting gives no pixels. Transparent counts as black.
 */
function backgroundUnderGlyphs(
  painted: Uint8ClampedArray,
  without: HTMLCanvasElement,
  box: Box,
): RGBA[] {
  const W = without.width;
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.min(W, Math.ceil(box.x + box.width)) - x;
  const h = Math.min(without.height, Math.ceil(box.y + box.height)) - y;
  if (w <= 0 || h <= 0) return [];
  const ctx = without.getContext("2d");
  if (!ctx) return [];
  const bg = ctx.getImageData(x, y, w, h).data;
  const out: RGBA[] = [];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const o = (row * w + col) * 4;
      const p = ((y + row) * W + (x + col)) * 4;
      let diff = 0;
      for (let c = 0; c < 4; c++)
        diff = Math.max(diff, Math.abs((bg[o + c] ?? 0) - (painted[p + c] ?? 0)));
      if (diff <= PAINT_DIFF) continue;
      const a = (bg[o + 3] ?? 0) / 255;
      out.push({ r: (bg[o] ?? 0) * a, g: (bg[o + 1] ?? 0) * a, b: (bg[o + 2] ?? 0) * a, a: 1 });
    }
  }
  if (out.length <= MAX_PIXELS) return out;
  const step = out.length / MAX_PIXELS;
  return Array.from({ length: MAX_PIXELS }, (_, i) => out[Math.floor(i * step)] as RGBA);
}

const blend = (fg: RGBA, bg: RGBA, alpha: number): RGBA => ({
  r: fg.r * alpha + bg.r * (1 - alpha),
  g: fg.g * alpha + bg.g * (1 - alpha),
  b: fg.b * alpha + bg.b * (1 - alpha),
  a: 1,
});

/** The worst-tenth ratio of `color` over `pixels`, and the pixel it came from. */
function worst(color: RGBA, alpha: number, pixels: RGBA[]): { ratio: number; background: RGBA } {
  const scored = pixels
    .map((bg) => ({ ratio: contrastRatio(blend(color, bg, alpha), bg), background: bg }))
    .sort((a, b) => a.ratio - b.ratio);
  const pick = scored[Math.floor(WORST_SHARE * (scored.length - 1))] ?? scored[0];
  return pick ?? { ratio: 21, background: { r: 0, g: 0, b: 0, a: 1 } };
}

const distance = (a: RGBA, b: RGBA): number => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/** The palette color nearest `text` that passes `floor` on `background`, as hex. */
function suggest(text: RGBA, background: RGBA, floor: number, palette: string[]): string | null {
  let best: { color: RGBA; d: number } | null = null;
  for (const entry of palette) {
    const c = tryParse(entry);
    if (!c || c.a === 0) continue;
    if (contrastRatio(c, background) < floor) continue;
    const d = distance(c, text);
    if (!best || d < best.d) best = { color: c, d };
  }
  return best ? hex(best.color) : null;
}

/**
 * Contrast of every visible Text against what's really behind it, on the
 * contrast samples. Text under 48 times `u` needs 4.5 to 1, larger text 3 to
 * 1. `palette` is the declared palette, or the colors in use, for the
 * suggestion.
 */
export async function contrastSweep(ctx: SweepContext, palette: string[] | null): Promise<Hit[]> {
  const { comp } = ctx;
  const u = Math.min(comp.width(), comp.height()) / 1080;
  const hits: Hit[] = [];
  for (const frame of ctx.contrastSamples) {
    await comp.renderFrame(frame);
    const whole = comp.captureCanvas();
    const painted = whole.getContext("2d")?.getImageData(0, 0, whole.width, whole.height).data;
    if (!painted) continue;
    for (const node of ctx.nodes()) {
      if (!hasProbeText(node) || !node.isVisible()) continue;
      const opacity = node.getAbsoluteOpacity();
      if (opacity < MIN_OPACITY) continue;
      const probe = node._kmProbeText();
      const colors = textColors(probe);
      if (colors.length === 0) continue;
      const box = inkBox(node);
      if (!(box.width > 0 && box.height > 0)) continue;

      node.visible(false);
      let pixels: RGBA[];
      try {
        pixels = backgroundUnderGlyphs(painted, comp.captureCanvas(), box);
      } finally {
        node.visible(true);
      }
      if (pixels.length === 0) continue;

      const size = probe.fontSize * node.getAbsoluteScale().y;
      const floor = size >= 48 * u ? 3 : 4.5;
      let low: { ratio: number; background: RGBA; text: RGBA } | null = null;
      for (const c of colors) {
        const w = worst(c, c.a * opacity, pixels);
        if (!low || w.ratio < low.ratio) low = { ...w, text: c };
      }
      if (!low || low.ratio >= floor) continue;
      hits.push({
        node,
        code: "layout/contrast",
        frame,
        details: {
          text: hex(low.text),
          background: hex(low.background),
          ratio: Math.round(low.ratio * 100) / 100,
          floor,
          suggestion: palette ? suggest(low.text, low.background, floor, palette) : null,
        },
      });
    }
  }
  return hits;
}
