import type { Presentation } from "../types.js";

export type FlipDirection = "from-left" | "from-right" | "from-top" | "from-bottom";

export type FlipProps = { direction?: FlipDirection };

/**
 * Card-flip: the outgoing layer squashes to a thin line while the incoming
 * layer expands from one. This is a **fake** flip — Konva has no real 3D, so we
 * animate `scaleX`/`scaleY` (with a centring offset) rather than a perspective
 * rotation. Mirrors Remotion's `flip` visually, not its 3D transform.
 */
export function flip(props: FlipProps = {}): Presentation {
  const direction = props.direction ?? "from-left";
  const horizontal = direction === "from-left" || direction === "from-right";
  return {
    enter(layer, progress, { width, height }) {
      const s = progress; // 0 → flat, 1 → full
      if (horizontal) {
        layer.scaleX(s);
        layer.scaleY(1);
        layer.position({ x: (width * (1 - s)) / 2, y: 0 });
      } else {
        layer.scaleY(s);
        layer.scaleX(1);
        layer.position({ x: 0, y: (height * (1 - s)) / 2 });
      }
    },
    exit(layer, progress, { width, height }) {
      const s = 1 - progress; // 1 → full, 0 → flat
      if (horizontal) {
        layer.scaleX(s);
        layer.scaleY(1);
        layer.position({ x: (width * (1 - s)) / 2, y: 0 });
      } else {
        layer.scaleY(s);
        layer.scaleX(1);
        layer.position({ x: 0, y: (height * (1 - s)) / 2 });
      }
    },
  };
}
