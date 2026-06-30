import { zoomBlur } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type ZoomBlurProps } from "./schema.js";

export default transitionComp<ZoomBlurProps>("tr-zoom-blur", defaults, (p) =>
  zoomBlur({ rotation: p.rotation }),
);
