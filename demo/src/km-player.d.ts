import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** JSX typings for the @konva-motion/player web components used in the demo. */
type WC<T = HTMLElement> = DetailedHTMLProps<HTMLAttributes<T>, T> & Record<string, unknown>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "km-player": WC;
      "km-player-overlay": WC;
      "km-player-play-button": WC;
      "km-player-controls": WC;
      "km-player-controls-row": WC;
      "km-player-play-toggle-button": WC;
      "km-player-sound-control": WC;
      "km-player-time": WC;
      "km-player-space": WC;
      "km-player-loop-button": WC;
      "km-player-fullscreen-button": WC;
      "km-player-progress": WC;
    }
  }
}
