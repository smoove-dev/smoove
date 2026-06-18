import { Composition, Rect, Sequence, Series, Text, interpolate } from "@konva-motion/core";

/**
 * Series lays scenes back-to-back and computes each Sequence's `from` for you.
 * Three scenes run in order; the second and third start with a small negative
 * offset so they overlap the scene before, fading in while the previous one fades
 * out. comp.add(series) expands it into one Sequence per scene.
 */
const width = 1280;
const height = 720;
const sceneLen = 100;
const overlap = -20;
// 3 scenes back-to-back, two of them overlapping by 20 frames each.
const duration = 3 * sceneLen + 2 * overlap;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "series-scenes",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// A base layer keeps a backdrop under the scenes while they cross-fade.
const base = new Sequence({ from: 0, durationInFrames: duration });
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(base);

const scenes = [
  { title: "Scene 1", offset: 0, fill: "#1f6feb" },
  { title: "Scene 2", offset: overlap, fill: "#bb8009" },
  { title: "Scene 3", offset: overlap, fill: "#1a7f76" },
];

const series = new Series({ from: 0 });

for (const scene of scenes) {
  series.add({ durationInFrames: sceneLen, offset: scene.offset }, (seq) => {
    const panel = new Rect({ x: 0, y: 0, width, height, fill: scene.fill });
    seq.add(panel);

    const heading = new Text({
      x: 0,
      y: height / 2 - 70,
      width,
      align: "center",
      text: scene.title,
      fontSize: 88,
      fontFamily: title,
      fontStyle: "bold",
      fill: "#0d1117",
    });
    seq.add(heading);

    const sub = new Text({
      x: 0,
      y: height / 2 + 50,
      width,
      align: "center",
      text: `offset ${scene.offset}`,
      fontSize: 30,
      fontFamily: mono,
      fill: "rgba(13, 17, 23, 0.65)",
    });
    seq.add(sub);

    // `local` is 0 on the scene's first visible frame, so the same fade works
    // wherever Series places it on the timeline.
    seq.register((local) => {
      const fade = interpolate(local, [0, 16, sceneLen - 16, sceneLen - 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      panel.opacity(fade);
      heading.opacity(fade);
      sub.opacity(fade);
    });
  });
}

comp.add(series);
export default comp;
