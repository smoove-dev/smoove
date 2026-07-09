import { Composition, Easing, interpolate, Sequence } from "@smoove/core";
import Konva from "konva";

const SEEDS = ["aurora", "canyon", "reef", "savanna"];

const loadImage = (url: string): HTMLImageElement => {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  return img;
};

const width = 1280;
const height = 720;
const perSlide = 75;
const total = SEEDS.length * perSlide;
const comp = new Composition({
  id: "image-clip",
  fps: 30,
  durationInFrames: total,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: total });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const cx = width / 2;
const cy = height / 2;
const maxRadius = Math.hypot(width, height) / 2;

// Each slide gets a clipped group; updater mutates state.radius per frame.
const slides = SEEDS.map((seed) => {
  const state = { radius: 0 };
  const group = new Konva.Group({
    clipFunc: (ctx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, state.radius, 0, Math.PI * 2);
      ctx.closePath();
    },
  });
  const node = new Konva.Image({
    image: undefined,
    x: 0,
    y: 0,
    width,
    height,
  });
  group.add(node);
  main.add(group);
  const htmlImg = loadImage(
    `https://picsum.photos/seed/${seed}/${Math.round(width)}/${Math.round(height)}`,
  );
  htmlImg.onload = () => node.image(htmlImg);
  return { state, group };
});

// Ring drawn on top of the currently-growing clip edge.
const ring = new Konva.Circle({
  x: cx,
  y: cy,
  radius: 0,
  stroke: "#fff",
  strokeWidth: 3,
  opacity: 0.9,
  shadowColor: "#000",
  shadowBlur: 20,
  shadowOpacity: 0.6,
});
main.add(ring);

main.register((frame) => {
  const reveal = 45; // frames it takes for the clip to grow
  for (let i = 0; i < slides.length; i++) {
    const start = i * perSlide;
    const slide = slides[i];
    if (!slide) continue;

    if (frame < start) {
      slide.state.radius = 0;
    } else if (frame >= start + reveal) {
      slide.state.radius = maxRadius;
    } else {
      slide.state.radius = interpolate(frame, [start, start + reveal], [0, maxRadius], {
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }

  // Position the ring on the currently-revealing slide's edge.
  const index = Math.min(SEEDS.length - 1, Math.floor(frame / perSlide));
  const local = frame - index * perSlide;
  if (local <= reveal) {
    ring.radius(
      interpolate(local, [0, reveal], [0, maxRadius], {
        easing: Easing.inOut(Easing.cubic),
      }),
    );
    ring.opacity(interpolate(local, [0, reveal * 0.7, reveal], [1, 1, 0]));
  } else {
    ring.opacity(0);
  }
});

comp.add(main);
export default comp;
