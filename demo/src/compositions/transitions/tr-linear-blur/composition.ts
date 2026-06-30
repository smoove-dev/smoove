import { linearBlur } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type LinearBlurProps } from "./schema.js";

export default transitionComp<LinearBlurProps>("tr-linear-blur", defaults, (p) =>
  linearBlur({ intensity: p.intensity }),
);
