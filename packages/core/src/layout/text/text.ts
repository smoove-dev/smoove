import Konva from "konva";
import { stringToArray } from "konva/lib/shapes/Text.js";
import { drawNodeWithEffects, initNodeEffects } from "../../effects/apply.js";
import type { KMEffect } from "../../effects/contract.js";
import { TICK_MARK } from "../../media/media-marker.js";
import type { KMLayoutNode, LayoutBox, MeasureContext } from "../contract.js";
import { applySize, type FlexilyNode, parseSize, setTextWrapperMeasure } from "../flex/engine.js";
import type { SizeValue } from "../flex/types.js";
import { Font, type FontFaceRef } from "./font.js";
import {
  buildWordIndex,
  clamp,
  type Geometry,
  type LineRange,
  pickKonvaConfig,
  snapToWord,
} from "./geometry.js";
import type {
  FitConfig,
  HighlightConfig,
  TextAlign,
  TextConfig,
  TypewriterConfig,
} from "./types.js";

const ELLIPSIS = "…";
const BIG = 1e9;

/**
 * Build Konva's `fontStyle` string from a resolved face's weight + style. Konva
 * folds both into one canvas-font token, e.g. `"italic 700"`. `400`/`normal`
 * collapse to `"normal"`.
 */
function konvaFontStyle(weight: string, style: string): string {
  const parts: string[] = [];
  if (style !== "normal") parts.push(style);
  if (weight !== "400") parts.push(weight);
  return parts.length > 0 ? parts.join(" ") : "normal";
}

/** Konva.Text internals we rely on for measurement (same pattern as flex-engine). */
type KonvaTextInternal = Konva.Text & {
  _setTextData: () => void;
  _getTextWidth: (s: string) => number;
  textArr: { text: string; width: number; lastInParagraph: boolean }[];
};

/**
 * Timeline-aware text node. Wraps a {@link Konva.Text} and layers on CSS-like
 * fitting (maxWidth/maxHeight/fitText/maxLines, ellipsis + word/letter trim), a
 * built-in typewriter reveal, and per-range highlighter marks. Like the other
 * layout primitives it `extends Konva.Group`, exposing intrinsic text size to
 * the flex engine via {@link _measureForFlex}.
 */
export class Text extends Konva.Group implements KMLayoutNode {
  readonly _kmRole = "leaf" as const;
  private readonly _text: KonvaTextInternal;
  /** Clipping wrapper around `_text` — reveals a char range without re-wrapping. */
  private readonly _textClip: Konva.Group;
  private readonly _hl: Konva.Group;
  private readonly _hlText: Konva.Group;
  private readonly _fade: Konva.Group;
  private _cursor: Konva.Rect | null = null;

  private _fullText: string;
  private _fullChars: string[];
  /** char index marking the end of each word (== start of the next), for word-mode reveal. */
  private _wordEnds: number[];
  /** word index each char belongs to, for word-mode timing. */
  private _charWord: number[];

  private _resolvedFontSize: number;
  private _localFrame = 0;
  private _geo: Geometry | null = null;
  private _inLayout = false;

