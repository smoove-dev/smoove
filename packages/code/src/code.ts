import { FlexShape, Font, type FontFaceRef, type LeafConfig } from "@smoove/core";
import Konva from "konva";
import {
  type CodeContent,
  normalizeSelection,
  resolveContent,
  type SelectionContent,
} from "./content.js";
import { CodeCursor } from "./cursor.js";
import type { CodeHighlighter } from "./highlighter.js";
import {
  type CodePoint,
  type CodeRange,
  type CodeSelection,
  findAllCodeRanges,
  type PossibleCodeSelection,
} from "./range.js";
import { type CodeScope, parseCodeScope, resolveScope } from "./scope.js";
import { type CodeTokenizer, defaultTokenize } from "./tokenizer.js";

export interface CodeConfig extends LeafConfig {
  /** Initial code: a string or an `interpolate*`-produced {@link CodeContent}. */
  content?: string | CodeContent;
  highlighter?: CodeHighlighter | null;
  /** A monospace font. Recommended for server rendering. */
  font?: Font | FontFaceRef;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  /** Line-height multiplier (line height = fontSize * this). Default 1.4. */
  lineHeight?: number;
  /** Fill used when no highlighter (or a token has no color). */
  fill?: string;
  selection?: PossibleCodeSelection;
}

const CONFIG_KEYS = [
  "content",
  "highlighter",
  "font",
  "fontFamily",
  "fontStyle",
  "fontSize",
  "lineHeight",
  "fill",
  "selection",
] as const;

function konvaFontStyle(weight: string, style: string): string {
  const parts: string[] = [];
  if (style !== "normal") parts.push(style);
  if (weight !== "400") parts.push(weight);
  return parts.length > 0 ? parts.join(" ") : "normal";
}

function stripConfig(config: CodeConfig): LeafConfig {
  const out: Record<string, unknown> = { ...config };
  for (const key of CONFIG_KEYS) {
    delete out[key];
  }
  return out as LeafConfig;
}

function isSelectionContent(
  value: PossibleCodeSelection | SelectionContent,
): value is SelectionContent {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    ((value as SelectionContent).kind === "static" ||
      (value as SelectionContent).kind === "transition")
  );
}

const CodeBase = FlexShape<Konva.Shape, CodeConfig>(Konva.Shape);

/**
 * A timeline-driven, syntax-highlighted code node. Like {@link Text} it is a
 * layout-aware leaf; drive its content each frame with `setContent` and the
 * `interpolate*` helpers.
 */
export class Code extends CodeBase {
  private readonly _cursor = new CodeCursor();
  private readonly _measureCtx: CanvasRenderingContext2D;

  private _highlighter: CodeHighlighter | null;
  private _fontRef: FontFaceRef | null;
  private _fontFamily: string;
  private _fontStyle: string;
  private _fontSize: number;
  private _lineHeight: number;
  private _fill: string;

  private _scope: CodeScope = { progress: 0, fragments: [] };
  private _size = { x: 0, y: 0 };

  private _selection: CodeSelection = [];
  private _oldSelection: CodeSelection | null = null;
  private _selectionProgress: number | null = null;

  // Memoized diff/edit resolution — only the progress changes per frame.
  private _resolveKey: readonly unknown[] | null = null;
  private _resolveFragments: CodeScope["fragments"] = [];
  // Memoized highlighter caches, keyed on the before/after strings.
  private _hlKey: string | null = null;
  private _hlCache: { before: unknown; after: unknown } | null = null;

  constructor(config: CodeConfig = {}) {
    super(stripConfig(config));

    this._highlighter = config.highlighter ?? null;
    this._fontSize = config.fontSize ?? 32;
    this._lineHeight = config.lineHeight ?? 1.4;
    this._fill = config.fill ?? "#d8dee9";

    this._fontRef = config.font
      ? config.font instanceof Font
        ? config.font.face()
        : config.font
      : null;
    this._fontFamily = this._fontRef ? this._fontRef.family : (config.fontFamily ?? "monospace");
    this._fontStyle = this._fontRef
      ? konvaFontStyle(this._fontRef.weight, this._fontRef.style)
      : (config.fontStyle ?? "normal");

    const canvas = Konva.Util.createCanvasElement();
    this._measureCtx = canvas.getContext("2d") as CanvasRenderingContext2D;

    if (config.selection !== undefined) {
      this._selection = normalizeSelection(config.selection);
    }

    this.sceneFunc(this._sceneFunc.bind(this) as Konva.Shape["sceneFunc"]);
    this.hitFunc(((ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();
      ctx.rect(0, 0, this._size.x, this._size.y);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    }) as Konva.Shape["hitFunc"]);

    this.setContent(config.content ?? "");

    if (this._fontRef && !this._fontRef.isLoaded) {
      this._fontRef.whenReady().then(() => {
        this._remeasure();
        this.getLayer()?.batchDraw();
      });
    }
  }

  private get _fontString(): string {
    return `${this._fontStyle} ${this._fontSize}px ${this._fontFamily}`;
  }

  private _tokenize(): CodeTokenizer {
    const hl = this._highlighter;
    return hl ? (code: string) => hl.tokenize(code) : defaultTokenize;
  }

