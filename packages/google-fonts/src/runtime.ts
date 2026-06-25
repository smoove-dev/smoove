import { Font, type FontStyleName } from "@konva-motion/core";

/**
 * Options for a generated Google font. `weights`, `styles`, and `subset` are
 * typed per family (literal unions of what that family actually ships). Omit
 * `weights`/`styles` to register every value the family provides.
 */
export interface GoogleFontOptions<
  W extends string = string,
  S extends string = string,
  Sub extends string = string,
> {
  /** Weights to register. Omit → all weights this family provides. */
  weights?: readonly W[];
  /** Styles to register. Omit → all styles this family provides. */
  styles?: readonly S[];
  /**
   * Character subset to load (e.g. `"latin"`, `"latin-ext"`, `"cyrillic"`).
   * Default `"latin"`. Exactly one subset is loaded so the same file is used in
   * the browser and headless (skia) rendering — pick the subset matching your
   * text.
   */
  subset?: Sub;
}

/** A family's faces, grouped by subset: subset → (variant `"<weight>-<style>"` → woff2 URL). */
export type SubsetFaceMap = Readonly<Record<string, Readonly<Record<string, string>>>>;

const DEFAULT_SUBSET = "latin";

/**
 * Base class for every generated Google font. Extends core's {@link Font}, so
 * `.face()`, the composition buffer gate, and server-side disk-caching of the
 * remote `src` all work unchanged. Generated subclasses pass their family name
 * and {@link SubsetFaceMap}; the user's `subset` picks the file set and
 * `weights`/`styles` filter which faces are registered (all when unspecified).
 */
export class GoogleFont<
  W extends string = string,
  S extends string = string,
  Sub extends string = string,
> extends Font {
  constructor(family: string, faces: SubsetFaceMap, options?: GoogleFontOptions<W, S, Sub>) {
    super({
      family,
      faces: selectFaces(family, pickSubset(family, faces, options?.subset), options),
    });
  }
}

function pickSubset(
  family: string,
  faces: SubsetFaceMap,
  subset?: string,
): Readonly<Record<string, string>> {
  const map = (subset && faces[subset]) ?? faces[DEFAULT_SUBSET] ?? Object.values(faces)[0];
  if (!map) {
    throw new Error(`@konva-motion/google-fonts: "${family}" has no subsets.`);
  }
  if (subset && !faces[subset]) {
    console.warn(
      `[konva-motion] google-fonts "${family}": no "${subset}" subset; using "${faces[DEFAULT_SUBSET] ? DEFAULT_SUBSET : Object.keys(faces)[0]}".`,
    );
  }
  return map;
}

type SelectedFace = { weight: string; style: FontStyleName; src: string };

function selectFaces(
  family: string,
  faces: Readonly<Record<string, string>>,
  options?: GoogleFontOptions,
): SelectedFace[] {
  const weights = options?.weights;
  const styles = options?.styles;
  const out: SelectedFace[] = [];
  for (const variant of Object.keys(faces)) {
    const [weight, style] = variant.split("-") as [string, FontStyleName];
    if (weights && !weights.includes(weight)) continue;
    if (styles && !styles.includes(style)) continue;
    out.push({ weight, style, src: faces[variant] as string });
  }
  if (out.length === 0) {
    throw new Error(
      `@konva-motion/google-fonts: "${family}" — no faces match the selected weights/styles.`,
    );
  }
  return out;
}
