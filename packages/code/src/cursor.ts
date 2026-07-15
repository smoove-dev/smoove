import type { CodeHighlighter } from "./highlighter.js";
import { type CodeMetrics, type MeasureContext, measureString } from "./metrics.js";
import { type CodePoint, type CodeRange, isPointInCodeSelection } from "./range.js";
import { type CodeScope, type CodeTag, isCodeScope } from "./scope.js";

/** One drawable run of text produced by the cursor. */
export interface DrawInfo {
  text: string;
  /** Pixel position of the run's top-left. */
  x: number;
  y: number;
  /** Pixel advance of one glyph in this run. */
  charWidth: number;
  fill: string;
  /** Crossfade opacity for changing fragments. */
  alpha: number;
  /** Selection factor in [0,1]; 1 = fully selected/visible. */
  time: number;
}

export interface CursorConfig {
  context: MeasureContext;
  monoWidth: number;
  lineHeight: number;
  fontHeight: number;
  verticalOffset: number;
  fallbackFill: string;
  highlighter: CodeHighlighter | null;
  caches: { before: unknown; after: unknown } | null;
  selection: CodeRange[];
  oldSelection: CodeRange[] | null;
  selectionProgress: number | null;
}

interface MeasuredFragment {
  before: CodeMetrics;
  after: CodeMetrics;
}

const map = (from: number, to: number, value: number): number => from + (to - from) * value;

const clamp = (min: number, max: number, value: number): number =>
  value < min ? min : value > max ? max : value;

const clampRemap = (
  fromIn: number,
  toIn: number,
  fromOut: number,
  toOut: number,
  value: number,
): number => {
  const lo = Math.min(fromIn, toIn);
  const hi = Math.max(fromIn, toIn);
  const t = (clamp(lo, hi, value) - fromIn) / (toIn - fromIn);
  return map(fromOut, toOut, t);
};

function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    const [, r, g, b] = short as unknown as [string, string, string, string];
    return [Number.parseInt(r + r, 16), Number.parseInt(g + g, 16), Number.parseInt(b + b, 16)];
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (long) {
    const [, r, g, b] = long as unknown as [string, string, string, string];
    return [Number.parseInt(r, 16), Number.parseInt(g, 16), Number.parseInt(b, 16)];
  }
  return null;
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) {
    return t < 0.5 ? a : b;
  }
  const channel = (i: number) =>
    Math.round(map(ca[i] as number, cb[i] as number, t))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

interface SelectionState {
  before: number | null;
  after: number | null;
}

/**
 * Recursively walks a code scope, measuring its size and producing the flat
 * list of {@link DrawInfo} runs the {@link Code} node paints. Ported and
 * decoupled from motion-canvas's CodeCursor.
 */
export class CodeCursor {
  private cfg!: CursorConfig;
  private cursorX = 0;
  private cursorY = 0;
  private beforeX = 0;
  private beforeY = 0;
  private afterX = 0;
  private afterY = 0;
  private beforeIndex = 0;
  private afterIndex = 0;
  private maxWidth = 0;
  private info: DrawInfo[] = [];
  private globalProgress: number[] = [];

  setup(config: CursorConfig): void {
    this.cfg = config;
    this.cursorX = 0;
    this.cursorY = 0;
    this.beforeX = 0;
    this.beforeY = 0;
    this.afterX = 0;
    this.afterY = 0;
    this.beforeIndex = 0;
    this.afterIndex = 0;
    this.maxWidth = 0;
    this.info = [];
    this.globalProgress = [];
  }

  private frag(tag: CodeTag): MeasuredFragment {
    const { context, monoWidth } = this.cfg;
    if (typeof tag === "string") {
      const m = measureString(context, monoWidth, tag);
      return { before: m, after: m };
    }
    // CodeFragment { before, after } — scopes are handled by the caller.
    const fragment = tag as { before: string; after: string };
    return {
      before: measureString(context, monoWidth, fragment.before),
      after: measureString(context, monoWidth, fragment.after),
    };
  }

