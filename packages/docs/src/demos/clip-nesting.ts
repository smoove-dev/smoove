import { Block, Clip, Composition, Rect, Sequence, Text } from "@smoove/core";

/**
 * A sequence holding a clip, which holds a clip of its own. Each panel shows
 * the local frame its own timeline is on, so you can watch three clocks run at
 * three different zeros. The inner clips are hidden while the playhead is
 * outside their window, and the outer clip closing takes the inner one with it.
 */
const width = 1280;
const height = 720;
const fps = 30;
const duration = fps * 6; // 180 frames

const comp = new Composition({
  id: "clip-nesting",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const INK = "#0d1117";
const TRACK = "#1f2933";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";

const scene = new Sequence();
scene.add(new Rect({ x: 0, y: 0, width, height, fill: INK }));
comp.add(scene);

// outer: frames 30 to 150 of the composition.
// inner: frames 40 to 100 of the OUTER clip, so 70 to 130 of the composition.
const outer = new Clip({ from: 30, durationInFrames: 120 });
const inner = new Clip({ from: 40, durationInFrames: 60 });
outer.add(inner);
scene.add(outer);

/** A panel that prints the local frame of whichever timeline owns it. */
function panel(title: string, subtitle: string, color: string, x: number): Block {
  const card = new Block({
    x,
    y: 150,
    width: 340,
    height: 260,
    background: TRACK,
    cornerRadius: 18,
    borderSize: 2,
    borderColor: color,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 20,
  });
  card.add(
    new Text({ text: title, fontSize: 26, fontStyle: "600", fontFamily: SANS, fill: color }),
  );
  card.add(new Text({ text: subtitle, fontSize: 14, fontFamily: MONO, fill: MUTED }));
  return card;
}

function clock(color: string): Text {
  return new Text({ text: "", fontSize: 44, fontFamily: MONO, fill: color });
}

const sceneCard = panel("sequence", "spans the composition", "#4cc9f0", 60);
const sceneClock = clock("#4cc9f0");
sceneCard.add(sceneClock);
scene.add(sceneCard);
scene.register((frame) => sceneClock.setText(`${frame}f`));

const outerCard = panel("clip", "from 30 · 120f", "#b5179e", 470);
const outerClock = clock("#b5179e");
outerCard.add(outerClock);
outer.add(outerCard);
outer.register((frame) => outerClock.setText(`${frame}f`));

const innerCard = panel("nested clip", "from 40 of the clip · 60f", "#80ffdb", 880);
const innerClock = clock("#80ffdb");
innerCard.add(innerClock);
inner.add(innerCard);
inner.register((frame) => innerClock.setText(`${frame}f`));

// A caption that names what is running right now.
const caption = new Text({
  x: 0,
  y: 470,
  width,
  align: "center",
  text: "",
  fontSize: 20,
  fontFamily: MONO,
  fill: MUTED,
});
scene.add(caption);
scene.register((frame) => {
  const inOuter = frame >= 30 && frame < 150;
  const inInner = frame >= 70 && frame < 130;
  const running = ["sequence", inOuter && "clip", inInner && "nested clip"].filter(Boolean);
  caption.setText(`running: ${running.join(" + ")}`);
});

export default comp;
