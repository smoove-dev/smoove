import type { Presentation } from "../types.js";

export type IrisProps = { width?: number; height?: number };

/**
 * Circular reveal: the incoming layer is clipped to a circle that grows from
 * the centre to cover the frame. Mirrors Remotion's `iris`. `width`/`height`
 * default to the Composition stage size.
 */
export function iris(props: IrisProps = {}): Presentation {
  return {
    enter(layer, progress, dims) {
      const width = props.width ?? dims.width;
      const height = props.height ?? dims.height;
      const maxRadius = Math.sqrt(width * width + height * height) / 2;
      const radius = maxRadius * progress;
      layer.clipFunc((ctx) => {
        ctx.arc(width / 2, height / 2, Math.max(radius, 0), 0, Math.PI * 2, false);
      });
    },
    // Outgoing scene stays visible under the expanding iris.
    exit() {},
  };
}
