import Konva from "konva";
import { type Composition, getComposition } from "../../engine/composition.js";
import { type FontFaceDescriptor, loadFontFace } from "../../engine/runtime-defaults.js";
import { FONT_MARK, TICK_MARK } from "../../markers.js";

/** CSS font-style keyword. */
export type FontStyleName = "normal" | "italic" | "oblique";

/** One declared face of a {@link Font} family. */
export type FontFace = {
  /**
   * Face weight: a number (`400`), a numeric string (`"400"`), or a keyword
   * (`"normal"` → 400, `"bold"` → 700). A variable-font range string like
   * `"100 900"` is passed through as-is. Default `400`.
   */
  weight?: number | string;
  /** Face style. Default `"normal"`. */
  style?: FontStyleName;
  /** Font file source — a URL (e.g. a Vite `?url` import) or, server-side, a path/URL. */
  src: string;
};

export type FontConfig = {
  /** Family name. **Process-global** in the text backend — distinct fonts need distinct names. */
  family: string;
  faces: FontFace[];
};

/** A resolved, normalized face — weight/style are canonical strings. */
type ResolvedFace = FontFaceDescriptor & { style: FontStyleName };

/**
 * What {@link Text} consumes via `{ font }` — a concrete `family`/`weight`/`style`
 * plus readiness so `Text` can re-layout once the glyphs are loaded. Produced by
 * {@link Font.face}.
 */
export type FontFaceRef = {
  family: string;
  weight: string;
  style: FontStyleName;
  /** Resolves when the backing font has finished loading. */
  whenReady(): Promise<void>;
  /** True once loaded. */
  readonly isLoaded: boolean;
};

function normalizeWeight(weight: number | string | undefined): string {
  if (weight === undefined) return "400";
  const w = String(weight).trim().toLowerCase();
  if (w === "normal") return "400";
  if (w === "bold") return "700";
  return w;
}

function normalizeStyle(style: string | undefined): FontStyleName {
  const s = (style ?? "normal").trim().toLowerCase();
  if (s === "italic" || s === "oblique") return s;
  return "normal";
}

/**
 * A declarative font: a family name plus its faces. Lives in the `Sequence`
 * tree as an invisible {@link Konva.Group} (so `seq.add(font)` works) and is
 * discovered by `Composition.add` via {@link FONT_MARK}, which kicks the load and
 * buffers on it before playback. Loading is environment-aware (the browser
 * `FontFace` API in preview; skia-canvas `FontLibrary` when a server renderer
 * has installed its loader) and deduped per face.
 *
 * Pass a `Font` (or `font.face(selector)`) to a {@link Text}'s `font` option.
 */
export class Font extends Konva.Group {
  readonly family: string;
  readonly faces: ResolvedFace[];
  private _loadPromise: Promise<void> | null = null;
  private _loaded = false;
  private _registered = false;

  constructor(config: FontConfig) {
    super({ listening: false, visible: false });
    if (!config.family) throw new Error("Font: family is required");
    if (!config.faces || config.faces.length === 0) {
      throw new Error(`Font "${config.family}": at least one face is required`);
    }
    this.setAttr(FONT_MARK, true);
    // Discovered by `Sequence` too, so a font added after `comp.add(seq)` still
    // registers on its first active tick (lazy fallback for the eager add walk).
    this.setAttr(TICK_MARK, true);

    this.family = config.family;
    this.faces = config.faces.map((f) => ({
      weight: normalizeWeight(f.weight),
      style: normalizeStyle(f.style),
      src: f.src,
    }));

    const seen = new Set<string>();
    for (const f of this.faces) {
      const slot = `${f.weight}-${f.style}`;
      if (seen.has(slot)) {
        console.warn(
          `[smoove] Font "${this.family}": duplicate ${slot} face — only the first is used.`,
        );
      }
      seen.add(slot);
    }
  }

