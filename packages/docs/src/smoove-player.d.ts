import type { HTMLAttributes, RefAttributes } from "react";

// Ambient JSX typing for <smoove-player> and its control elements (a framework-
// agnostic set of web components from @smoove/player) so MDX/TSX can render
// them directly. Boolean attributes accept the JSX shorthand (`controls`) or an
// empty string. The control tags let a page compose a custom control bar inside
// <smoove-player> instead of the default one.
type BoolAttr = boolean | "";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "smoove-player": HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement> & {
        src?: string;
        controls?: BoolAttr;
        loop?: BoolAttr;
        autoplay?: BoolAttr;
        muted?: BoolAttr;
        volume?: number | string;
        playbackrate?: number | string;
        initialframe?: number | string;
      };
      "smoove-player-overlay": HTMLAttributes<HTMLElement>;
      "smoove-player-controls": HTMLAttributes<HTMLElement>;
      "smoove-player-controls-row": HTMLAttributes<HTMLElement>;
      "smoove-player-space": HTMLAttributes<HTMLElement> & { grow?: BoolAttr };
      "smoove-player-play-button": HTMLAttributes<HTMLElement> & {
        size?: "small" | "medium" | "large";
      };
      "smoove-player-play-toggle-button": HTMLAttributes<HTMLElement>;
      "smoove-player-progress": HTMLAttributes<HTMLElement>;
      "smoove-player-sound-control": HTMLAttributes<HTMLElement> & { collapsed?: BoolAttr };
      "smoove-player-time": HTMLAttributes<HTMLElement>;
      "smoove-player-loop-button": HTMLAttributes<HTMLElement>;
      "smoove-player-fullscreen-button": HTMLAttributes<HTMLElement>;
    }
  }
}
