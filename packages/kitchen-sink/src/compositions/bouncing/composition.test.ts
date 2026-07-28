import { probeAt } from "@smoove/core/testing";
import { describe, expect, it } from "vitest";
import comp from "./composition.js";

describe("bouncing composition", () => {
  it("fills the frame with the ground colour", async () => {
    await comp.whenReady();
    const [bg] = probeAt(comp, 0, "Rect");
    expect(bg?.box).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(bg?.paint).toEqual({ kind: "color", color: "#0d1117" });
  });

  it("drops the ball from its start height to the eased midpoint", async () => {
    await comp.whenReady();

    const start = probeAt(comp, 0, "Circle")[0];
    expect(start?.visible).toBe(true);
    expect(start?.box).toEqual({ x: 610, y: 50, width: 60, height: 60 });

    const mid = probeAt(comp, 30, "Circle")[0];
    expect(mid?.box.y).toBeCloseTo(462.5, 3);
  });
});
