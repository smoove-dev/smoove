// Animations from LottieFiles. Both are pure vector, with no embedded images
// and no fonts (the lettering is already outlined), so the animation JSON is
// imported directly and needs no URL resolved at render time.
//
// Two Lottie animations on one timeline. The robot is authored at 30 fps and
// the banner at 60, and both play on this composition's 30 fps clock: the node
// works out where each animation sits at every frame, so neither is dropping
// frames or running on a clock of its own.
import { Block, Composition, Flex, Rect, Sequence, Text } from "@smoove/core";
import { Lottie } from "@smoove/lottie";
import robot from "./assets/ai-robot.json";
import madeWithLottie from "./assets/made-with-lottie.json";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DURATION = 8 * FPS;

const INK = "#0d1117";
const PANEL = "#161b22";
const WHITE = "#e5e7eb";
const DIM = "#9ca3af";

const comp = new Composition({
  id: "lottie",
  fps: FPS,
  durationInFrames: DURATION,
  width: WIDTH,
  height: HEIGHT,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK }));

const caption = (text: string) => new Text({ text, fontSize: 15, fill: DIM });

const card = (width: number, node: Lottie, title: string, detail: string): Block => {
  const body = new Flex({
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  });
  body.add(node);
  body.add(new Text({ text: title, fontSize: 20, fill: WHITE, fontStyle: "bold" }));
  body.add(caption(detail));

  const shell = new Block({
    width,
    height: 540,
    background: PANEL,
    cornerRadius: 20,
    padding: 24,
  });
  shell.add(body);
  return shell;
};

const row = new Flex({
  x: 0,
  y: 0,
  width: WIDTH,
  height: HEIGHT,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 48,
  padding: 64,
});

row.add(
  card(
    360,
    new Lottie({ data: robot, width: 270, height: 360, loop: true }),
    "Robot",
    "30 fps source, looping",
  ),
);
row.add(
  card(
    700,
    new Lottie({ data: madeWithLottie, width: 620, height: 340, loop: true }),
    "Animated text",
    "60 fps source, resampled onto a 30 fps timeline",
  ),
);

main.add(row);
comp.add(main);

export default comp;