  /** Resolve a content descriptor into a scope, memoizing the diff/edit work. */
  private _resolve(content: string | CodeContent): CodeScope {
    if (typeof content === "string") {
      return { progress: 0, fragments: parseCodeScope(content).fragments };
    }
    if (content.kind === "static") {
      return { progress: 0, fragments: parseCodeScope(content.value).fragments };
    }

    const key =
      content.kind === "diff"
        ? ["diff", content.from, content.to]
        : ["edit", content.base, content.edits];

    if (!this._sameKey(key)) {
      this._resolveKey = key;
      this._resolveFragments = resolveContent(content, this._tokenize()).fragments;
    }
    return { progress: content.progress, fragments: this._resolveFragments };
  }

  private _sameKey(key: readonly unknown[]): boolean {
    const prev = this._resolveKey;
    if (!prev || prev.length !== key.length) return false;
    for (let i = 0; i < key.length; i++) {
      if (prev[i] !== key[i]) return false;
    }
    return true;
  }

  /** Replace the code content. Accepts a string or a {@link CodeContent}. */
  setContent(content: string | CodeContent): this {
    this._scope = this._resolve(content);
    this._remeasure();
    this.getLayer()?.batchDraw();
    return this;
  }

  /** Set the selection, either statically or mid-transition. */
  setSelection(selection: PossibleCodeSelection | SelectionContent): this {
    if (isSelectionContent(selection)) {
      if (selection.kind === "static") {
        this._selection = selection.selection;
        this._oldSelection = null;
        this._selectionProgress = null;
      } else {
        this._selection = selection.to;
        this._oldSelection = selection.from;
        this._selectionProgress = selection.progress;
      }
    } else {
      this._selection = normalizeSelection(selection);
      this._oldSelection = null;
      this._selectionProgress = null;
    }
    this.getLayer()?.batchDraw();
    return this;
  }

  /** The current code as a string (the `after` side of any active edit). */
  parsed(): string {
    return resolveScope(this._scope, (s) => s.progress > 0.5);
  }

  /** All ranges whose text matches `pattern` in the current code. */
  findRanges(pattern: string | RegExp): CodeRange[] {
    return findAllCodeRanges(this.parsed(), pattern);
  }

  findFirstRange(pattern: string | RegExp): CodeRange | null {
    return this.findRanges(pattern)[0] ?? null;
  }

  /** @internal Override so the flex engine reads the measured code bounds. */
  override getSelfRect(): { x: number; y: number; width: number; height: number } {
    return { x: 0, y: 0, width: this._size.x, height: this._size.y };
  }

  private _applyFont(ctx: CanvasRenderingContext2D): void {
    ctx.font = this._fontString;
    ctx.textBaseline = "top";
  }

  private _monoMetrics(ctx: CanvasRenderingContext2D): {
    monoWidth: number;
    fontHeight: number;
    verticalOffset: number;
  } {
    const m = ctx.measureText("X");
    const ascent = m.fontBoundingBoxAscent ?? this._fontSize * 0.8;
    const descent = m.fontBoundingBoxDescent ?? this._fontSize * 0.2;
    return {
      monoWidth: m.width,
      fontHeight: ascent + descent,
      verticalOffset: ascent,
    };
  }

  private _highlighterCaches(): { before: unknown; after: unknown } | null {
    if (!this._highlighter) return null;
    const before = resolveScope(this._scope, false);
    const after = resolveScope(this._scope, true);
    const key = `${before} ${after}`;
    if (this._hlKey !== key) {
      this._hlKey = key;
      this._hlCache = {
        before: this._highlighter.prepare(before),
        after: this._highlighter.prepare(after),
      };
    }
    return this._hlCache;
  }

  private _remeasure(): void {
    this._applyFont(this._measureCtx);
    const { monoWidth, fontHeight, verticalOffset } = this._monoMetrics(this._measureCtx);
    this._cursor.setup({
      context: this._measureCtx,
      monoWidth,
      lineHeight: this._fontSize * this._lineHeight,
      fontHeight,
      verticalOffset,
      fallbackFill: this._fill,
      highlighter: null,
      caches: null,
      selection: this._selection,
      oldSelection: this._oldSelection,
      selectionProgress: this._selectionProgress,
    });
    this._cursor.measureSize(this._scope);
    this._size = this._cursor.getSize();

    if (this.attrs.flexWidth === undefined) this.width(this._size.x);
    if (this.attrs.flexHeight === undefined) this.height(this._size.y);
  }

  private _sceneFunc(context: Konva.Context): void {
    const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
    this._applyFont(ctx);
    const { monoWidth, fontHeight, verticalOffset } = this._monoMetrics(ctx);

    this._cursor.setup({
      context: ctx,
      monoWidth,
      lineHeight: this._fontSize * this._lineHeight,
      fontHeight,
      verticalOffset,
      fallbackFill: this._fill,
      highlighter: this._highlighter,
      caches: this._highlighterCaches(),
      selection: this._selection,
      oldSelection: this._oldSelection,
      selectionProgress: this._selectionProgress,
    });
    this._cursor.drawScope(this._scope);

    for (const info of this._cursor.getDrawingInfo()) {
      const dim = 0.2 + 0.8 * info.time;
      const alpha = info.alpha * dim;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = info.fill;
      ctx.fillText(info.text, info.x, info.y);
      ctx.restore();
    }
  }

  getPointBBox(point: CodePoint): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const [line, column] = point;
    const lineHeight = this._fontSize * this._lineHeight;
    this._applyFont(this._measureCtx);
    const { monoWidth, fontHeight } = this._monoMetrics(this._measureCtx);
    return {
      x: column * monoWidth,
      y: line * lineHeight,
      width: monoWidth,
      height: fontHeight,
    };
  }
}
