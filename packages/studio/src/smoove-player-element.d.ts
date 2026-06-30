import type { SmoovePlayer } from "@smoove/player";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** Make `<smoove-player>` a typed intrinsic element (it's a custom element). */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "smoove-player": DetailedHTMLProps<HTMLAttributes<SmoovePlayer>, SmoovePlayer>;
    }
  }
}
