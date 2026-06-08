import type { Presentation } from "../types.js";

export type WipeDirection = "from-left" | "from-right" | "from-top" | "from-bottom";

export type WipeProps = { direction?: WipeDirection };

/**
 * Reveal the incoming layer behind a moving rectangular edge (a `clipFunc` on
 * the incoming layer); the outgoing layer stays put underneath. Mirrors
 * Remotion's `wipe`.
 */
export function wipe(props: WipeProps = {}): Presentation {
  const direction = props.direction ?? "from-left";
  return {
    enter(layer, progress, { width, height }) {
      layer.clipFunc((ctx) => {
        switch (direction) {
          case "from-left":
            ctx.rect(0, 0, width * progress, height);
            break;
          case "from-right":
            ctx.rect(width * (1 - progress), 0, width * progress, height);
            break;
          case "from-top":
            ctx.rect(0, 0, width, height * progress);
            break;
          case "from-bottom":
            ctx.rect(0, height * (1 - progress), width, height * progress);
            break;
        }
      });
    },
    // Outgoing scene is untouched — it stays fully visible under the wipe.
    exit() {},
  };
}
