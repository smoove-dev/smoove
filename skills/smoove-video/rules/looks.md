# Looks

A look is a starting style you can copy whole: a palette, two fonts, a corner
radius, a stroke weight, a backdrop and a pace. Starting from one saves the
agent from inventing a palette and a font pairing for every video, and keeps
every scene of a video in one style. Use a look when the user gives no brand
to follow (see "With a brand" below if they do).

## Pick from the feel

Match the brief's feel line first, the subject second
([planning.md](planning.md)):

- Terminal: precise, technical, quick. Developer tools, APIs, data,
  changelogs.
- Editorial: calm, considered, trustworthy. Case studies, essays,
  explainers, reports.
- Warm Paper: friendly, human, homemade. Consumer apps, food, community,
  small business.
- Night Launch: loud, confident, a big moment. Launches, announcements,
  event promos.
- Studio Light: clean, capable, modern. Product spots, tutorials,
  onboarding.

## What a look holds

- `palette`: `bg` for the frame, `surface` for cards and panels, `fg` for
  main text, `muted` for secondary text and lines, `accent` for the one spot
  that pulls the eye. Every pair is checked for contrast: `fg` on `bg` and
  `surface` reads at any size, `muted` is safe for body text, and `accent`
  is meant for large type, shapes and fills.
- `fonts`: the font objects to add to the sequence. `display` and `body` are
  the faces to put on `Text`.
- `radius` and `stroke`: corner radius and line weight, both multiplied by
  the canvas factor `u` ([direction.md](direction.md)).
- `backdrop`: which background layer to build. Each look's section says how.
- `pace`: how motion should feel. Snappy means short entrances and hard
  stops; measured sits in the middle; unhurried means long eases and holds.

## Terminal

Monospace headlines over a quiet sans, on green-black. For the backdrop, draw
a grid of `Line`s at `stroke * u` in `muted`, at 10 to 15 percent opacity,
with cells of about 120 times `u`.

```ts
import IBMPlexSans from "@smoove/google-fonts/ibm-plex-sans";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";

const mono = new JetBrainsMono({ weights: ["800"] });
const plex = new IBMPlexSans({ weights: ["300"] });
export const terminal = {
  palette: { bg: "#0e1311", surface: "#17201c", fg: "#e3ece6", muted: "#8fa198", accent: "#4fdc8f" },
  fonts: [mono, plex],
  display: mono.face("800"),
  body: plex.face("300"),
  radius: 6,
  stroke: 2,
  backdrop: "grid",
  pace: "snappy",
} as const;
```

## Editorial

A heavy serif with a plain sans, on warm off-white, with square corners. For
the backdrop, set one word from the subject in the display face, very large,
in `muted` at 10 to 15 percent opacity, running off one edge of the frame.

```ts
import Fraunces from "@smoove/google-fonts/fraunces";
import WorkSans from "@smoove/google-fonts/work-sans";

const fraunces = new Fraunces({ weights: ["900"], styles: ["normal"] });
const work = new WorkSans({ weights: ["400"] });
export const editorial = {
  palette: { bg: "#f2ede4", surface: "#e7e0d3", fg: "#1c1915", muted: "#6b6359", accent: "#b8401a" },
  fonts: [fraunces, work],
  display: fraunces.face("900"),
  body: work.face("400"),
  radius: 0,
  stroke: 3,
  backdrop: "ghost-type",
  pace: "unhurried",
} as const;
```

## Warm Paper

A soft, chunky serif and a rounded sans, on cream, with generous corners. For
the backdrop, scatter about a hundred specks, 4 to 8 times `u` across, in
`muted` at 10 to 14 percent opacity. Place them once with `random(seed)` at
module scope and leave them still. Smaller dots read as grain on a monitor
but vanish once the video is compressed.

