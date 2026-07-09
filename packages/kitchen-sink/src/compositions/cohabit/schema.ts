import { kf } from "@smoove/studio";

export type CohabitBubble = { text: string; wide: boolean };
export type CohabitEndCard = {
  tagline: string;
  ctaLabel: string;
  ctaColor: string;
  showAccentLine: boolean;
};
export type CohabitProps = {
  accent: string;
  appName: string;
  headline: string;
  bubbleSize: number;
  bubbles: CohabitBubble[];
  logoWord: "ink" | "white";
  endCard: CohabitEndCard;
};

export const schema = kf.object({
  fields: {
    d0: kf.divider({ label: "Branding" }),
    accent: kf.color({
      label: "Accent color",
      default: "#2DD4BF",
      description: "Brand teal — drives the Scene 2 subtitle, the end-card line and the logo mark.",
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
});
