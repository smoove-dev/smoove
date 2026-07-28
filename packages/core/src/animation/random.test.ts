import { describe, expect, it } from "vitest";
import { random } from "./random.js";

describe("random", () => {
  it("is deterministic for a numeric seed", () => {
    const a = random(42);
    const b = random(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("is deterministic for a string seed", () => {
    const a = random("balloons");
    const b = random("balloons");
    expect(a()).toBe(b());
  });

  it("gives different streams for different seeds", () => {
    expect(random(1)()).not.toBe(random(2)());
    expect(random("a")()).not.toBe(random("b")());
  });

  it("stays inside [0, 1)", () => {
    const r = random(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range() stays inside its bounds", () => {
    const r = random(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = r.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it("int() is inclusive on both ends and hits both", () => {
    const r = random(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) seen.add(r.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("pick() returns a member of the array", () => {
    const r = random(7);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(r.pick(items));
    }
  });

  it("pick() throws on an empty array rather than returning undefined", () => {
    expect(() => random(7).pick([])).toThrow("random: pick() needs a non-empty array");
  });
});
