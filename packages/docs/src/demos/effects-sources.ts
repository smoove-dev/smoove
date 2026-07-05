import { Composition, Flex, Sequence, Text } from "@smoove/core";
import { GodRays, MeshGradient, Metaballs, Waves } from "@smoove/effects";

/**
 * Shader sources are layout-aware nodes: their pixels come from a fragment
 * shader (ported from paper-design/shaders), they animate off the composition
 * clock, and flex sizes them like any other child.
 */
const width = 1280;
const height = 720;
const fps = 30;
const duration = fps * 8;

const comp = new Composition({
  id: "effects-sources",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence();

scene.add(
  new MeshGradient({ width, height, colors: ["#0b1020", "#1d4ed8", "#9333ea"], speed: 0.5 }),
);

const row = new Flex({
  x: 60,
  y: 180,
  width: width - 120,
  height: 360,
  flexDirection: "row",
  gap: 40,
});
row.add(new Metaballs({ flexGrow: 1, height: 360, colors: ["#ff5500", "#ffc105"], count: 8 }));
row.add(new Waves({ flexGrow: 1, height: 360, colorFront: "#ffbb00", colorBack: "#1a1030" }));
row.add(new GodRays({ flexGrow: 1, height: 360, midIntensity: 0.6 }));
scene.add(row);

scene.add(
  new Text({
    x: 0,
    y: 590,
    width,
    text: "MeshGradient · Metaballs · Waves · GodRays",
    fontSize: 40,
    align: "center",
    fill: "#ffffff",
  }),
);

comp.add(scene);

export default comp;
