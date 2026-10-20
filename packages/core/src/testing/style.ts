import type Konva from "konva";
import { parseColor, type RGBA } from "../animation/color.js";
import { Font } from "../layout/text/font.js";
import type { Hit } from "./findings.js";
import { goTo, type SweepContext } from "./purity.js";
import { isHeldFrame } from "./sampling.js";

/** What the checks file declares: a look's or a brand's palette and fonts. */
export interface StyleDeclaration {
  palette?: Record<string, string>;
  /** Font objects, or family names that cover every weight. */
  fonts?: Array<Font | string>;
}

/** Two distinct colors this close on every channel are almost surely a nudged hex. */
const NEAR = 6;

const COLOR_ATTRS = ["fill", "stroke", "shadowColor"] as const;
const STOP_ATTRS = [
  "fillLinearGradientColorStops",
  "fillRadialGradientColorStops",
  "strokeLinearGradientColorStops",
] as const;

const hex = (c: RGBA): string =>
  `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** A color's 8-bit hex with alpha ignored, or null for transparent or unparseable. */
function keyOf(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const c = parseColor(value);
    return c.a > 0 ? hex(c) : null;
  } catch {
    return null;
  }
}

/** Every color a node paints with: flat colors and every gradient stop. */
function colorsOf(node: Konva.Node): string[] {
  const out: string[] = [];
  for (const attr of COLOR_ATTRS) {
    const k = keyOf(node.getAttr(attr));
    if (k) out.push(k);
  }
  for (const attr of STOP_ATTRS) {
    const stops = node.getAttr(attr) as unknown[] | undefined;
    if (!Array.isArray(stops)) continue;
    for (const s of stops) {
      const k = keyOf(s);
      if (k) out.push(k);
    }
  }
  return out;
}

type ProbeText = {
  _kmProbeText(): { font: { family: string; weight: string; loaded: boolean | null } };
};
const hasProbeText = (node: Konva.Node): node is Konva.Node & ProbeText =>
  typeof (node as Partial<ProbeText>)._kmProbeText === "function";

/** Declared fonts as family to weights, where an empty set means every weight. */
function declaredFonts(fonts: Array<Font | string>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const f of fonts) {
    if (typeof f === "string") {
      out.set(f, new Set());
    } else if (f instanceof Font) {
      const weights = out.get(f.family) ?? new Set<string>();
      for (const face of f.faces) weights.add(String(face.weight));
      out.set(f.family, weights);
    }
  }
  return out;
}

const close = (a: string, b: string): boolean => {
  const pa = parseColor(a);
  const pb = parseColor(b);
  return (
    Math.abs(pa.r - pb.r) <= NEAR && Math.abs(pa.g - pb.g) <= NEAR && Math.abs(pa.b - pb.b) <= NEAR
  );
};

/**
 * Colors outside the declared palette, fonts outside the declared fonts, and
 * Text drawn in a fallback face, read on held frames only so a color tween
 * passes through its in-between shades. With nothing declared, near-duplicate
 * colors and more than two families instead. Also returns the colors in use,
 * most used first.
 */
export function styleSweep(
  ctx: SweepContext,
  style: StyleDeclaration | null,
): { hits: Hit[]; colorsInUse: string[] } {
  const palette = style?.palette
    ? new Set(
        Object.values(style.palette)
          .map(keyOf)
          .filter((k): k is string => k !== null),
      )
    : null;
  const fonts = style?.fonts ? declaredFonts(style.fonts) : null;

  const hits: Hit[] = [];
  const counts = new Map<string, number>();
  const users = new Map<string, { node: Konva.Node; frame: number }>();
  const families = new Map<string, number>();

  for (const frame of ctx.samples) {
    if (!isHeldFrame(frame, ctx.beats)) continue;
    goTo(ctx.comp, frame);
    const authored = new Set(ctx.nodes());
    const owner = (node: Konva.Node): Konva.Node => {
      for (let p: Konva.Node | null = node; p; p = p.getParent()) if (authored.has(p)) return p;
      return node;
    };
    const flagged = new Set<string>();

    for (const node of ctx.comp.find(() => true) as Konva.Node[]) {
      if (node.nodeType === "Layer" || !node.isVisible()) continue;
      const who = owner(node);
      for (const color of colorsOf(node)) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
        if (!users.has(color)) users.set(color, { node: who, frame });
        const key = `${who._id}:${color}`;
        if (palette && !palette.has(color) && !flagged.has(key)) {
          flagged.add(key);
          hits.push({ node: who, code: "style/color", frame, details: { color } });
        }
      }
    }

    for (const node of authored) {
      if (!hasProbeText(node) || !node.isVisible() || !(node.getAbsoluteOpacity() > 0)) continue;
      const { font } = node._kmProbeText();
      families.set(font.family, frame);
      if (font.loaded === false) {
        hits.push({
          node,
          code: "style/fallback-font",
          frame,
          details: { family: font.family, weight: font.weight },
        });
      }
      if (fonts) {
        const weights = fonts.get(font.family);
        if (!weights || (weights.size > 0 && !weights.has(font.weight))) {
          hits.push({
            node,
            code: "style/font",
            frame,
            details: { family: font.family, weight: font.weight },
          });
        }
      }
    }
  }

  const colorsInUse = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  if (!palette) {
    for (let i = 0; i < colorsInUse.length; i++) {
      for (let j = i + 1; j < colorsInUse.length; j++) {
        const more = colorsInUse[i] as string;
        const less = colorsInUse[j] as string;
        if (!close(more, less)) continue;
        const user = users.get(less);
        if (user) {
          hits.push({
            node: user.node,
            code: "style/near-duplicate",
            frame: user.frame,
            details: { color: less, near: more },
          });
        }
      }
    }
  }
  if (!fonts && families.size > 2) {
    const frame = Math.min(...families.values());
    hits.push({
      node: null,
      code: "style/font-families",
      frame,
      details: { families: [...families.keys()] },
    });
  }

  return { hits, colorsInUse };
}
