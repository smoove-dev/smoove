import { dreamyZoom } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type DreamyZoomProps, defaults } from "./schema.js";

export default transitionComp<DreamyZoomProps>("tr-dreamy-zoom", defaults, (p) =>
  dreamyZoom({ rotation: p.rotation, scale: p.scale }),
);
