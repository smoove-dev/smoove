import { Composition, Rect, type Sequence, Text } from "@konva-motion/core";
import { TransitionSeries, slide, springTiming } from "@konva-motion/transitions";

/**
 * Timing reshapes the 0 to 1 progress a presentation reads. springTiming runs
 * the same slide() through a physics spring, so the incoming scene overshoots
 * its mark and settles back instead of arriving at a constant speed. The config
 * sets the bounce; durationInFrames pins the length so the loop stays clean.
 */
const width = 1280;
const height = 720;
const sceneLen = 110;
const blend = 36;
const duration = 2 * sceneLen - blend;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "transition-spring",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

function buildScene(scene: { label: string; fill: string }) {
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
        text: "slide · springTiming",
        fontSize: 28,
        fontFamily: mono,
        fill: "rgba(13, 17, 23, 0.65)",
      }),
    );
  };
}

const series = new TransitionSeries({ composition: comp });
series.scene({ durationInFrames: sceneLen }, buildScene({ label: "One", fill: "#1f6feb" }));
series.transition({
  presentation: slide({ direction: "from-right" }),
  timing: springTiming({ config: { damping: 12, stiffness: 120 }, durationInFrames: blend }),
});
series.scene({ durationInFrames: sceneLen }, buildScene({ label: "Two", fill: "#8957e5" }));

comp.add(series);
export default comp;
