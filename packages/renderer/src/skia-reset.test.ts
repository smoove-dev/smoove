import "./register.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Composition, Rect, Sequence } from "@smoove/core";
import Konva from "konva";
import { afterAll, describe, expect, it, vi } from "vitest";
import { renderComposition } from "./render.js";
import { MediabunnyVideoSource } from "./video-source-mediabunny.js";

/**
 * skia-canvas records every draw and replays the whole recording on each pixel
 * read, and `clearRect` only appends to it. A canvas that is cleared and
 * redrawn every frame has to be `reset()` instead, or it keeps every frame it
 * ever drew: a minute of 1080p video grew a test run past 6 GB.
 */

type Raw = CanvasRenderingContext2D & { reset(): void };
const rawOf = (layer: Konva.Layer) => layer.getCanvas().getContext()._context as Raw;

/** A 40x40 layer off any stage; a layer takes its size from its stage otherwise. */
function layerOf(pixelRatio = 1) {
  const layer = new Konva.Layer();
  layer.getCanvas().setPixelRatio(pixelRatio);
  layer.getCanvas().setSize(40, 40);
  return layer;
}

describe("a full Konva clear on skia", () => {
  it("resets the recording", () => {
    const layer = layerOf();
    layer.add(new Konva.Rect({ x: 0, y: 0, width: 10, height: 10, fill: "red" }));
    const reset = vi.spyOn(rawOf(layer), "reset");
    layer.drawScene();
    layer.drawScene();
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("keeps the pixel ratio Konva set up, so shapes land where they did", () => {
    const layer = layerOf(2);
    layer.add(new Konva.Rect({ x: 10, y: 10, width: 10, height: 10, fill: "red" }));
    layer.drawScene();
    layer.drawScene();
    const at = (x: number, y: number) => Array.from(rawOf(layer).getImageData(x, y, 1, 1).data);
    expect(at(30, 30)).toEqual([255, 0, 0, 255]);
    expect(at(50, 50)).toEqual([0, 0, 0, 0]);
  });

  it("keeps the layer's smoothing setting", () => {
    const layer = layerOf();
    layer.imageSmoothingEnabled(false);
    layer.drawScene();
    expect(rawOf(layer).imageSmoothingEnabled).toBe(false);
  });

  it("leaves a partial clear alone", () => {
    const layer = layerOf();
    const reset = vi.spyOn(rawOf(layer), "reset");
    layer.getCanvas().getContext().clear({ x: 0, y: 0, width: 5, height: 5 });
    expect(reset).not.toHaveBeenCalled();
  });
});

describe("the node video source", () => {
  const dir = mkdtempSync(join(tmpdir(), "smoove-skia-reset-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("resets both of its canvases for every decoded frame", async () => {
    const file = join(dir, "clip.mp4");
    const comp = new Composition({
      id: "clip",
      width: 64,
      height: 64,
      fps: 30,
      durationInFrames: 12,
    });
    const seq = new Sequence();
    const box = new Rect({ width: 16, height: 16, fill: "#ff0000" });
    seq.add(box);
    seq.register((f) => box.x(f * 4));
    comp.add(seq);
    await renderComposition(comp, { output: file, mute: true });

    const source = new MediabunnyVideoSource();
    await source.load(file);
    const own = source as unknown as { _ctx: Raw; _scratchCtx: Raw };
    const ctx = vi.spyOn(own._ctx, "reset");
    const scratch = vi.spyOn(own._scratchCtx, "reset");
    for (let f = 1; f < 12; f++) await source.seek(f / 30);
    expect(ctx).toHaveBeenCalledTimes(11);
    expect(scratch).toHaveBeenCalledTimes(11);
    source.destroy();
  });
});
