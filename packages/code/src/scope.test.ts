import { describe, expect, it } from "vitest";
import {
  type CodeScope,
  isCodeFragment,
  isCodeScope,
  parseCodeScope,
  resolveScope,
} from "./scope.js";

describe("parseCodeScope", () => {
  it("wraps a bare string as a single-fragment scope at progress 0", () => {
    expect(parseCodeScope("const n = 7;")).toEqual({
      progress: 0,
      fragments: ["const n = 7;"],
    });
  });

  it("wraps a tag array as a scope at progress 0", () => {
    const tags = ["a", { before: "b", after: "c" }];
    expect(parseCodeScope(tags)).toEqual({ progress: 0, fragments: tags });
  });

  it("passes a scope through unchanged", () => {
    const scope: CodeScope = { progress: 0.5, fragments: ["x"] };
    expect(parseCodeScope(scope)).toBe(scope);
  });
});

describe("resolveScope", () => {
  const scope: CodeScope = {
    progress: 0,
    fragments: ["const number = ", { before: "7", after: "createSignal(7)" }, ";"],
  };

  it("resolves the before side when isAfter is false", () => {
    expect(resolveScope(scope, false)).toBe("const number = 7;");
  });

  it("resolves the after side when isAfter is true", () => {
    expect(resolveScope(scope, true)).toBe("const number = createSignal(7);");
  });

  it("resolves nested scopes by their own progress via a predicate", () => {
    const nested: CodeScope = {
      progress: 0,
      fragments: ["a", { progress: 0.8, fragments: [{ before: "b", after: "B" }] }],
    };
    // predicate: a scope shows its after side once progress passes 0.5
    const result = resolveScope(nested, (s) => s.progress > 0.5);
    expect(result).toBe("aB");
  });
});

describe("type guards", () => {
  it("recognizes a scope", () => {
    expect(isCodeScope({ progress: 0, fragments: [] })).toBe(true);
    expect(isCodeScope({ before: "a", after: "b" })).toBe(false);
    expect(isCodeScope("x")).toBe(false);
  });

  it("recognizes a fragment", () => {
    expect(isCodeFragment({ before: "a", after: "b" })).toBe(true);
    expect(isCodeFragment({ progress: 0, fragments: [] })).toBe(false);
    expect(isCodeFragment("x")).toBe(false);
  });
});
