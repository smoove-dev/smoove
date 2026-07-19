import { Composition, interpolate, Rect, Sequence, Series, Text } from "@smoove/core";

/**
 * Three named scenes; a cue badge anchored to series.marker("code") and an
 * until: span running from "code" until "outro" begins. Every anchor is a
 * marker, so changing any duration above moves the badge and the span with it.
 */
const width = 1280;
const height = 720;
const fps = 60;

const introLen = 100;
const codeLen = 120;
const outroLen = 100;
const duration = introLen + codeLen + outroLen;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "marker-cues",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// A base layer keeps a backdrop under the scenes while they fade.
const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(base);

const scenes = [
  { name: "intro", durationInFrames: introLen, fill: "#1f6feb" },
  { name: "code", durationInFrames: codeLen, fill: "#bb8009" },
  { name: "outro", durationInFrames: outroLen, fill: "#1a7f76" },
];

const series = new Series({ from: 0 });

for (const scene of scenes) {
  series.add({ durationInFrames: scene.durationInFrames, name: scene.name }, (seq) => {
    const panel = new Rect({ x: 0, y: 0, width, height, fill: scene.fill });
    seq.add(panel);

    const heading = new Text({
      x: 0,
      y: height / 2 - 110,
      width,
      align: "center",
      text: scene.name,
      fontSize: 88,
      fontFamily: title,
      fontStyle: "bold",
      fill: "#0d1117",
    });
    seq.add(heading);

    const len = scene.durationInFrames;
    seq.register((local) => {
      const fade = interpolate(local, [0, 14, len - 14, len - 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      panel.opacity(fade);
      heading.opacity(fade);
    });
  });
}

comp.add(series);

// The markers: views onto the named scenes, resolved on every read.
const code = series.marker("code");
const outro = series.marker("outro");

// A cue badge anchored 10 frames before "code" begins. Retime the intro and
// this sequence moves with the beat, no numbers to chase.
const cue = new Sequence({ from: code.start.add(-10), durationInFrames: 50 });
const badge = new Rect({
  x: width / 2 - 310,
  y: height / 2 + 10,
  width: 620,
  height: 84,
  cornerRadius: 42,
  fill: "#0d1117",
});
const badgeText = new Text({
  x: 0,
  y: height / 2 + 34,
  width,
  align: "center",
  text: "from: code.start.add(-10)",
  fontSize: 30,
  fontFamily: mono,
  fill: "#e6edf3",
});
cue.add(badge);
cue.add(badgeText);
cue.register((local) => {
  const pop = interpolate(local, [0, 10, 40, 49], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  badge.opacity(pop);
  badgeText.opacity(pop);
});

comp.add(cue);

// A span running from "code" until "outro" begins: the window is
// resolve(outro) - resolve(code), so it stretches when the beat moves.
const span = new Sequence({ from: code, until: outro });
const spanBar = new Rect({
  x: 100,
  y: height - 96,
  width: 0,
  height: 10,
  cornerRadius: 5,
  fill: "#bc8cff",
});
const spanLabel = new Text({
  x: 100,
  y: height - 70,
  width: width - 200,
  text: "from: code, until: outro",
  fontSize: 24,
  fontFamily: mono,
  fill: "#bc8cff",
});
span.add(spanBar);
span.add(spanLabel);
span.register((local) => {
  // durationInFrames resolves live from the two markers.
  const len = span.durationInFrames;
  spanBar.width(interpolate(local, [0, len - 1], [0, width - 200]));
});

comp.add(span);

export default comp;
