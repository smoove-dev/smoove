import { describe, expect, it } from "vitest";
import { applyEdits, insert, remove, replace } from "./edit.js";
import { word } from "./range.js";
import { type CodeScope, resolveScope } from "./scope.js";

function sides(base: string, edits: Parameters<typeof applyEdits>[1]) {
  const scope: CodeScope = { progress: 0, fragments: applyEdits(base, edits) };
  return {
    before: resolveScope(scope, false),
    after: resolveScope(scope, true),
  };
}

describe("applyEdits", () => {
  it("replaces a word in place", () => {
    const { before, after } = sides("const n = 7;", [replace(word(0, 6, 1), "value")]);
    expect(before).toBe("const n = 7;");
    expect(after).toBe("const value = 7;");
  });

  it("inserts at a point", () => {
    const { before, after } = sides("x", [insert([0, 0], "// hi\n")]);
    expect(before).toBe("x");
    expect(after).toBe("// hi\nx");
  });

  it("removes a word", () => {
    const { before, after } = sides("const n = 7;", [remove(word(0, 6, 1))]);
    expect(before).toBe("const n = 7;");
    expect(after).toBe("const  = 7;");
  });

  it("applies multiple edits with stable coordinates", () => {
    const { before, after } = sides("aaa bbb", [
      replace(word(0, 0, 3), "XXX"),
      replace(word(0, 4, 3), "YYY"),
    ]);
    expect(before).toBe("aaa bbb");
    expect(after).toBe("XXX YYY");
  });
});
