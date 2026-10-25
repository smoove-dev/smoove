// What this composition promises, checked by `npx smoove agent check` and by
// the "passes its checks" test.
import { appearsBy, defineChecks, staysInFrame } from "@smoove/core/testing";
import comp, { beats, palette, script, serif } from "./composition.js"; // the composition, next to this file

export default defineChecks(comp, {
  intent: [
    // The names are written by the time their scene settles.
    appearsBy(".name", beats.names.start.add(90)),
    appearsBy(".hero", beats.photo.start.add(30)),
    appearsBy(".day", beats.date.start.add(60)),
    staysInFrame(".name"),
  ],
  style: { palette, fonts: [script, serif] },
  allow: [
    {
      select: ".stage",
      checks: ["layout/safe-zone"],
      reason:
        "Sent on WhatsApp and Stories, which have no buttons down the side, so the invite is centered.",
    },
    {
      select: ".hero",
      checks: ["layout/off-canvas", "layout/safe-zone"],
      reason: "The hero photo bleeds to the edges on purpose, and pushes in slowly.",
    },
  ],
});
