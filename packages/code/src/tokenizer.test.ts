import { describe, expect, it } from "vitest";
import { defaultTokenize } from "./tokenizer.js";

describe("defaultTokenize", () => {
  it("keeps a run of whitespace as a single token", () => {
    expect(defaultTokenize("a  b")).toEqual(["a", "  ", "b"]);
  });

  it("emits each bracket as its own token", () => {
    expect(defaultTokenize("f(x)")).toEqual(["f", "(", "x", ")"]);
  });

  it("splits identifiers around brackets and whitespace", () => {
    expect(defaultTokenize("const n = 7;")).toEqual(["const", " ", "n", " ", "=", " ", "7;"]);
  });

  it("handles a newline as whitespace", () => {
    expect(defaultTokenize("a\nb")).toEqual(["a", "\n", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(defaultTokenize("")).toEqual([]);
  });
});
