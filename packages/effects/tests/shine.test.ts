import type { EffectFrameContext } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { shine } from "../src/shine.js";

const fc: EffectFrameContext = {
  frame: 0,
  time: 0,
  fps: 30,
  width: 200,
  height: 100,
  pixelRatio: 1,
};

type Call = { op: string; args: unknown[] };

function fakeCtx(calls: Call[]): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: (o: number, c: string) => calls.push({ op: "stop", args: [o, c] }),
  };
  return {
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    createLinearGradient: (...args: unknown[]) => {
      calls.push({ op: "gradient", args });
      return gradient;
    },
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
    set globalCompositeOperation(v: string) {
      calls.push({ op: "gco", args: [v] });
    },
    set fillStyle(_v: unknown) {},
  } as unknown as CanvasRenderingContext2D;
}

describe("shine", () => {
  it("draws a source-atop gradient band across the full region", () => {
    const fx = shine({ progress: 0.5 });
    const pass = fx.passes(fc)[0];
    if (pass.kind !== "composite") throw new Error("expected composite pass");
    const calls: Call[] = [];
    pass.run(fakeCtx(calls), fc);
    expect(calls.some((c) => c.op === "gco" && c.args[0] === "source-atop")).toBe(true);
    const fill = calls.find((c) => c.op === "fillRect");
    expect(fill?.args).toEqual([0, 0, 200, 100]);
  });

  it("moves the band with progress", () => {
    const at = (p: number): number[] => {
      const fx = shine({ progress: p, angle: 0 });
      const pass = fx.passes(fc)[0];
      const calls: Call[] = [];
      if (pass.kind === "composite") pass.run(fakeCtx(calls), fc);
      return calls.find((c) => c.op === "gradient")?.args as number[];
    };
    const [x0a] = at(0.1);
    const [x0b] = at(0.9);
    expect(x0b).toBeGreaterThan(x0a as number);
  });

  it("folds progress into the pass key", () => {
    const fx = shine({ progress: 0 });
    const k0 = fx.passes(fc)[0].key;
    fx.progress = 0.5;
    expect(fx.passes(fc)[0].key).not.toBe(k0);
  });
});
