// What this composition promises, checked by `npx smoove agent check` and by the
// "passes its checks" test. Times come from the beats, so retiming the plan
// moves them too.
import { appearsBy, before, defineChecks, keepsMoving, staysInFrame } from "@smoove/core/testing";
import comp, { beats, comfortaa, palette } from "./composition";

export default defineChecks(comp, {
  intent: [
    // The wordmark is on screen once the lockup is done.
    appearsBy(".wordmark", beats.lockup.end),
    // The dot comes first, then the bars it sweeps in.
    before(".dot", ".bar"),
    staysInFrame(".wordmark"),
    // The slogan's hold at the end is meant to sit still.
    keepsMoving({ except: [beats.slogan] }),
  ],
  style: { palette, fonts: [comfortaa] },
});
