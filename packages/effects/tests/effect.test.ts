import { describe, expect, it } from "vitest";
import { Effect } from "../src/effect.js";
import type { ParamSchema } from "../src/params.js";

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 5, min: 0, max: 10 },
};
const FRAG = "void main() {}";

class TestEffect extends Effect {
  constructor(config: { amount?: number; enabled?: boolean } = {}) {
    super(SCHEMA, FRAG, config);
  }
}
// biome-ignore lint/correctness/noUnusedVariables: declaration-merged accessor types for TestEffect.
interface TestEffect {
  amount(): number;
  amount(v: number): this;
}

const CTX = { frame: 0, time: 0, fps: 30, width: 10, height: 10, pixelRatio: 1 };

describe("Effect", () => {
  it("generates getter/setter accessors from the schema", () => {
    const e = new TestEffect();
    expect(e.amount()).toBe(5);
    expect(e.amount(7)).toBe(e); // setter chains
    expect(e.amount()).toBe(7);
  });
  it("takes constructor config", () => {
    expect(new TestEffect({ amount: 2 }).amount()).toBe(2);
  });
  it("enable()/enabled() and pass emission", () => {
    const e = new TestEffect();
    expect(e.enabled()).toBe(true);
    e.enable(false);
    expect(e.enabled()).toBe(false);
    const passes = e._kmPasses(CTX);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.fragment).toBe(FRAG);
    expect(passes[0]?.uniforms.u_amount).toBe(5);
  });
  it("redraws attached nodes' layers on param change", () => {
    const e = new TestEffect();
    let drawn = 0;
    const fakeLayer = { batchDraw: () => drawn++ };
    const fakeNode = { getLayer: () => fakeLayer } as never;
    e._kmAttach(fakeNode);
    e.amount(9);
    e.enable(false);
    expect(drawn).toBe(2);
    e._kmDetach(fakeNode);
    e.amount(3);
    expect(drawn).toBe(2);
  });
});
