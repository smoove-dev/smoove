import type Konva from "konva";
import type { Composition } from "../engine/composition.js";
import type { QuerySelector } from "../engine/timeline.js";
import { type MeasuredRect, measure } from "../layout/measure.js";

/** The paint a node actually resolved to, as opposed to what was configured. */
export type Paint =
  | { kind: "color"; color: string }
  | { kind: "gradient"; stops: (number | string)[] }
  | undefined;

/** One node's on-screen state at the current frame. */
export type Probe = {
  node: Konva.Node;
  /** Konva `name()`, the handle a `.selector` matches on. Empty when unnamed. */
  name: string;
  /** Stage-space axis-aligned bounds, via {@link measure}. */
  box: MeasuredRect;
  /** Effective opacity with every ancestor folded in. */
  opacity: number;
  /**
   * Whether this node paints: it and every ancestor are visible (which covers
   * sequence gating, since an inactive `Sequence` sets `visible(false)`) and
   * effective opacity is above zero.
   */
  visible: boolean;
  paint: Paint;
};

/** A node that can report the paint it resolved to (implemented by `Block`). */
type PaintProbe = { _kmProbePaint: () => Paint };

function hasPaintProbe(node: unknown): node is PaintProbe {
  return typeof (node as PaintProbe)._kmProbePaint === "function";
}

/** @internal The paint a node resolved to. Shared with the checks. */
export function readPaint(node: Konva.Node): Paint {
  if (hasPaintProbe(node)) return node._kmProbePaint();
  const shape = node as Konva.Node & Partial<Konva.Shape>;
  if (typeof shape.fillLinearGradientColorStops === "function") {
    const stops = shape.fillLinearGradientColorStops() ?? shape.fillRadialGradientColorStops?.();
    if (stops && stops.length > 0) return { kind: "gradient", stops };
  }
  if (typeof shape.fill === "function") {
    // Konva types `fill()` as `string | CanvasGradient`; a raw CanvasGradient
    // was set on the context directly and has no readable stops, so it reports
    // as no paint rather than a colour that isn't one.
    const fill = shape.fill();
    if (typeof fill === "string" && fill) return { kind: "color", color: fill };
  }
  return undefined;
}

/**
 * Read the on-screen state of every node under `root` matching `selector`, at
 * whatever frame the composition currently sits on. Pair with
 * {@link probeAt} to drive the clock first.
 *
 * Read-only: nothing here mutates the scene.
 */
export function probe(
  root: { find: (selector: QuerySelector) => Konva.Node[] },
  selector: QuerySelector = () => true,
): Probe[] {
  return root.find(selector).map((node) => {
    const opacity = node.getAbsoluteOpacity();
    return {
      node,
      name: node.name() ?? "",
      box: measure(node),
      opacity,
      visible: node.isVisible() && opacity > 0,
      paint: readPaint(node),
    };
  });
}

/** A point on the timeline: a global frame, or a time in seconds. */
export type At = number | { time: number };

/**
 * What a probe drives: any composition, whatever its props type. Only the
 * props-independent members are picked, so a `Composition<{ slogan: string }>`
 * is accepted as readily as an untyped one.
 */
export type ProbeTarget = Pick<Composition, "fps" | "setFrame" | "find">;

function toFrame(comp: ProbeTarget, at: At): number {
  return typeof at === "number" ? at : Math.round(at.time * comp.fps);
}

/**
 * Drive `comp` to `at` and probe there. This is the acceptance-criterion form:
 * a spec that says "26 on screen at 6.0s" becomes one assertion.
 *
 * The frame stays where it was driven to, so successive calls read as a
 * timeline walk rather than a set of independent probes.
 */
export function probeAt(comp: ProbeTarget, at: At, selector: QuerySelector = () => true): Probe[] {
  comp.setFrame(toFrame(comp, at));
  return probe(comp, selector);
}

/** How many matching nodes actually paint at `at`. */
export function countAt(comp: ProbeTarget, at: At, selector: QuerySelector = () => true): number {
  return probeAt(comp, at, selector).filter((p) => p.visible).length;
}
