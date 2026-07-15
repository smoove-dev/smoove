import { describe, expect, it } from "vitest";
import {
  type CodeContent,
  interpolateCode,
  interpolateEdit,
  interpolateSelection,
  resolveContent,
} from "./content.js";
import { replace } from "./edit.js";
import { word } from "./range.js";
import { type CodeScope, resolveScope } from "./scope.js";
import { defaultTokenize } from "./tokenizer.js";

const A = "const number = 7;";
const B = "const number = createSignal(7);";
const C = "const number = createSignal(0);";

describe("interpolateCode", () => {
  it("returns the first snapshot as static before the range", () => {
    expect(interpolateCode(-10, [0, 100], [A, B])).toEqual({
      kind: "static",
      value: A,
    });
  });

  it("returns the last snapshot as static after the range", () => {
    expect(interpolateCode(200, [0, 100], [A, B])).toEqual({
      kind: "static",
      value: B,
    });
  });

  it("returns a diff descriptor with local progress inside the range", () => {
    const c = interpolateCode(50, [0, 100], [A, B]) as Extract<CodeContent, { kind: "diff" }>;
    expect(c.kind).toBe("diff");
    expect(c.from).toBe(A);
    expect(c.to).toBe(B);
    expect(c.progress).toBeCloseTo(0.5);
  });

  it("selects the correct segment for a multi-stop range", () => {
    const c = interpolateCode(75, [0, 50, 100], [A, B, C]) as Extract<
      CodeContent,
      { kind: "diff" }
    >;
    expect(c.from).toBe(B);
    expect(c.to).toBe(C);
    expect(c.progress).toBeCloseTo(0.5);
  });
});

describe("interpolateEdit", () => {
  it("produces an edit descriptor with clamped progress", () => {
    const edits = [replace(word(0, 6, 6), "value")];
    const mid = interpolateEdit(30, [0, 60], A, edits);
    expect(mid).toMatchObject({ kind: "edit", base: A, progress: 0.5 });
    const after = interpolateEdit(999, [0, 60], A, edits);
    expect(after).toMatchObject({ kind: "edit", progress: 1 });
  });
});

describe("interpolateSelection", () => {
  it("normalizes a bare range and animates between sets", () => {
    const sel = interpolateSelection(15, [0, 30], [[], word(0, 0, 5)]);
    expect(sel).toMatchObject({ kind: "transition", progress: 0.5 });
    if (sel.kind === "transition") {
      expect(sel.from).toEqual([]);
      expect(sel.to).toEqual([word(0, 0, 5)]);
    }
  });
});

describe("resolveContent", () => {
  it("resolves a static string to a plain scope", () => {
    const scope = resolveContent(A, defaultTokenize);
    expect(resolveScope(scope, false)).toBe(A);
    expect(resolveScope(scope, true)).toBe(A);
  });

  it("resolves a diff descriptor into a scope carrying progress", () => {
    const content = interpolateCode(50, [0, 100], [A, B]);
    const scope: CodeScope = resolveContent(content, defaultTokenize);
    expect(scope.progress).toBeCloseTo(0.5);
    expect(resolveScope(scope, false)).toBe(A);
    expect(resolveScope(scope, true)).toBe(B);
  });

  it("resolves an edit descriptor by applying edits", () => {
    const content = interpolateEdit(60, [0, 60], A, [replace(word(0, 6, 6), "value")]);
    const scope = resolveContent(content, defaultTokenize);
    expect(resolveScope(scope, false)).toBe(A);
    expect(resolveScope(scope, true)).toBe("const value = 7;");
  });
});
