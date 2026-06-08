import type { Presentation } from "../types.js";

export type ClockWipeProps = { width?: number; height?: number };

/**
 * Angular sweep: the incoming layer is clipped to a pie wedge that grows
 * clockwise from 12 o'clock to a full turn. Mirrors Remotion's `clockWipe`.
 * `width`/`height` default to the Composition stage size.
 */
export function clockWipe(props: ClockWipeProps = {}): Presentation {
  return {
    enter(layer, progress, dims) {
      const width = props.width ?? dims.width;
      const height = props.height ?? dims.height;
      const cx = width / 2;
      const cy = height / 2;
      // Oversized so the wedge always covers the rectangle's corners.
      const radius = Math.sqrt(width * width + height * height) / 2;
      const start = -Math.PI / 2; // 12 o'clock
      const sweep = Math.PI * 2 * progress;
      layer.clipFunc((ctx) => {
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + sweep, false);
        ctx.closePath();
      });
    },
    // Outgoing scene stays visible under the sweeping clock hand.
    exit() {},
  };
}