  private calcWidth(metrics: CodeMetrics, x = this.cursorX): number {
    return metrics.newRows === 0 ? x + metrics.lastWidth : metrics.lastWidth;
  }

  private calcMaxWidth(metrics: CodeMetrics, x = this.cursorX): number {
    return Math.max(this.maxWidth, metrics.maxWidth, x + metrics.firstWidth);
  }

  measureSize(scope: CodeScope): void {
    const progress = scope.progress;
    for (const tag of scope.fragments) {
      if (isCodeScope(tag)) {
        this.measureSize(tag);
        continue;
      }
      const fragment = this.frag(tag);
      const maxW = map(
        this.calcMaxWidth(fragment.before),
        this.calcMaxWidth(fragment.after),
        progress,
      );
      if (maxW > this.maxWidth) {
        this.maxWidth = maxW;
      }

      const beforeEnd = this.calcWidth(fragment.before);
      const afterEnd = this.calcWidth(fragment.after);
      this.cursorX = map(beforeEnd, afterEnd, progress);

      if (this.cursorY === 0) {
        this.cursorY = 1;
      }
      this.cursorY += map(fragment.before.newRows, fragment.after.newRows, progress);
    }
  }

  getSize(): { x: number; y: number } {
    return {
      x: this.maxWidth * this.cfg.monoWidth,
      y: this.cursorY * this.cfg.lineHeight + this.cfg.verticalOffset,
    };
  }

  drawScope(scope: CodeScope): void {
    const progress = scope.progress;
    for (const tag of scope.fragments) {
      if (isCodeScope(tag)) {
        this.drawScope(tag);
        continue;
      }
      const fragment = this.frag(tag);

      const timingOffset = 0.8;
      let alpha = 1;
      let offsetY = 0;
      if (fragment.before.content !== fragment.after.content) {
        const mirrored = Math.abs(progress - 0.5) * 2;
        alpha = clampRemap(1, 1 - timingOffset, 1, 0, mirrored);

        const isBigger = fragment.after.newRows > fragment.before.newRows ? 1 : -1;
        const isBefore = progress < 0.5 ? 1 : -1;
        const scale = isBigger * isBefore * 4;
        offsetY = map(
          Math.abs(fragment.after.newRows - fragment.before.newRows) / scale,
          0,
          mirrored,
        );
      }

      this.drawToken(fragment, progress, this.cursorX, this.cursorY + offsetY, alpha);

      this.beforeX = this.calcWidth(fragment.before, this.beforeX);
      this.afterX = this.calcWidth(fragment.after, this.afterX);
      this.beforeY += fragment.before.newRows;
      this.afterY += fragment.after.newRows;
      this.beforeIndex += fragment.before.content.length;
      this.afterIndex += fragment.after.content.length;

      this.cursorY += map(fragment.before.newRows, fragment.after.newRows, progress);
      const beforeEnd = this.calcWidth(fragment.before);
      const afterEnd = this.calcWidth(fragment.after);
      this.cursorX = map(beforeEnd, afterEnd, progress);
    }
  }

