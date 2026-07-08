import { describe, expect, it } from "vitest";
import type { EffectPass } from "../src/effects/contract.js";
import { coalescePasses } from "../src/effects/passes.js";

const css = (f: string): EffectPass => ({ kind: "css", key: f, filter: f });
const px = (): EffectPass => ({ kind: "pixels", key: "p", run: () => {} });
const comp = (): EffectPass => ({ kind: "composite", key: "c", run: () => {} });

describe("coalescePasses", () => {
  it("joins consecutive css passes into one group", () => {
    const groups = coalescePasses([css("blur(4px)"), css("brightness(1.2)"), px()]);
    expect(groups.map((g) => g.kind)).toEqual(["css", "pixels"]);
    expect(groups[0].kind === "css" && groups[0].filter).toBe("blur(4px) brightness(1.2)");
  });

  it("batches consecutive pixels passes into one group, preserving order", () => {
    const groups = coalescePasses([px(), px(), comp(), px()]);
    expect(groups.map((g) => g.kind)).toEqual(["pixels", "composite", "pixels"]);
    expect(groups[0].kind === "pixels" && groups[0].runs.length).toBe(2);
  });

  it("keeps array order across kinds", () => {
    const sh: EffectPass = { kind: "shader", key: "s", fragment: "f", uniforms: {} };
    const groups = coalescePasses([comp(), sh, css("blur(2px)")]);
    expect(groups.map((g) => g.kind)).toEqual(["composite", "shader", "css"]);
  });
});