  constructor(config: TextConfig) {
    super(pickKonvaConfig(config));

    this._fullText = config.text ?? "";
    this._fullChars = stringToArray(this._fullText);
    const { wordEnds, charWord } = buildWordIndex(this._fullChars);
    this._wordEnds = wordEnds;
    this._charWord = charWord;

    this._hl = new Konva.Group({ listening: false });
    this._hlText = new Konva.Group({ listening: false });
    this._fade = new Konva.Group({ listening: false });
    this._textClip = new Konva.Group({ listening: false });
    // A declarative `font` overrides fontFamily/fontStyle (weight + style live in
    // Konva's fontStyle string). A bare Font uses its preferred face.
    const fontRef: FontFaceRef | null = config.font
      ? config.font instanceof Font
        ? config.font.face()
        : config.font
      : null;
    this._text = new Konva.Text({
      text: this._fullText,
      fontSize: config.fontSize,
      fontFamily: fontRef ? fontRef.family : config.fontFamily,
      fontStyle: fontRef ? konvaFontStyle(fontRef.weight, fontRef.style) : config.fontStyle,
      fill: config.fill,
      align: config.align,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      padding: config.padding,
      wrap: config.wrap ?? "word",
      listening: false,
    }) as KonvaTextInternal;
    this._textClip.add(this._text);
    // Highlights behind, then glyphs (clipped for reveal), then colored-run
    // overlay + fade overlay on top.
    super.add(this._hl);
    super.add(this._textClip);
    super.add(this._hlText);
    super.add(this._fade);

    this.setAttrs({
      flexGrow: config.flexGrow,
      flexShrink: config.flexShrink,
      flexBasis: config.flexBasis,
      alignSelf: config.alignSelf,
      margin: config.margin,
      flexWidth: config.width,
      flexHeight: config.height,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      maxLines: config.maxLines,
      trimBy: config.trimBy ?? "word",
      ellipsis: config.ellipsis,
      fitText: config.fitText,
      typewriter: config.typewriter,
      highlights: config.highlights,
    });

    this._resolvedFontSize = this._text.fontSize();

    if (config.typewriter) this.setAttr(TICK_MARK, true);

    this.on("widthChange heightChange", () => {
      if (!this._inLayout) this._layoutText();
    });
    this._layoutText();

    // The font may not be loaded yet — Konva would have measured with a fallback
    // face. Re-layout + redraw once it lands (same shape as Image's load hook).
    if (fontRef && !fontRef.isLoaded) {
      fontRef.whenReady().then(() => {
        this._layoutText();
        this.getLayer()?.batchDraw();
      });
    }

    initNodeEffects(this);
  }

  effects(): KMEffect[];
  effects(list: KMEffect[]): this;
  effects(list?: KMEffect[]): KMEffect[] | this {
    if (list === undefined) return (this.getAttr("effects") as KMEffect[] | undefined) ?? [];
    this.setAttr("effects", list);
    return this;
  }

  override drawScene(...args: Parameters<Konva.Group["drawScene"]>): this {
    if (drawNodeWithEffects(this, args[0])) return this;
    super.drawScene(...args);
    return this;
  }

  /** Replace the text content. Re-runs fit + clamp + layout. */
  setText(text: string): this {
    this._fullText = text;
    this._fullChars = stringToArray(text);
    const { wordEnds, charWord } = buildWordIndex(this._fullChars);
    this._wordEnds = wordEnds;
    this._charWord = charWord;
    this._layoutText();
    return this;
  }

  // ----- flex integration -------------------------------------------------

  /** @internal — {@link KMLayoutNode}: wrap-aware sizing + intrinsic measure. */
  _kmMeasure(node: FlexilyNode, ctx: MeasureContext): void {
    if (
      this.attrs.flexWidth === undefined &&
      this.attrs.maxWidth === undefined &&
      ctx.parentIsColumn
    ) {
      node.setWidthPercent(100);
    } else {
      applySize(node, this.attrs.flexWidth as SizeValue | undefined, undefined);
    }
    setTextWrapperMeasure(node, this, ctx.parentIsColumn);
  }

  /** @internal — {@link KMLayoutNode}: write the computed box back + re-layout glyphs. */
  _kmPlace(box: LayoutBox): void {
    this.x(box.left);
    this.y(box.top);
    this.width(box.width);
    this.height(box.height);
    this._layoutText();
  }

  /**
   * @internal Intrinsic size for the flex engine. Lays out the FULL text at the
   * given available width (honoring fitText / maxWidth / maxHeight / maxLines).
   * Height is the full text height when reserving, else the height of just the
   * lines revealed so far — so a `reserveHeight: false` typewriter grows the box
   * one line at a time and pushes siblings down.
   */
  _measureForFlex(avail: number): { width: number; height: number } {
    const boxW = this._boxWidth(Number.isFinite(avail) && avail > 0 ? avail : BIG);
    const boxH = this._boxHeight();
    const savedText = this._text.text();
    this._text.text(this._fullText);
    this._applyFit(boxW, boxH);
    this._clamp(boxW, boxH);
    const m = this._measure(boxW === BIG ? BIG : boxW);
    const pad = this._text.padding() ?? 0;
    const width = Math.min(m.longest + pad * 2, boxW);

    const tw = this.attrs.typewriter as TypewriterConfig | undefined;
    const reserve = tw ? (tw.reserveHeight ?? true) : true;
    let height = m.height;
    if (!reserve) {
      this._text.width(boxW === BIG ? width : boxW);
      this._geo = this._buildGeometry();
      height = this._visibleLines(this._revealCount(this._localFrame)) * this._geo.lineH + pad * 2;
    }
    this._text.text(savedText);
    return { width, height };
  }

