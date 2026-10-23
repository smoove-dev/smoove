import { describe, expect, it } from "vitest";
import { clock } from "./runtime.js";

describe("clock", () => {
  it("reads seconds as m:ss, or h:mm:ss past an hour", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75.9)).toBe("1:15");
    expect(clock(3725, 1)).toBe("1:02:05.0");
  });

  it("carries a rounded-up second into the minute", () => {
    expect(clock(59.96, 1)).toBe("1:00.0");
    expect(clock(119.97, 1)).toBe("2:00.0");
    expect(clock(3599.99, 1)).toBe("1:00:00.0");
  });
});
