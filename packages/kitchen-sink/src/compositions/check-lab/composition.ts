// A lab for `smoove check`: every node below plants one problem the checks
// should find. Nothing here is a pattern to copy.
import { Block, Composition, interpolate, plan, Rect, random, Sequence, Text } from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";

const fps = 30;
const width = 1280;
const height = 720;

export const palette = { bg: "#0d1117", fg: "#e6edf3", muted: "#8b949e", accent: "#FFC23C" };
export const comfortaa = new Comfortaa({ weights: ["400", "700"] });

// hook and land carry the bugs; hold sits still for three seconds; outro moves again.
export const beats = plan({
  hook: { durationInFrames: 60 },
  land: { durationInFrames: 90 },
  hold: { durationInFrames: 90 },
  outro: { durationInFrames: 30 },
});

const comp = new Composition({
  id: "check-lab",
  fps,
  width,
  height,
  durationInFrames: beats.outro.end,
  plan: beats,
});

const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: palette.bg }));
base.add(comfortaa);

// A title that passes: the intents are written against it.
const title = new Text({
  name: "title",
  text: "Check lab",
  font: comfortaa.face("700"),
  fontSize: 72,
  fill: palette.fg,
  x: 80,
  y: 60,
  opacity: 0,
});
// Cut by an ellipsis through every beat.
const headline = new Text({
  name: "headline",
  text: "A headline far too long for the box it was given",
  font: comfortaa.face("400"),
  fontSize: 40,
  fill: palette.fg,
  width: 360,
  wrap: "none",
  x: 80,
  y: 170,
});
// Partly off the right edge.
const edge = new Text({
  name: "edge",
  text: "Off the edge",
  font: comfortaa.face("400"),
  fontSize: 40,
  fill: palette.fg,
  x: 1150,
  y: 240,
});
// Too faint against its background.
const faint = new Text({
  name: "faint",
  text: "Hard to read",
  font: comfortaa.face("400"),
  fontSize: 30,
  fill: "#2a2f37",
  x: 80,
  y: 300,
});
// A color outside the palette.
const stray = new Rect({ name: "stray", x: 80, y: 360, width: 60, height: 30, fill: "#ff00ff" });
// A font nobody declared.
const serif = new Text({
  name: "serif",
  text: "Georgia",
  fontFamily: "Georgia",
  fontSize: 30,
  fill: palette.fg,
  x: 160,
  y: 360,
});
// A ghost word that bleeds off the left edge, excused in the checks file.
const ghost = new Text({
  name: "ghost",
  text: "LAB",
  font: comfortaa.face("700"),
  fontSize: 240,
  fill: palette.muted,
  opacity: 0.12,
  x: -90,
  y: 420,
});
base.add(title, headline, edge, faint, stray, serif, ghost);

const titleIn = beats.hook.start.resolve();
const outroStart = beats.outro.start.resolve();
base.register((frame) => {
  title.opacity(
    interpolate(frame, [titleIn, titleIn + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // Moves in hook and land, holds through hold, moves again in the outro.
  const t =
    frame < beats.hold.start.resolve()
      ? frame
      : frame >= outroStart
        ? frame
        : beats.hold.start.resolve();
  title.x(80 + t * 0.4);
});

// The impure updaters live in their own sequence, over hook and land only, so
// the hold beat stays truly still.
const bugs = new Sequence({ from: 0, durationInFrames: beats.hold.start.resolve() });
const jitter = new Rect({
  name: "jitter",
  x: 700,
  y: 360,
  width: 30,
  height: 30,
  fill: palette.accent,
});
const drift = new Rect({
  name: "drift",
  x: 760,
  y: 360,
  width: 30,
  height: 30,
  fill: palette.accent,
});
const stepper = new Rect({
  name: "stepper",
  x: 820,
  y: 360,
  width: 30,
  height: 30,
  fill: palette.accent,
});
const clock = new Rect({
  name: "clock",
  x: 880,
  y: 360,
  width: 30,
  height: 30,
  fill: palette.accent,
});
const row = new Block({ x: 700, y: 440, width: 400, height: 60, flexDirection: "row", gap: 10 });
const chip = new Rect({ name: "chip", width: 40, height: 40, fill: palette.accent });
row.add(chip, new Rect({ width: 40, height: 40, fill: palette.accent }));
bugs.add(jitter, drift, stepper, clock, row);

const r = random("lab");
bugs.register((frame) => {
  jitter.y(360 + Math.random() * 10);
  drift.y(360 + r.range(0, 10));
  if (frame % 10 === 0) stepper.y(360 + frame / 10);
  clock.y(360 + (Date.now() % 10));
  chip.x(frame * 2);
});

comp.add(base);
comp.add(bugs);

export default comp;
