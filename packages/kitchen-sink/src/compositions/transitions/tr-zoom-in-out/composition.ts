import { zoomInOut } from "@smoove/transitions";
import { transitionComp } from "../_shared.js";

export default transitionComp("tr-zoom-in-out", {}, () => zoomInOut());