  /** @internal Re-layout glyphs, highlights, cursor and fade for the current frame. */
  _layoutText(): void {
    if (this._inLayout) return;
    this._inLayout = true;
    try {
      this._relayout();
    } finally {
      this._inLayout = false;
    }
  }

  private _relayout(): void {
    const boxW = this._boxWidth(this.width() > 0 ? this.width() : BIG);
    const boxH = this._boxHeight();

    // Always lay out the FULL text so line breaks are fixed: a typewriter then
    // reveals a char range by CLIPPING, so a word never re-wraps to a new line
    // as its later letters are typed.
    this._text.text(this._fullText);
    this._applyFit(boxW, boxH);
    this._clamp(boxW, boxH);

    const m = this._measure(boxW === BIG ? BIG : boxW);
    const pad = this._text.padding() ?? 0;
    const finalW = boxW === BIG ? m.longest + pad * 2 : boxW;
    this._text.width(finalW);
    this._text.position({ x: 0, y: 0 });

    // Recompute the geometry of the full text for overlays + reveal clipping.
    this._geo = this._buildGeometry();

    const reveal = this._revealCount(this._localFrame);
    const tw = this.attrs.typewriter as TypewriterConfig | undefined;
    const reserve = tw ? (tw.reserveHeight ?? true) : true;
    // When not reserving, the box grows one whole line at a time (never mid-word).
    const ownH = reserve ? m.height : this._visibleLines(reveal) * this._geo.lineH + pad * 2;

    if (this.attrs.flexWidth === undefined && this.attrs.maxWidth === undefined) {
      this.width(finalW);
    }
    if (this.attrs.flexHeight === undefined) this.height(ownH);

    this._layoutHighlights();
    this._layoutReveal(reveal);
    this._layoutCursor(reveal);
  }

  /** Number of wrapped lines that contain at least one revealed char. */
  private _visibleLines(reveal: number): number {
    const geo = this._geo;
    if (!geo) return 1;
    let vis = 0;
    geo.ranges.forEach((r, li) => {
      if (r.start < reveal) vis = li + 1;
    });
    return Math.max(1, vis);
  }

  /** Set the reveal clip on `_textClip` (covers char range [0, end), null = all). */
  private _setReveal(end: number | null): void {
    if (end === null) {
      this._textClip.clipFunc(undefined as unknown as (ctx: CanvasRenderingContext2D) => void);
      return;
    }
    const geo = this._geo;
    if (!geo) return;
    this._textClip.clipFunc((ctx: CanvasRenderingContext2D) => {
      for (const s of this._segmentRects(geo, 0, end)) {
        ctx.rect(s.x, geo.pad + s.li * geo.lineH, s.w, geo.lineH);
      }
    });
  }

  // ----- typewriter -------------------------------------------------------

  /** @internal Called by Sequence each frame. */
  _kmTick(localFrame: number): void {
    this._localFrame = localFrame;
    this._layoutText();
  }

  /** @internal Called by Sequence when the sequence leaves range. */
  _kmDeactivate(): void {
    // No teardown needed — reveal is a pure function of the frame, so the next
    // activation re-derives state. Reset to frame 0 for a clean replay.
    this._localFrame = 0;
  }

  /** How many chars are revealed at `frame` (full length when no typewriter). */
  private _revealCount(frame: number): number {
    const tw = this.attrs.typewriter as TypewriterConfig | undefined;
    if (!tw) return this._fullChars.length;
    // Reveal starts at `startFrame` (lets one Sequence stagger many typewriters).
    const f = frame - (tw.startFrame ?? 0);
    if (f < 0) return 0;
    const word = tw.mode === "word";
    const unitCount = word ? this._wordEnds.length : this._fullChars.length;
    if (unitCount === 0) return 0;
    let units: number;
    if (tw.durationInFrames && tw.durationInFrames > 0) {
      const p = clamp(f / tw.durationInFrames, 0, 1);
      units = Math.round(p * unitCount);
    } else {
      const perStep = tw.step ?? 1;
      units = Math.floor((f + 1) * perStep);
    }
    units = clamp(units, 0, unitCount);
    if (!word) return units;
    return units <= 0 ? 0 : (this._wordEnds[units - 1] ?? this._fullChars.length);
  }