```ts
import Figtree from "@smoove/google-fonts/figtree";
import YoungSerif from "@smoove/google-fonts/young-serif";

const young = new YoungSerif({ weights: ["400"] });
const figtree = new Figtree({ weights: ["400"] });
export const warmPaper = {
  palette: { bg: "#fbf1e1", surface: "#f3e2c7", fg: "#2a1f17", muted: "#7a6656", accent: "#e0503a" },
  fonts: [young, figtree],
  display: young.face("400"),
  body: figtree.face("400"),
  radius: 28,
  stroke: 3,
  backdrop: "grain",
  pace: "measured",
} as const;
```

## Night Launch

A wide, heavy grotesque with a light serif for body copy, on deep indigo, with
yellow as the accent. For the backdrop, put one radial glow in `accent` behind
the subject, using the gradient recipe in [performance.md](performance.md).

```ts
import BricolageGrotesque from "@smoove/google-fonts/bricolage-grotesque";
import Newsreader from "@smoove/google-fonts/newsreader";

const bricolage = new BricolageGrotesque({ weights: ["800"] });
const newsreader = new Newsreader({ weights: ["300"] });
export const nightLaunch = {
  palette: { bg: "#0c0b16", surface: "#171530", fg: "#f5f2ff", muted: "#9a95b8", accent: "#ffd23f" },
  fonts: [bricolage, newsreader],
  display: bricolage.face("800"),
  body: newsreader.face("300"),
  radius: 16,
  stroke: 3,
  backdrop: "glow",
  pace: "snappy",
} as const;
```

## Studio Light

A geometric sans for headlines and a monospace for the rest, on cool white.
For the backdrop, place one large `Rect` in `surface` behind the subject,
covering about 60 percent of the frame and pushed toward one side.

```ts
import IBMPlexMono from "@smoove/google-fonts/ibm-plex-mono";
import SpaceGrotesk from "@smoove/google-fonts/space-grotesk";

const grotesk = new SpaceGrotesk({ weights: ["700"] });
const plexMono = new IBMPlexMono({ weights: ["400"] });
export const studioLight = {
  palette: { bg: "#f4f6f9", surface: "#e6eaf1", fg: "#11151d", muted: "#5b6475", accent: "#3a55f0" },
  fonts: [grotesk, plexMono],
  display: grotesk.face("700"),
  body: plexMono.face("400"),
  radius: 20,
  stroke: 2,
  backdrop: "block",
  pace: "measured",
} as const;
```

## Using a look

Copy one look into the composition, not all five: every look you paste
loads its fonts. Add its fonts to the sequence so playback waits for them,
then read everything else from the look:

```ts
const look = studioLight;
const u = Math.min(width, height) / 1080;
seq.add(...look.fonts);

seq.add(new Rect({ x: 0, y: 0, width, height, fill: look.palette.bg }));
const card = new Block({
  x: Math.round(90 * u),
  y: Math.round(560 * u),
  width: Math.round(width - 180 * u),
  flexDirection: "column",
  padding: Math.round(72 * u),
  gap: Math.round(32 * u),
  background: look.palette.surface,
  borderSize: look.stroke * u,
  borderColor: look.palette.muted,
  cornerRadius: look.radius * u,
});
card.add(new Text({ text: "Ship the demo", font: look.display, fontSize: Math.round(110 * u), fill: look.palette.fg, width: "100%", ellipsis: false }));
card.add(new Text({ text: "From script to video in one file.", font: look.body, fontSize: Math.round(34 * u), fill: look.palette.muted, width: "100%" }));
seq.add(card);
```

Declare the look in the composition's checks file, as
`style: { palette: look.palette, fonts: look.fonts }`, and `npx smoove agent check`
warns about any color or font that strays from it ([testing.md](testing.md)).

A look is a set. Taking the colors of one and the fonts of another is fine
when the plan says why; doing it by accident gives you neither.

## With a brand

When the user brings brand colors or fonts, keep a look's structure (radius,
stroke, backdrop and pace) and swap its palette and fonts for the brand's.
Pick the look whose structure fits the brand's feel, then follow the brand
rules in the "Color" section of [direction.md](direction.md).
