import type { SmoovePlayer } from "@smoove/player";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** Make `<km-player>` a typed intrinsic element (it's a custom element). */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "km-player": DetailedHTMLProps<HTMLAttributes<SmoovePlayer>, SmoovePlayer>;
    }
  }
}
