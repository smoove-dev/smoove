import type { Presentation } from "../types.js";

export type SlideDirection = "from-left" | "from-right" | "from-top" | "from-bottom";

export type SlideProps = { direction?: SlideDirection };

/**
 * Translate the incoming layer in from `direction` while pushing the outgoing
 * layer out the opposite side. Mirrors Remotion's `slide`.
 */
export function slide(props: SlideProps = {}): Presentation {
  const direction = props.direction ?? "from-left";
  return {
    enter(layer, progress, { width, height }) {
      const t = 1 - progress; // 1 → fully off-screen, 0 → in place
      switch (direction) {
        case "from-left":
          layer.position({ x: -width * t, y: 0 });
          break;
        case "from-right":
          layer.position({ x: width * t, y: 0 });
          break;
        case "from-top":
          layer.position({ x: 0, y: -height * t });
          break;
        case "from-bottom":
          layer.position({ x: 0, y: height * t });
          break;
      }
    },
    exit(layer, progress, { width, height }) {
      switch (direction) {
        case "from-left":
          layer.position({ x: width * progress, y: 0 });
          break;
        case "from-right":
          layer.position({ x: -width * progress, y: 0 });
          break;
        case "from-top":
          layer.position({ x: 0, y: height * progress });
          break;
        case "from-bottom":
          layer.position({ x: 0, y: -height * progress });
          break;
      }
    },
  };
}
