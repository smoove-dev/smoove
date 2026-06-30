import { filmBurn } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";
import { defaults, type FilmBurnProps } from "./schema.js";

export default transitionComp<FilmBurnProps>("tr-film-burn", defaults, (p) =>
  filmBurn({ seed: p.seed }),
);