  /** Frame at which the unit owning char `k` first appears (for fade ramps). */
  private _unitRevealFrame(k: number): number {
    const tw = this.attrs.typewriter as TypewriterConfig;
    const word = tw.mode === "word";
    const unitIndex = word ? (this._charWord[k] ?? 0) : k;
    const unitCount = word ? this._wordEnds.length : this._fullChars.length;
    const start = tw.startFrame ?? 0;
    if (tw.durationInFrames && tw.durationInFrames > 0) {
      return start + (unitIndex / Math.max(1, unitCount)) * tw.durationInFrames;
    }
    const perStep = tw.step ?? 1;
    return start + (unitIndex + 1) / perStep - 1;
  }

  // ----- fitting / clamping ----------------------------------------------

  private _boxWidth(fallback: number): number {
    const explicit = parseSize(this.attrs.flexWidth as SizeValue | undefined);
    if (explicit?.kind === "px") return explicit.value;
    const maxW = this.attrs.maxWidth as number | undefined;
    if (typeof maxW === "number") return maxW;
    return fallback;
  }

  private _boxHeight(): number {
    const explicit = parseSize(this.attrs.flexHeight as SizeValue | undefined);
    if (explicit?.kind === "px") return explicit.value;
    const maxH = this.attrs.maxHeight as number | undefined;
    if (typeof maxH === "number") return maxH;
    return BIG;
  }

  /** Binary-search the largest font size in [min,max] for which the FULL text fits. */
  private _applyFit(boxW: number, boxH: number): void {
    const fit = this.attrs.fitText as FitConfig | undefined;
    if (!fit) {
      this._resolvedFontSize = this._text.fontSize();
      return;
    }
    const saved = this._text.text();
    this._text.text(this._fullText);
    const lineHeight = this._text.lineHeight();
    const pad = this._text.padding() ?? 0;
    const maxLines = this.attrs.maxLines as number | undefined;
    const step = fit.step ?? 0.5;
    const noWrap = (this.attrs.wrap ?? this._text.wrap()) === "none";

    const fits = (fs: number): boolean => {
      this._text.fontSize(fs);
      // For wrap:"none" measure the NATURAL line width (unconstrained) — measuring
      // at boxW makes Konva truncate the line, hiding the overflow from the search.
      const m = this._measure(noWrap || boxW === BIG ? BIG : boxW);
      // Use the SAME floor-based line capacity as _clamp so a font that just
      // fits here can't later be trimmed (which would add an unwanted ellipsis).
      const lineH = fs * lineHeight;
      const cap = boxH === BIG ? Number.POSITIVE_INFINITY : Math.floor((boxH - pad * 2) / lineH);
      const limit = Math.min(maxLines ?? Number.POSITIVE_INFINITY, cap);
      const widthOK = boxW === BIG || m.longest <= boxW + 0.5;
      return widthOK && m.lines <= limit;
    };

    let lo = fit.min;
    let hi = fit.max;
    if (!fits(lo)) {
      // Even the smallest size overflows — use it and let clamp trim+ellipsis.
      this._resolvedFontSize = lo;
      this._text.fontSize(lo);
      this._text.text(saved);
      return;
    }
    while (hi - lo > step) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    this._resolvedFontSize = lo;
    this._text.fontSize(lo);
    this._text.text(saved);
  }

