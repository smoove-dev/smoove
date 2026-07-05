import { describe, expect, it } from "vitest";
import type { ParamSchema } from "../src/params.js";
import { ShaderSource } from "../src/source.js";

const SCHEMA: ParamSchema = {
  speed: { type: "number", uniform: null, default: 1 },
  scale: { type: "number", uniform: "u_scale", default: 2 },
};

class TestSource extends ShaderSource {
  constructor(config: Record<string, unknown> = {}) {
    super(SCHEMA, "void main(){}", config);
  }
}
// biome-ignore lint/correctness/noUnusedVariables: declaration-merged accessor types for TestSource.
interface TestSource {
  scale(): number;
  scale(v: number): this;
}

describe("ShaderSource", () => {
  it("is a Konva shape with flex leaf role and schema accessors", () => {
    const s = new TestSource({ width: 100, height: 50, scale: 3 });
    expect(s._kmRole).toBe("leaf");
    expect(s.scale()).toBe(3);
    s.scale(4);
    expect(s.scale()).toBe(4);
    expect(s.width()).toBe(100);
  });
});
