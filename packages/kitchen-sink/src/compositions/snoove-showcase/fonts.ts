/**
 * One instance per family for the whole composition.
 *
 * A `Font` is a Konva node, so it can only live in one parent — these are
 * added once, to the always-on bed sequence, which keeps them loaded (and the
 * composition buffering on them) for every scene.
 */
import Comfortaa from "@smoove/google-fonts/comfortaa";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";

/** Display face: the wordmark, headings, and scene titles. */
export const comfortaa = new Comfortaa({ weights: ["400", "700"] });

/** Code face: the API snippet in the code scene. */
export const mono = new JetBrainsMono({ weights: ["400", "700"] });
