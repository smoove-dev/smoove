import type { KmPlayer } from "@konva-motion/player";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** Make `<km-player>` a typed intrinsic element (it's a custom element). */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "km-player": DetailedHTMLProps<HTMLAttributes<KmPlayer>, KmPlayer>;
    }
  }
}
