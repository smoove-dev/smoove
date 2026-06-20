import type { HTMLAttributes } from "react";

// Ambient JSX typing for <km-player> and its control elements (a framework-
// agnostic set of web components from @konva-motion/player) so MDX/TSX can render
// them directly. Boolean attributes accept the JSX shorthand (`controls`) or an
// empty string. The control tags let a page compose a custom control bar inside
// <km-player> instead of the default one.
type BoolAttr = boolean | "";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "km-player": HTMLAttributes<HTMLElement> & {
        src?: string;
        controls?: BoolAttr;
        loop?: BoolAttr;
        autoplay?: BoolAttr;
        muted?: BoolAttr;
        volume?: number | string;
        playbackrate?: number | string;
        initialframe?: number | string;
      };
      "km-player-overlay": HTMLAttributes<HTMLElement>;
      "km-player-controls": HTMLAttributes<HTMLElement>;
      "km-player-controls-row": HTMLAttributes<HTMLElement>;
      "km-player-space": HTMLAttributes<HTMLElement> & { grow?: BoolAttr };
      "km-player-play-button": HTMLAttributes<HTMLElement> & {
        size?: "small" | "medium" | "large";
      };
      "km-player-play-toggle-button": HTMLAttributes<HTMLElement>;
      "km-player-progress": HTMLAttributes<HTMLElement>;
      "km-player-sound-control": HTMLAttributes<HTMLElement> & { collapsed?: BoolAttr };
      "km-player-time": HTMLAttributes<HTMLElement>;
      "km-player-loop-button": HTMLAttributes<HTMLElement>;
      "km-player-fullscreen-button": HTMLAttributes<HTMLElement>;
    }
  }
}
