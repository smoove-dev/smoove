import { defineRegistry, kf } from "@konva-motion/studio";
import { cohabit } from "./compositions/cohabit.js";
import { pulse } from "./compositions/pulse.js";
import { ribbon } from "./compositions/ribbon.js";

const ACCENTS = ["#7c5cff", "#2bd9c4", "#ff8a3d", "#ff5d8f", "#56b8ff"];

/** demo2's registry — two fresh, props-driven compositions (nothing ported). */
export const registry = defineRegistry([
  {
    id: "pulse",
    title: "Pulse",
    // group: "Motion",
    description:
      "A row of circles pulsing on a sine wave — edit the props to see the preview react live.",
    tags: ["motion", "loop", "props"],
    load: pulse,
    propsSchema: kf.object({
      fields: {
        title: kf.text({ label: "Title", default: "Pulse" }),
        accent: kf.color({ label: "Accent", default: "#7c5cff", swatches: ACCENTS }),
        count: kf.number({ label: "Circles", min: 3, max: 12, step: 1, default: 6 }),
        size: kf.number({
          label: "Base size",
          min: 20,
          max: 120,
          step: 2,
          default: 60,
          unit: "px",
        }),
      },
    }),
  },
  {
    id: "ribbon",
    title: "Ribbon",
    group: "Text",
    description:
      "Sweeping color ribbons behind an animated headline, with badges. Exercises every props-form field type.",
    tags: ["text", "layout", "props"],
    load: ribbon,
    propsSchema: kf.object({
      fields: {
        headline: kf.multiline({ label: "Headline", default: "Ribbon", rows: 2 }),
        align: kf.select({
          label: "Align",
          default: "center",
          options: [
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ],
        }),
        accent: kf.color({
          label: "Headline color",
          default: "#ffffff",
          swatches: ["#ffffff", ...ACCENTS],
        }),
        d1: kf.divider({ label: "Ribbons" }),
        showStripes: kf.boolean({ label: "Show ribbons", default: true }),
        stripes: kf.array({
          label: "Ribbons",
          itemLabel: "Ribbon",
          min: 1,
          max: 8,
          default: [
            { color: "#7c5cff", label: "one" },
            { color: "#2bd9c4", label: "two" },
            { color: "#ff8a3d", label: "three" },
          ],
          of: kf.object({
            fields: {
              color: kf.color({ label: "Color", default: "#7c5cff", swatches: ACCENTS }),
              label: kf.text({ label: "Label", default: "stripe" }),
            },
          }),
        }),
        d2: kf.divider({ label: "Meta" }),
        badges: kf.multiselect({
          label: "Badges",
          default: ["motion", "konva"],
          options: [
            { value: "new", label: "new" },
            { value: "motion", label: "motion" },
            { value: "konva", label: "konva" },
            { value: "studio", label: "studio" },
          ],
        }),
      },
    }),
  },
  {
    id: "cohabit",
    title: "Cohabit · 34s",
    group: "Film",
    description:
      "A four-scene branded promo — graded video, a layered music + voiceover + SFX mix, and a prop-driven end card.",
    tags: ["film", "video", "audio", "brand"],
    load: cohabit,
    propsSchema: kf.object({
      fields: {
        d0: kf.divider({ label: "Branding" }),
        accent: kf.color({
          label: "Accent color",
          default: "#2DD4BF",
          description:
            "Brand teal — drives the Scene 2 subtitle, the end-card line and the logo mark.",
        }),
        appName: kf.text({
          label: "App name",
          default: "Cohabit",
          description: "The Scene 2 hero caption.",
        }),
        d1: kf.divider({ label: "Scene 1 — the problem" }),
        headline: kf.multiline({
          label: "Opening headline",
          rows: 2,
          default: "Managing a building\nshouldn't feel like this.",
          description: "The cold-open lower third. Newlines are honored.",
        }),
        bubbleSize: kf.number({
          label: "Bubble text size",
          default: 34,
          min: 24,
          max: 52,
          step: 2,
          unit: "px",
        }),
        bubbles: kf.array({
          label: "Chat bubbles",
          itemLabel: "Bubble",
          min: 1,
          description: "The overwhelming chat noise that drifts up and fades in Scene 1.",
          of: kf.object({
            fields: {
              text: kf.text({ label: "Message", default: "New message" }),
              wide: kf.boolean({
                label: "Wrap wide",
                default: false,
                description: "Constrain the width so long text wraps onto multiple lines.",
              }),
            },
          }),
          default: [
            { text: "Dues?", wide: false },
            { text: "Leak again", wide: false },
            { text: "Meeting?", wide: false },
            { text: "Who's paying for\nthe plumber?", wide: true },
          ],
        }),
        d2: kf.divider({ label: "End card" }),
        logoWord: kf.select({
          label: "Logo wordmark",
          default: "ink",
          options: [
            { value: "ink", label: "Ink (dark)" },
            { value: "white", label: "White" },
          ],
        }),
        endCard: kf.object({
          label: "End card",
          description: "The final payoff card — tagline, CTA and accent line.",
          fields: {
            tagline: kf.text({ label: "Tagline", default: "Your building, handled." }),
            ctaLabel: kf.text({ label: "CTA label", default: "Start free →" }),
            ctaColor: kf.color({ label: "CTA color", default: "#2DD4BF" }),
            showAccentLine: kf.boolean({
              label: "Show accent line",
              default: true,
              description: "The line that draws left-to-right under the logo.",
            }),
          },
        }),
      },
    }),
  },
]);

// Dev hot-reload: when a composition's source changes, swap its builder in the
// registry. The studio rebuilds + remounts the active comp in place (preserving
// selection, props, and playhead) — no full page reload.
if (import.meta.hot) {
  import.meta.hot.accept(
    ["./compositions/pulse.js", "./compositions/ribbon.js", "./compositions/cohabit.js"],
    ([pulseMod, ribbonMod, cohabitMod]) => {
      if (pulseMod?.pulse) registry.update("pulse", pulseMod.pulse);
      if (ribbonMod?.ribbon) registry.update("ribbon", ribbonMod.ribbon);
      if (cohabitMod?.cohabit) registry.update("cohabit", cohabitMod.cohabit);
    },
  );
}
