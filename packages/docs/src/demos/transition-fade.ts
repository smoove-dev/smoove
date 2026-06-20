import { Composition, Rect, type Sequence, Text } from "@konva-motion/core";
import { TransitionSeries, fade, linearTiming } from "@konva-motion/transitions";

/**
 * TransitionSeries is Series with overlap. Three scenes play in order, joined by
 * a fade(): the incoming scene's layer fades up while the outgoing one fades
 * down over the shared frames. linearTiming drives that 0 to 1 blend evenly.
 */
const width = 1280;
const height = 720;
const sceneLen = 80;
const blend = 20;
// Net duration = sum of scenes minus sum of transitions (each overlap eats
// `blend` frames). Match the composition length so the loop is seamless.
const duration = 3 * sceneLen - 2 * blend;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "transition-fade",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scenes = [
  { label: "One", fill: "#1f6feb" },
  { label: "Two", fill: "#bb8009" },
  { label: "Three", fill: "#1a7f76" },
];

// Each scene is an opaque full-canvas panel so the fade reads as a clean blend.
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
        text: "fade · linearTiming",
        fontSize: 28,
        fontFamily: mono,
        fill: "rgba(13, 17, 23, 0.65)",
      }),
    );
  };
}

const series = new TransitionSeries({ composition: comp });
series.scene({ durationInFrames: sceneLen }, buildScene(scenes[0]));
series.transition({ presentation: fade(), timing: linearTiming({ durationInFrames: blend }) });
series.scene({ durationInFrames: sceneLen }, buildScene(scenes[1]));
series.transition({ presentation: fade(), timing: linearTiming({ durationInFrames: blend }) });
series.scene({ durationInFrames: sceneLen }, buildScene(scenes[2]));

comp.add(series);
export default comp;
