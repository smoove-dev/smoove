import Konva from "konva";
import { describe, expect, it } from "vitest";
import type { ImageLoader, LoadedImage } from "../engine/runtime-defaults.js";
import { Flex } from "./flex/flex.js";
import { Image } from "./image.js";

// Regression: an unsized Image reports its bitmap's natural size, but that is
// a starting size the flex algorithm can still override, as in CSS. Pinning it
// as a fixed width/height broke the kitchen-sink flex-row-grow demo.

function bitmap(width: number, height: number): ImageLoader {
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, "naturalWidth", { value: width });
  Object.defineProperty(canvas, "naturalHeight", { value: height });
  return () => Promise.resolve(canvas as unknown as LoadedImage);
}

async function row(images: Image[]): Promise<Flex> {
  const r = new Flex({
    width: 1240,
    height: 280,
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  });
  for (const img of images) r.add(img);
  await Promise.all(images.map((i) => i.whenLoaded?.() ?? Promise.resolve()));
  await new Promise((res) => setTimeout(res, 0));
  r.computeLayout();
  return r;
}

describe("unsized Image in a growing row", () => {
  it("stretches to the row's height", async () => {
    const imgs = [0, 1].map(() => new Image({ src: "a", loader: bitmap(600, 600), flexGrow: 1 }));
    await row(imgs);
    expect(imgs.map((i) => i.height())).toEqual([280, 280]);
  });

  it("fits the row instead of overflowing it", async () => {
    const imgs = [0, 1, 2, 3].map(
      () => new Image({ src: "a", loader: bitmap(600, 600), flexGrow: 1 }),
    );
    await row(imgs);
    const last = imgs[3] as Image;
    expect(last.x() + last.width()).toBeLessThanOrEqual(1240.5);
  });

  it("shares the row by flexGrow from a zero basis", async () => {
    const imgs = [4, 1, 1, 1].map(
      (g) => new Image({ src: "a", loader: bitmap(600, 600), flexGrow: g, flexBasis: 0 }),
    );
    await row(imgs);
    const free = 1240 - 3 * 10;
    expect(imgs.map((i) => Math.round(i.width()))).toEqual([
      Math.round((free * 4) / 7),
      Math.round(free / 7),
      Math.round(free / 7),
      Math.round(free / 7),
    ]);
  });

  it("still reports the natural size with nothing to stretch it", async () => {
    const img = new Image({ src: "a", loader: bitmap(600, 400) });
    const r = new Flex({ flexDirection: "row", alignItems: "flex-start" });
    r.add(img);
    await new Promise((res) => setTimeout(res, 0));
    r.computeLayout();
    expect([img.width(), img.height()]).toEqual([600, 400]);
  });
});
