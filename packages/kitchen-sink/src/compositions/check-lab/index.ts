import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "check-lab",
  title: "Check lab",
  group: "Basics",
  description:
    "Planted bugs for smoove check: impure updaters, a cut headline, low contrast and more.",
  tags: ["checks"],
  composition: () => import("./composition.js"),
  checks: () => import("./composition.check.js"),
};

export default entry;