  /** Trim the visible text + add an ellipsis to satisfy wrap:none / maxLines / maxHeight. */
  private _clamp(boxW: number, boxH: number): void {
    const wrap = (this.attrs.wrap as string) ?? this._text.wrap();
    const ellipsis = this.attrs.ellipsis as boolean | undefined;
    const wantEllipsis = ellipsis !== false;
    const chars = stringToArray(this._text.text());
    const pad = this._text.padding() ?? 0;
    const trimBy = (this.attrs.trimBy as "word" | "letter") ?? "word";

    // wrap:"none" + a finite width → single line, trim to width.
    if (wrap === "none" && boxW !== BIG) {
      // Fits as-is? (don't reserve ellipsis room here, or a fitted line gets cut.)
      if (this._charWidth(chars.join("")) <= boxW - pad * 2) return;
      const target = boxW - pad * 2 - (wantEllipsis ? this._charWidth(ELLIPSIS) : 0);
      const k = this._largest(
        chars.length,
        (n) => this._charWidth(chars.slice(0, n).join("")) <= target,
      );
      const cut = trimBy === "word" ? snapToWord(chars, k) : k;
      this._text.text(
        chars.slice(0, cut).join("").replace(/\s+$/, "") + (wantEllipsis ? ELLIPSIS : ""),
      );
      return;
    }

    // Otherwise figure out the max number of lines allowed by maxLines + maxHeight.
    const lineH = this._resolvedFontSize * this._text.lineHeight();
    let maxLines = (this.attrs.maxLines as number | undefined) ?? Number.POSITIVE_INFINITY;
    if (boxH !== BIG) {
      const fitLines = Math.floor((boxH - pad * 2) / lineH);
      maxLines = Math.min(maxLines, Math.max(0, fitLines));
    }
    if (!Number.isFinite(maxLines)) return;

    if (this._measure(boxW === BIG ? BIG : boxW).lines <= maxLines) return;

    // Binary-search the longest char prefix that wraps into <= maxLines lines
    // (with room for the ellipsis), then optionally snap back to a word boundary.
    const fitsLines = (n: number): boolean => {
      this._text.text(chars.slice(0, n).join("") + (wantEllipsis ? ELLIPSIS : ""));
      return this._measure(boxW === BIG ? BIG : boxW).lines <= maxLines;
    };
    const k = this._largest(chars.length, fitsLines);
    const cut = trimBy === "word" ? snapToWord(chars, k) : k;
    this._text.text(
      chars.slice(0, cut).join("").replace(/\s+$/, "") + (wantEllipsis ? ELLIPSIS : ""),
    );
  }

  /** Largest n in [0,max] satisfying the monotone predicate. */
  private _largest(max: number, ok: (n: number) => boolean): number {
    let lo = 0;
    let hi = max;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ok(mid)) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // ----- measurement / geometry ------------------------------------------

  private _charWidth(s: string): number {
    if (!s) return 0;
    // Use measureSize (which sets the canvas font itself) rather than the
    // internal _getTextWidth, which relies on a SHARED dummy context whose font
    // is left at whatever the last-measured Konva.Text set. Clip/overlay clipFuncs
    // run at draw time, long after another node may have changed that font, so
    // _getTextWidth there returns widths at the wrong size. measureSize is
    // self-contained. Add letterSpacing the same way _getTextWidth does.
    const ls = this._text.letterSpacing() || 0;
    return this._text.measureSize(s).width + ls * stringToArray(s).length;
  }

  /** Run Konva's wrapping for the current text at `boxW`, returning line metrics. */
  private _measure(boxW: number): { lines: number; longest: number; height: number } {
    const prev = this._text.attrs.width;
    this._text.width(boxW);
    this._text._setTextData();
    const arr = this._text.textArr;
    const lines = arr.length || 1;
    const longest = arr.reduce((mx, l) => Math.max(mx, l.width), 0);
    const lineH = this._text.fontSize() * this._text.lineHeight();
    const pad = this._text.padding() ?? 0;
    this._text.setAttr("width", prev);
    return { lines, longest, height: lines * lineH + pad * 2 };
  }

  /** Map Konva's wrapped lines back to char offsets in the displayed text. */
  private _buildGeometry(): Geometry {
    this._text._setTextData();
    const arr = this._text.textArr;
    const chars = stringToArray(this._text.text());
    const ranges: LineRange[] = [];
    let i = 0;
    for (const ln of arr) {
      const glyphs = stringToArray(ln.text);
      // Skip the single space Konva consumes at a soft wrap (never the line's own glyphs).
      while (
        i < chars.length &&
        chars[i] === " " &&
        (glyphs.length === 0 || chars[i] !== glyphs[0])
      ) {
        i++;
      }
      const start = i;
      i += glyphs.length;
      ranges.push({ start, end: i, width: ln.width });
      if (chars[i] === "\n") i++;
    }
    return {
      chars,
      ranges,
      lineH: this._text.fontSize() * this._text.lineHeight(),
      pad: this._text.padding() ?? 0,
      textAreaW: this._text.width() - (this._text.padding() ?? 0) * 2,
      align: (this.attrs.align as TextAlign) ?? (this._text.align() as TextAlign),
    };
  }

