import Konva from "konva";

/** Konva.Text internals used for metric extraction (same pattern as text.ts). */
type KonvaTextMetricsSource = Konva.Text & {
  _getContextFont: () => string;
  measureSize: (s: string) => {
    width: number;
    fontBoundingBoxAscent?: number;
    fontBoundingBoxDescent?: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
  };
};

export type LineInk = {
  /** Ink extent left/right of the line's draw start point (both >= 0). */
  left: number;
  right: number;
  /** Ink extent above/below the alphabetic baseline. */
  ascent: number;
  descent: number;
};

let scratch: CanvasRenderingContext2D | null = null;
function scratchCtx(): CanvasRenderingContext2D {
  if (!scratch) {
    // Konva.Util.createCanvasElement is patched by the skia backend on the
    // server, so this is a browser canvas or a skia canvas as appropriate.
    scratch = Konva.Util.createCanvasElement().getContext("2d") as CanvasRenderingContext2D;
  }
  return scratch;
}

/**
 * The alphabetic baseline's y offset from the top of a line box. Mirrors
 * Konva 10.3 `Text._sceneFunc` (non-legacy): `(fontAscent − fontDescent) / 2
 * + lineH / 2`, with the font metrics of "M" (fontBoundingBox, falling back
 * to actualBoundingBox). Legacy rendering (middle baseline) and metric-less
 * environments fall back to `lineH / 2 + fontSize * 0.35` — approximate, and
 * paired with ink falling back to the line box.
 */
export function baselineOffset(text: Konva.Text, lineH: number): number {
  const src = text as KonvaTextMetricsSource;
  const legacy = (Konva as unknown as { legacyTextRendering?: boolean }).legacyTextRendering;
  if (!legacy) {
    const m = src.measureSize("M");
    const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    if (ascent !== undefined && descent !== undefined) {
      return (ascent - descent) / 2 + lineH / 2;
    }
  }
  return lineH / 2 + text.fontSize() * 0.35;
}

/**
 * Measure a rendered line's glyph ink relative to its draw start point and
 * baseline. Returns `null` when `actualBoundingBox` metrics are unavailable
 * (caller falls back to the line box).
 */
export function measureLineInk(text: Konva.Text, line: string): LineInk | null {
  if (!line) return null;
  const ctx = scratchCtx();
  ctx.font = (text as KonvaTextMetricsSource)._getContextFont();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const ls = text.letterSpacing() || 0;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
  }
  const m = ctx.measureText(line);
  if (
    m.actualBoundingBoxAscent === undefined ||
    m.actualBoundingBoxDescent === undefined ||
    m.actualBoundingBoxLeft === undefined ||
    m.actualBoundingBoxRight === undefined
  ) {
    return null;
  }
  return {
    left: m.actualBoundingBoxLeft,
    right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
  };
}
