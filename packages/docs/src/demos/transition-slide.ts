import { Composition, Rect, type Sequence, Text } from "@smoove/core";
import { TransitionSeries, linearTiming, slide, wipe } from "@smoove/transitions";

/**
 * A presentation decides how two scenes blend. slide() pushes the incoming layer
 * in from a direction while the outgoing one leaves the opposite side; wipe()
 * reveals the incoming layer behind a moving edge. Both run on the same
 * linearTiming, so only the look changes.
 */
const width = 1280;
const height = 720;
const sceneLen = 90;
const blend = 24;
const duration = 3 * sceneLen - 2 * blend;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "transition-slide",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

function buildScene(scene: { label: string; sub: string; fill: string }) {
  return (seq: Sequence) => {
    seq.add(new Rect({ x: 0, y: 0, width, height, fill: scene.fill }));
    seq.add(
      new Text({
        x: 0,
        y: height / 2 - 70,
        width,
        align: "center",
        text: scene.label,
        fontSize: 110,
        fontFamily: title,
        fontStyle: "bold",
        fill: "#0d1117",
      }),
    );
    seq.add(
      new Text({
        x: 0,
        y: height / 2 + 60,
        width,
        align: "center",
        text: scene.sub,
        fontSize: 28,
        fontFamily: mono,
        fill: "rgba(13, 17, 23, 0.65)",
      }),
    );
  };
}

const series = new TransitionSeries({ composition: comp });
series.scene(
  { durationInFrames: sceneLen },
  buildScene({ label: "One", sub: "slide from-right", fill: "#1f6feb" }),
);
series.transition({
  presentation: slide({ direction: "from-right" }),
  timing: linearTiming({ durationInFrames: blend }),
});
series.scene(
  { durationInFrames: sceneLen },
  buildScene({ label: "Two", sub: "wipe from-bottom", fill: "#bb8009" }),
);
series.transition({
  presentation: wipe({ direction: "from-bottom" }),
  timing: linearTiming({ durationInFrames: blend }),
});
series.scene(
  { durationInFrames: sceneLen },
  buildScene({ label: "Three", sub: "slide from-left", fill: "#1a7f76" }),
);

comp.add(series);
export default comp;
