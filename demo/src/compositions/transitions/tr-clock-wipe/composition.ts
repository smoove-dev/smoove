import { clockWipe } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";

export default transitionComp("tr-clock-wipe", {}, () => clockWipe());
