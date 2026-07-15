import { parser } from "@lezer/javascript";
import { describe, expect, it } from "vitest";
import { LezerHighlighter } from "./lezer-highlighter.js";

const hl = new LezerHighlighter(parser);

describe("LezerHighlighter", () => {
  it("is ready immediately", () => {
    expect(hl.initialize()).toBe(true);
  });

  it("colors the leading keyword and spans the whole token", () => {
    const code = "const x = 7;";
    const cache = hl.prepare(code);
    const result = hl.highlight(0, cache); // the 'c' of const
    expect(result.color).not.toBeNull();
    expect(result.skipAhead).toBe("const".length);
  });

  it("returns a color for the numeric literal", () => {
    const code = "const x = 7;";
    const cache = hl.prepare(code);
    const idx = code.indexOf("7");
    const result = hl.highlight(idx, cache);
    expect(result.color).not.toBeNull();
    expect(result.skipAhead).toBe(1);
  });

  it("tokenizes into non-empty syntax pieces that reconstruct the source", () => {
    const code = "const x = 7;";
    const tokens = hl.tokenize(code);
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join("")).toBe(code);
  });
});
