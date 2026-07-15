import { describe, expect, it } from "vitest";
import { defaultDiffer } from "./differ.js";
import { type CodeScope, isCodeFragment, parseCodeScope, resolveScope } from "./scope.js";
import { defaultTokenize } from "./tokenizer.js";

function diff(from: string, to: string) {
  const fragments = defaultDiffer(parseCodeScope(from), parseCodeScope(to), defaultTokenize);
  const scope: CodeScope = { progress: 0, fragments };
  return {
    fragments,
    before: resolveScope(scope, false),
    after: resolveScope(scope, true),
    changes: fragments.filter(isCodeFragment),
  };
}

describe("defaultDiffer", () => {
  it("round-trips both sides of a mid-line replacement", () => {
    const d = diff("const number = 7;", "const number = createSignal(7);");
    expect(d.before).toBe("const number = 7;");
    expect(d.after).toBe("const number = createSignal(7);");
    expect(d.changes.length).toBeGreaterThanOrEqual(1);
  });

  it("produces no change fragments for identical code", () => {
    const d = diff("const x = 1;", "const x = 1;");
    expect(d.changes).toHaveLength(0);
    expect(d.before).toBe("const x = 1;");
    expect(d.after).toBe("const x = 1;");
  });

  it("represents a pure insertion with an empty before side", () => {
    const d = diff("a", "a b");
    expect(d.before).toBe("a");
    expect(d.after).toBe("a b");
    expect(d.changes.every((c) => c.before === "")).toBe(true);
  });

  it("represents a pure deletion with an empty after side", () => {
    const d = diff("a b", "a");
    expect(d.before).toBe("a b");
    expect(d.after).toBe("a");
    expect(d.changes.some((c) => c.after === "")).toBe(true);
  });
});
