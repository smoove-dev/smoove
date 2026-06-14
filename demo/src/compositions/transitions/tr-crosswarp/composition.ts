import { crosswarp } from "@konva-motion/transitions";
import { transitionComp } from "../_shared.js";

export default transitionComp("tr-crosswarp", {}, () => crosswarp());
