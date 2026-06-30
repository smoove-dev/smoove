import { slide } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type SlideProps } from "./schema.js";

export default transitionComp<SlideProps>("tr-slide", defaults, (p) =>
  slide({ direction: p.direction }),
);
