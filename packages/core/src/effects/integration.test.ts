import Konva from "konva";
import { beforeEach, describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "../layout/block.js";
import { Text } from "../layout/text/text.js";
import type { EffectFrameContext, EffectPass, SmooveEffect } from "./contract.js";
import { peekContentVersion } from "./dirty.js";

/** Records the frame context it is handed, and floods the region. */
function recorder(seen: EffectFrameContext[]): SmooveEffect {
  return {
    _fxEffect: true,
    enabled: () => true,
    passes: (fc): EffectPass[] => {
      seen.push(fc);
      return [
        {
          kind: "composite",
          run: (ctx, c) => {
            ctx.fillStyle = "rgb(255,0,0)";
            ctx.fillRect(0, 0, c.width, c.height);
          },
        },
      ];
    },
    attach: () => {},
    detach: () => {},
  };
}

function pixelAt(layer: Konva.Layer, x: number, y: number): number[] {
  const ctx = layer.getCanvas().getContext() as unknown as {
    _context: CanvasRenderingContext2D;
  };
  const d = ctx._context.getImageData(x, y, 1, 1).data;
  return [d[0] as number, d[1] as number, d[2] as number, d[3] as number];
}

beforeEach(() => {
  Konva.pixelRatio = 1;
});

describe("effects inside a Composition", () => {
  it("wires a node's chain automatically during the frame pass", () => {
    const seen: EffectFrameContext[] = [];
    const comp = new Composition({
      id: "fx-test",
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const rect = new Konva.Rect({ x: 20, y: 20, width: 40, height: 40, fill: "black" });
    rect.setAttr("effects", [recorder(seen)]);
    seq.add(rect);
    comp.add(seq);

    comp.setFrame(0);

    expect(seen.length).toBeGreaterThan(0);
    expect(pixelAt(seq, 40, 40)).toEqual([255, 0, 0, 255]);
  });

  it("reports the sequence-local frame and the composition fps", () => {
    const seen: EffectFrameContext[] = [];
    const comp = new Composition({
      id: "fx-test",
      width: 100,
      height: 100,
      fps: 24,
      durationInFrames: 120,
    });
    const seq = new Sequence({ from: 10, durationInFrames: 60 });
    const rect = new Konva.Rect({ x: 10, y: 10, width: 20, height: 20, fill: "black" });
    rect.setAttr("effects", [recorder(seen)]);
    seq.add(rect);
    comp.add(seq);

    comp.setFrame(25);

    const last = seen[seen.length - 1] as EffectFrameContext;
    expect(last.fps).toBe(24);
    // Sequence starts at 10, so composition frame 25 is local frame 15.
    expect(last.frame).toBe(15);
    expect(last.time).toBeCloseTo(15 / 24);
  });

  it("advances time with the frame clock, never the wall clock", () => {
    const seen: EffectFrameContext[] = [];
    const comp = new Composition({
      id: "fx-test",
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 120,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 120 });
    const rect = new Konva.Rect({ x: 10, y: 10, width: 20, height: 20, fill: "black" });
    rect.setAttr("effects", [recorder(seen)]);
    seq.add(rect);
    comp.add(seq);

    comp.setFrame(0);
    // A non-activating frame only schedules `batchDraw`, which rides
    // requestAnimationFrame and never fires in Node. captureCanvas() forces the
    // synchronous scene draw — the same path @smoove/renderer takes per frame.
    comp.setFrame(60);
    comp.captureCanvas();
    const times = seen.map((fc) => fc.time);

    expect(times).toContain(0);
    expect(times).toContain(2);
  });

  it("picks up a chain assigned by an updater", () => {
    const seen: EffectFrameContext[] = [];
    const comp = new Composition({
      id: "fx-test",
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const rect = new Konva.Rect({ x: 20, y: 20, width: 40, height: 40, fill: "black" });
    seq.add(rect);
    seq.register(() => {
      if (!rect.getAttr("effects")) rect.setAttr("effects", [recorder(seen)]);
    });
    comp.add(seq);

    comp.setFrame(0);

    expect(seen.length).toBeGreaterThan(0);
  });

  it("holds an effected Block's content version steady across frames", () => {
    // Regression test for a 12x frame-rate bug. The flex pass re-writes its
    // children's sizes every tick, and painting a Block re-writes its private
    // background fill. Those writes used to look like real content changes, so
    // any card-shaped node invalidated itself several times per frame and rebuilt
    // its cached distance field from scratch every frame: measured at 17 fps
    // against 209 fps once the cache holds.
    const comp = new Composition({
      id: "fx-test",
      width: 400,
      height: 300,
      fps: 30,
      durationInFrames: 60,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const card = new Block({
      x: 40,
      y: 40,
      width: 300,
      flexDirection: "column",
      padding: 20,
      gap: 10,
      background: "#1a1520",
    });
    card.add(new Text({ text: "Heading", fontSize: 28, fill: "#ffffff", width: "100%" }));
    card.add(
      new Text({
        text: "Body copy that wraps onto a second line.",
        fontSize: 14,
        fill: "#888888",
        width: "100%",
      }),
    );
    card.setAttr("effects", [recorder([])]);
    seq.add(card);
    comp.add(seq);

    comp.setFrame(0);
    comp.captureCanvas();
    const settled = peekContentVersion(card);

    for (let frame = 1; frame <= 10; frame++) {
      comp.setFrame(frame);
      comp.captureCanvas();
    }

    expect(peekContentVersion(card)).toBe(settled);
  });

  it("still invalidates when content genuinely changes", () => {
    const comp = new Composition({
      id: "fx-test",
      width: 400,
      height: 300,
      fps: 30,
      durationInFrames: 60,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const card = new Block({
      x: 40,
      y: 40,
      width: 300,
      padding: 20,
      background: "#1a1520",
    });
    const label = new Text({ text: "before", fontSize: 20, fill: "#ffffff" });
    card.add(label);
    card.setAttr("effects", [recorder([])]);
    seq.add(card);
    comp.add(seq);

    comp.setFrame(0);
    comp.captureCanvas();
    const settled = peekContentVersion(card);

    label.setText("after");
    comp.setFrame(1);
    comp.captureCanvas();

    expect(peekContentVersion(card)).toBeGreaterThan(settled);
  });

  it("leaves a composition with no effects untouched", () => {
    const comp = new Composition({
      id: "fx-test",
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const rect = new Konva.Rect({ x: 20, y: 20, width: 40, height: 40, fill: "black" });
    seq.add(rect);
    comp.add(seq);

    comp.setFrame(0);

    expect(pixelAt(seq, 40, 40)).toEqual([0, 0, 0, 255]);
  });
});
