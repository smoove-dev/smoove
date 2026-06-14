import { zoomBlur } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type ZoomBlurProps, defaults } from "./schema.js";

export default transitionComp<ZoomBlurProps>("tr-zoom-blur", defaults, (p) =>
  zoomBlur({ rotation: p.rotation }),
);