  /** Left offset of a line within the text area, per alignment (matches Konva). */
  private _alignOffset(geo: Geometry, lineWidth: number): number {
    if (geo.align === "center") return (geo.textAreaW - lineWidth) / 2;
    if (geo.align === "right") return geo.textAreaW - lineWidth;
    return 0;
  }

  /** Per-line rectangles covering the global char range [lo,hi). */
  private _segmentRects(
    geo: Geometry,
    lo: number,
    hi: number,
  ): { x: number; w: number; li: number; isStart: boolean; isEnd: boolean }[] {
    const out: { x: number; w: number; li: number; isStart: boolean; isEnd: boolean }[] = [];
    geo.ranges.forEach((r, li) => {
      const segLo = Math.max(lo, r.start);
      const segHi = Math.min(hi, r.end);
      if (segHi <= segLo) return;
      const base = geo.pad + this._alignOffset(geo, r.width);
      const x = base + this._charWidth(geo.chars.slice(r.start, segLo).join(""));
      const w = this._charWidth(geo.chars.slice(segLo, segHi).join(""));
      out.push({ x, w, li, isStart: segLo === lo, isEnd: segHi === hi });
    });
    return out;
  }

  // ----- highlights -------------------------------------------------------

  private _layoutHighlights(): void {
    this._hl.destroyChildren();
    this._hlText.destroyChildren();
    const geo = this._geo;
    const highlights = this.attrs.highlights as HighlightConfig[] | undefined;
    if (!geo || !highlights) return;

    for (const h of highlights) {
      const lo = h.start;
      const full = Math.max(0, h.end - h.start);
      const hi = h.start + Math.round(full * (h.progress ?? 1));
      if (hi <= lo) continue;

      const segs = this._segmentRects(geo, lo, hi);
      const markH =
        h.height === "line" || h.height == null ? geo.lineH : Math.min(h.height, geo.lineH);

      for (const s of segs) {
        let x = s.x;
        let w = s.w;
        if (s.isStart && h.paddingStart) {
          x -= h.paddingStart;
          w += h.paddingStart;
        }
        if (s.isEnd && h.paddingEnd) w += h.paddingEnd;
        // Clamp radii so a large value (e.g. for a pill) renders cleanly rather
        // than overshooting the mark's height/width.
        const maxR = Math.min(markH / 2, w / 2);
        const rS = s.isStart ? Math.min(h.cornerRadiusStart ?? 0, maxR) : 0;
        const rE = s.isEnd ? Math.min(h.cornerRadiusEnd ?? 0, maxR) : 0;
        this._hl.add(
          new Konva.Rect({
            x,
            y: geo.pad + s.li * geo.lineH + (geo.lineH - markH) / 2,
            width: w,
            height: markH,
            fill: h.background,
            cornerRadius: [rS, rE, rE, rS],
            listening: false,
          }),
        );
      }

      // Optional text-color override: overlay a colored copy clipped to the run.
      if (h.color) {
        const overlay = this._clippedClone(h.color, geo.chars.join(""), 1, (ctx) => {
          for (const s of segs) {
            const w = s.w + (s.isEnd && h.paddingEnd ? h.paddingEnd : 0);
            ctx.rect(s.x, geo.pad + s.li * geo.lineH, w, geo.lineH);
          }
        });
        this._hlText.add(overlay);
      }
    }
  }

  private _fillColor(): string {
    const f = this._text.fill();
    return typeof f === "string" && f ? f : "#000";
  }

  /**
   * A clipped, non-interactive copy of `_text` (different fill/opacity). Shapes
   * can't clip, so the clone lives inside a clipping Group.
   */
  private _clippedClone(
    fill: string,
    text: string,
    opacity: number,
    clip: (ctx: CanvasRenderingContext2D) => void,
  ): Konva.Group {
    const g = new Konva.Group({ listening: false, opacity });
    g.clipFunc(clip);
    g.add(
      new Konva.Text({
        text,
        fontSize: this._text.fontSize(),
        fontFamily: this._text.fontFamily(),
        fontStyle: this._text.fontStyle(),
        align: this._text.align(),
        lineHeight: this._text.lineHeight(),
        letterSpacing: this._text.letterSpacing(),
        padding: this._text.padding(),
        wrap: this._text.wrap(),
        width: this._text.width(),
        fill,
        listening: false,
      }),
    );
    return g;
  }

