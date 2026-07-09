import { crossZoom } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { type CrossZoomProps, defaults } from "./schema.js";

export default transitionComp<CrossZoomProps>("tr-cross-zoom", defaults, (p) =>
  crossZoom({ strength: p.strength }),
);
