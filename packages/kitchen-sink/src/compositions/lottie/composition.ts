// Animations from LottieFiles, supplied for these demos. Both are pure vector:
// no embedded images and no fonts (the lettering is already outlined), so the
// animation JSON is imported directly and needs no URL resolved at render time.
import { Block, Composition, Flex, Rect, Sequence, Text } from "@smoove/core";
import { Lottie } from "@smoove/lottie";
import robot from "../../files/lottie/ai-robot.json";
import madeWithLottie from "../../files/lottie/made-with-lottie.json";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
// The banner runs 8s at its own 60 fps, so an 8s timeline plays it once
// through while the 6s robot loops.
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

// A 30 fps animation on a 30 fps timeline: one source frame per composition
// frame, looping for as long as the sequence is on screen.
const robotCard = new Block({
  width: 360,
  height: 540,
  background: PANEL,
  cornerRadius: 20,
  padding: 24,
});
const robotBody = new Flex({
  width: "100%",
  height: "100%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
});
robotBody.add(new Lottie({ data: robot, width: 270, height: 360, loop: true }));
robotBody.add(new Text({ text: "Robot", fontSize: 20, fill: WHITE, fontStyle: "bold" }));
robotBody.add(caption("30 fps source, looping"));
robotCard.add(robotBody);

// A 60 fps animation on the same 30 fps timeline. The node works out where the
// animation sits at each composition frame instead of dropping every other one.
const bannerCard = new Block({
  width: 700,
  height: 540,
  background: PANEL,
  cornerRadius: 20,
  padding: 24,
});
const bannerBody = new Flex({
  width: "100%",
  height: "100%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
});
bannerBody.add(new Lottie({ data: madeWithLottie, width: 620, height: 340, loop: true }));
bannerBody.add(new Text({ text: "Animated text", fontSize: 20, fill: WHITE, fontStyle: "bold" }));
bannerBody.add(caption("60 fps source, resampled onto a 30 fps timeline"));
bannerCard.add(bannerBody);

row.add(robotCard);
row.add(bannerCard);
main.add(row);
comp.add(main);

export default comp;
