// Worked example for rules/transitions.md — requires the optional
// @smoove/transitions package (`pnpm add @smoove/transitions`). A two-scene
// A -> B cut using TransitionSeries: each scene is a plain `(seq) => { ... }`
// builder, and the `fade()` presentation overlaps their shared boundary.
import { Circle, Composition, Rect, type Sequence, Text } from "@smoove/core";
import { fade, linearTiming, TransitionSeries } from "@smoove/transitions";

const width = 1280;
const height = 720;
const sceneFrames = 60;
const transitionFrames = 30;
// Total span: scenes overlap by `transitionFrames`, so it's not a simple sum.
const duration = sceneFrames * 2 - transitionFrames;

const comp = new Composition({
  id: "transition-series",
  fps: 30,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const paintScene = (bg: string, fg: string, letter: string) => (seq: Sequence) => {
  seq.add(new Rect({ x: 0, y: 0, width, height, fill: bg }));
  seq.add(new Circle({ x: width / 2, y: height / 2, radius: 170, fill: fg }));
  seq.add(
    new Text({
      x: 0,
      y: height / 2 - 95,
      width,
      align: "center",
      text: letter,
      fontSize: 180,
      fontStyle: "700",
      fill: "#0d1117",
    }),
  );
};

const series = new TransitionSeries({ composition: comp });
series.scene({ durationInFrames: sceneFrames }, paintScene("#0d1117", "#4ea1ff", "A"));
series.transition({
  presentation: fade(),
  timing: linearTiming({ durationInFrames: transitionFrames }),
});
series.scene({ durationInFrames: sceneFrames }, paintScene("#2d0b1a", "#ffd166", "B"));

comp.add(series); // Composition.add accepts a SequenceProvider, same as Series
export default comp;
