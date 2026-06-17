import type { HTMLAttributes } from "react";

// Ambient JSX typing for <km-player> — a framework-agnostic Lit web component
// from @konva-motion/player — so MDX/TSX can render it directly. Boolean
// attributes accept the JSX shorthand (`controls`) or an empty string.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "km-player": HTMLAttributes<HTMLElement> & {
        src?: string;
        controls?: boolean | "";
        loop?: boolean | "";
        autoplay?: boolean | "";
        muted?: boolean | "";
        volume?: number | string;
        playbackrate?: number | string;
        initialframe?: number | string;
      };
    }
  }
}