  // ----- typewriter reveal + fade ----------------------------------------

  /**
   * Reveal `[0, reveal)` by clipping `_text` (no re-wrapping). With fade on, the
   * solid clip stops at `commit` and the `[commit, reveal)` window is drawn as
   * per-char overlays ramping their opacity.
   */
  private _layoutReveal(reveal: number): void {
    this._fade.destroyChildren();
    const geo = this._geo;
    const tw = this.attrs.typewriter as TypewriterConfig | undefined;
    if (!geo || !tw) {
      // Not a typewriter: show the whole text, no clip.
      this._setReveal(null);
      return;
    }
    if (!tw.fade) {
      this._setReveal(reveal);
      return;
    }

    const fadeDur = (typeof tw.fade === "object" ? tw.fade.durationInFrames : undefined) ?? 4;
    const easing = typeof tw.fade === "object" ? tw.fade.easing : undefined;
    const full = geo.chars.join("");

    // commit = chars whose fade has fully completed → drawn solid (clipped).
    const commit = this._revealCount(this._localFrame - fadeDur);
    this._setReveal(commit);
    for (let k = commit; k < reveal; k++) {
      const start = this._unitRevealFrame(k);
      let o = clamp((this._localFrame - start) / fadeDur, 0, 1);
      if (easing) o = easing(o);
      if (o <= 0) continue;
      const glyph = this._clippedClone(this._fillColor(), full, o, (ctx) => {
        for (const s of this._segmentRects(geo, k, k + 1)) {
          ctx.rect(s.x, geo.pad + s.li * geo.lineH, s.w, geo.lineH);
        }
      });
      this._fade.add(glyph);
    }
  }

  // ----- cursor -----------------------------------------------------------

  private _layoutCursor(reveal: number): void {
    const geo = this._geo;
    const tw = this.attrs.typewriter as TypewriterConfig | undefined;
    const cursor = tw?.cursor;
    if (!geo || !cursor) {
      this._cursor?.visible(false);
      return;
    }
    const opts = typeof cursor === "object" ? cursor : {};
    // Optionally drop the caret once the whole message has been revealed (e.g. a
    // finished chat bubble shouldn't keep a blinking caret).
    const notStarted = reveal <= 0 && this._localFrame < (tw.startFrame ?? 0);
    if ((opts.hideWhenDone && reveal >= this._fullChars.length) || notStarted) {
      this._cursor?.visible(false);
      return;
    }
    if (!this._cursor) {
      this._cursor = new Konva.Rect({ listening: false });
      super.add(this._cursor);
    }
    const { x, y } = this._caretPos(geo, reveal);
    const width = opts.width ?? 2;
    this._cursor.setAttrs({
      x,
      y,
      width,
      height: geo.lineH,
      fill: opts.color ?? this._fillColor(),
    });
    const blink = opts.blink ?? true;
    if (blink) {
      const period = opts.blinkPeriodInFrames ?? 16;
      this._cursor.visible(Math.floor(this._localFrame / period) % 2 === 0);
    } else {
      this._cursor.visible(true);
    }
  }

  /** Pixel position of the caret sitting just after char `idx`. */
  private _caretPos(geo: Geometry, idx: number): { x: number; y: number } {
    let r: LineRange | undefined;
    let li = 0;
    for (let i = 0; i < geo.ranges.length; i++) {
      const cur = geo.ranges[i];
      if (cur && cur.start <= idx) {
        r = cur;
        li = i;
      }
    }
    if (!r) return { x: geo.pad, y: geo.pad };
    const localEnd = Math.min(idx, r.end);
    const x =
      geo.pad +
      this._alignOffset(geo, r.width) +
      this._charWidth(geo.chars.slice(r.start, localEnd).join(""));
    return { x, y: geo.pad + li * geo.lineH };
  }
}
