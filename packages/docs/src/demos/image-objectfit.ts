import { Composition, Easing, Image, interpolate, Rect, Sequence } from "@smoove/core";
import Konva from "konva";

/**
 * One source image, four objectFit modes, in boxes whose width breathes so each
 * mode's behaviour is visible in motion: cover crops to fill, contain letterboxes,
 * fill stretches, none keeps the native pixels (cropped by the box). The image is
 * loaded once per box from a URL; src strings load asynchronously.
 */
const FONT = "ui-sans-serif, system-ui, sans-serif";
const MUTED = "#7d8590";
const SRC = "https://picsum.photos/seed/smoove/640/640";

const width = 1280;
const height = 720;
const duration = 240;

const comp = new Composition({
  id: "image-objectfit",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

function label(text: string, x: number, y: number, w: number): Konva.Text {
  return new Konva.Text({
    x,
    y,
    width: w,
    align: "center",
    text,
    fontSize: 16,
    fontFamily: FONT,
    fill: MUTED,
  });
}

type Fit = "cover" | "contain" | "fill" | "none";
const fits: Fit[] = ["cover", "contain", "fill", "none"];

const gap = 32;
const baseW = 240;
const boxH = 360;
const totalW = baseW * 4 + gap * 3;
const startX = (width - totalW) / 2;
const boxY = 150;

const boxes = fits.map((fit, i) => {
  const slotX = startX + i * (baseW + gap);
  // A frame behind each image so the box bounds (and contain's letterbox) read.
  const frame = new Rect({
    x: slotX,
    y: boxY,
    width: baseW,
    height: boxH,
    fill: "#161b22",
    cornerRadius: 12,
  });
  main.add(frame);
  const img = new Image({
    x: slotX,
    y: boxY,
    width: baseW,
    height: boxH,
    src: SRC,
    objectFit: fit,
    cornerRadius: 12,
  });
  main.add(img);
  main.add(label(fit, slotX, boxY + boxH + 16, baseW));
  return { img, frame, slotX };
});

main.register((frame) => {
  // Breathe each box width from narrow to wide and back. Setting width() fires
  // Konva's widthChange, which re-fits the bitmap for the current objectFit.
  const w = interpolate(frame, [0, duration / 2, duration], [140, baseW, 140], {
    easing: Easing.inOut(Easing.sin),
  });
  for (const { img, frame: bg, slotX } of boxes) {
    const x = slotX + (baseW - w) / 2; // keep the box centered in its slot
    bg.width(w);
    bg.x(x);
    img.x(x);
    img.width(w);
  }
});

comp.add(main);
export default comp;
