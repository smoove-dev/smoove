import { fade } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";

export default transitionComp("tr-fade", {}, () => fade());