  private drawToken(
    fragment: MeasuredFragment,
    progress: number,
    offsetX: number,
    offsetY: number,
    alpha: number,
  ): void {
    const { context, monoWidth, lineHeight, fallbackFill, highlighter, caches } = this.cfg;
    if (progress > 0) {
      this.globalProgress.push(progress);
    }

    const code = progress < 0.5 ? fragment.before : fragment.after;

    let hasOffset = true;
    let width = 0;
    let stringLength = 0;
    let y = 0;

    for (let i = 0; i < code.content.length; i++) {
      let color = fallbackFill;
      let char = code.content.charAt(i);
      const selection: SelectionState = { before: null, after: null };

      if (char === "\n") {
        y++;
        hasOffset = false;
        width = 0;
        stringLength = 0;
        continue;
      }

      const beforeHighlight =
        caches && highlighter ? highlighter.highlight(this.beforeIndex + i, caches.before) : null;
      const afterHighlight =
        caches && highlighter ? highlighter.highlight(this.afterIndex + i, caches.after) : null;
      const highlight = progress < 0.5 ? beforeHighlight : afterHighlight;

      if (highlight) {
        let resolvedColor = highlight.color;
        if (
          fragment.before.content === fragment.after.content &&
          beforeHighlight?.color !== afterHighlight?.color
        ) {
          resolvedColor = lerpColor(
            beforeHighlight?.color ?? fallbackFill,
            afterHighlight?.color ?? fallbackFill,
            progress,
          );
        }
        if (resolvedColor) {
          color = resolvedColor;
        }

        let skipAhead = 0;
        do {
          if (this.processSelection(selection, skipAhead, hasOffset, stringLength, y)) {
            break;
          }
          skipAhead++;
        } while (skipAhead < highlight.skipAhead && code.content.charAt(i + skipAhead) !== "\n");

        if (skipAhead > 1) {
          char = code.content.slice(i, i + skipAhead);
        }
        i += char.length - 1;
      } else {
        this.processSelection(selection, 0, hasOffset, stringLength, y);
        let skipAhead = 1;
        while (i < code.content.length - 1 && code.content.charAt(i + 1) !== "\n") {
          if (this.processSelection(selection, skipAhead, hasOffset, stringLength, y)) {
            break;
          }
          skipAhead++;
          char += code.content.charAt(++i);
        }
      }

      const selectionAfter = selection.after ?? 0;
      const selectionBefore = selection.before ?? 0;
      let time: number;
      if (fragment.before.content === "") {
        time = selectionAfter;
      } else if (fragment.after.content === "") {
        time = selectionBefore;
      } else {
        time = map(
          selectionBefore,
          selectionAfter,
          this.cfg.selectionProgress ?? this.currentProgress(),
        );
      }

      const measure = context.measureText(char);
      this.info.push({
        text: char,
        x: (hasOffset ? offsetX + width : width) * monoWidth,
        y: (offsetY + y) * lineHeight,
        charWidth: measure.width / char.length,
        alpha,
        fill: color,
        time,
      });

      stringLength += char.length;
      width += Math.round(measure.width / monoWidth);
    }
  }

  private currentProgress(): number {
    if (this.globalProgress.length === 0) {
      return 0;
    }
    let sum = 0;
    for (const p of this.globalProgress) {
      sum += p;
    }
    return sum / this.globalProgress.length;
  }

  private processSelection(
    selection: SelectionState,
    skipAhead: number,
    hasOffset: boolean,
    stringLength: number,
    y: number,
  ): boolean {
    let shouldBreak = false;

    let current = this.isSelected(
      (hasOffset ? this.beforeX + stringLength : stringLength) + skipAhead,
      this.beforeY + y,
      false,
    );
    if (selection.before !== null && selection.before !== current) {
      shouldBreak = true;
    } else {
      selection.before = current;
    }

    current = this.isSelected(
      (hasOffset ? this.afterX + stringLength : stringLength) + skipAhead,
      this.afterY + y,
      true,
    );
    if (selection.after !== null && selection.after !== current) {
      shouldBreak = true;
    } else {
      selection.after = current;
    }

    return shouldBreak;
  }

  private isSelected(x: number, y: number, isAfter: boolean): number {
    const point: CodePoint = [y, x];
    // An empty selection set means "no highlight" — everything shows at full
    // brightness rather than everything dimmed.
    const inSelection = (ranges: CodeRange[]) =>
      ranges.length === 0 || isPointInCodeSelection(point, ranges) ? 1 : 0;

    const maxSelection = inSelection(this.cfg.selection);
    if (this.cfg.oldSelection === null || this.cfg.selectionProgress === null) {
      return maxSelection;
    }
    if (isAfter) {
      return maxSelection;
    }
    return inSelection(this.cfg.oldSelection);
  }

  getDrawingInfo(): DrawInfo[] {
    return this.info;
  }
}