  /** True once every face has finished loading. */
  get isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Load one face into the active text backend. The default delegates to
   * {@link loadFontFace}: the browser `FontFace` API in preview, or the server
   * renderer's loader under a headless render. Subclasses override this to
   * change how a face loads (skip the fetch when the host page preloads fonts,
   * route through an authenticated host, rewrite the `src`) while `load()`
   * keeps the load-once promise, the `isLoaded` flag, and the composition's
   * buffer gate.
   */
  protected loadFace(face: FontFaceDescriptor): Promise<void> {
    return loadFontFace(this.family, face);
  }

  /**
   * Load every face (environment-aware, deduped, idempotent). Returns the shared
   * load promise; resolves even if a face fails (the error is logged) so a single
   * bad face can't wedge playback. Per-face loading goes through {@link loadFace}.
   */
  load(): Promise<void> {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = Promise.all(this.faces.map((f) => this.loadFace(f)))
      .then(() => {
        this._loaded = true;
      })
      .catch((err: unknown) => {
        console.error(`[smoove] Font "${this.family}" load failed:`, err);
      });
    return this._loadPromise;
  }

  /** Resolves when the font has loaded — alias of {@link load} for {@link FontFaceRef}. */
  whenReady(): Promise<void> {
    return this.load();
  }

  /**
   * Select a face to hand to a `Text`. Selector grammar: `"<weight>"` or
   * `"<weight>-<style>"` (e.g. `"700"`, `"400-italic"`).
   *
   * - no selector → preferred face (`400`/`normal`, else the first declared face)
   * - `"400"` → first `400`/`normal`, else first `400` of any style (throws if no `400`)
   * - `"400-italic"` → exactly `400`/`italic` (**throws** if absent)
   */
  face(selector?: string): FontFaceRef {
    const resolved = this._select(selector);
    const self = this;
    return {
      family: this.family,
      weight: resolved.weight,
      style: resolved.style,
      whenReady: () => self.load(),
      get isLoaded() {
        return self._loaded;
      },
    };
  }

  private _select(selector?: string): ResolvedFace {
    const first = this.faces[0] as ResolvedFace; // non-empty (validated in ctor)
    if (!selector) {
      return this.faces.find((f) => f.weight === "400" && f.style === "normal") ?? first;
    }
    const [weightRaw, styleRaw] = selector.split("-");
    const weight = normalizeWeight(weightRaw);
    if (styleRaw) {
      const style = normalizeStyle(styleRaw);
      const match = this.faces.find((f) => f.weight === weight && f.style === style);
      if (!match) {
        throw new Error(
          `Font "${this.family}": no ${weight}-${style} face; have ${this._faceList()}`,
        );
      }
      return match;
    }
    const match =
      this.faces.find((f) => f.weight === weight && f.style === "normal") ??
      this.faces.find((f) => f.weight === weight);
    if (!match) {
      throw new Error(`Font "${this.family}": no ${weight} face; have ${this._faceList()}`);
    }
    return match;
  }

  private _faceList(): string {
    return this.faces.map((f) => `${f.weight}-${f.style}`).join(", ");
  }

  /**
   * @internal — `Composition.add` walks {@link FONT_MARK} and calls this once:
   * kicks the load and either buffers on it (preview, via `registerAsset`) or
   * gates `renderFrame` on it (offline, via `delayRender`). Idempotent.
   */
  _kmRegister(comp: Composition): void {
    if (this._registered) return;
    this._registered = true;
    const p = this.load();
    if (comp.environment.isRendering) {
      const handle = comp.delayRender(`load font ${this.family}`);
      p.finally(() => comp.continueRender(handle));
    } else {
      comp.registerAsset(p, `font ${this.family}`);
    }
  }

  /** @internal — lazy fallback: register on first active tick if the eager add walk missed us. */
  _kmTick(_localFrame: number): void {
    if (this._registered) return;
    const stage = this.getStage();
    if (!stage) return;
    const comp = getComposition(stage);
    if (comp) this._kmRegister(comp);
  }

  /** @internal */
  _kmDeactivate(): void {}
}
