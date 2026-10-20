import { appearsBy, before, defineChecks, staysInFrame } from "@smoove/core/testing";
import comp, { beats, comfortaa, palette } from "./composition";

export default defineChecks(comp, {
  intent: [
    appearsBy(".title", beats.hook.start.add(15)),
    before(".title", ".nothing-here"),
    staysInFrame(".title"),
    before(".headline", ".title"),
  ],
  allow: [
    {
      select: ".ghost",
      checks: ["layout/off-canvas"],
      reason: "the ghost word bleeds off the left edge on purpose",
    },
    { select: ".gone", checks: ["layout"], reason: "a stale entry for a node that was removed" },
  ],
  style: { palette, fonts: [comfortaa] },
});
