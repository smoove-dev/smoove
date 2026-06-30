import { Circle, Composition, Easing, Rect, Sequence, interpolate } from "@smoove/core";

// The smallest thing that runs: one composition, one sequence, one shape whose
// position and opacity are a function of the current frame.
const width = 1280;
const height = 720;
const duration = 180; // 3 seconds at 60fps

const comp = new Composition({
  id: "first-tween",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence({ from: 0, durationInFrames: duration });
scene.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const ball = new Circle({ x: 0, y: height / 2, radius: 64, fill: "#4ea1ff" });
scene.add(ball);

scene.register((frame) => {
  // "Where is the ball at frame N?" The whole mental model in one line.
  ball.x(
    interpolate(frame, [0, duration - 1], [160, width - 160], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
  ball.opacity(interpolate(frame, [0, 30, duration - 30, duration - 1], [0, 1, 1, 0]));
});

comp.add(scene);

// In an app you'd mount and play it:
//   comp.setContainer(document.getElementById("scene"));
//   comp.play();
export default comp;
