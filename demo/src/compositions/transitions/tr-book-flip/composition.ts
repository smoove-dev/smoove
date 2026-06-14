import { bookFlip } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";
import { type BookFlipProps, defaults } from "./schema.js";

export default transitionComp<BookFlipProps>("tr-book-flip", defaults, (p) =>
  bookFlip({ direction: p.direction }),
);
