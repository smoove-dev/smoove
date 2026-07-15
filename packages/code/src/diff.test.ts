import { describe, expect, it } from "vitest";
import { type PatienceDiffResult, patienceDiff } from "./diff.js";

type Op = "keep" | "insert" | "delete";

function classify(result: PatienceDiffResult): [Op, string][] {
  return result.lines.map(({ line, aIndex, bIndex }) => {
    if (aIndex === -1) return ["insert", line];
    if (bIndex === -1) return ["delete", line];
    return ["keep", line];
  });
}

describe("patienceDiff", () => {
  it("marks every token kept when the arrays are identical", () => {
    const r = patienceDiff(["a", "b", "c"], ["a", "b", "c"]);
    expect(classify(r)).toEqual([
      ["keep", "a"],
      ["keep", "b"],
      ["keep", "c"],
    ]);
    expect(r.lineCountDeleted).toBe(0);
    expect(r.lineCountInserted).toBe(0);
  });

  it("marks appended tokens as inserted", () => {
    const r = patienceDiff(["a"], ["a", "b"]);
    expect(classify(r)).toEqual([
      ["keep", "a"],
      ["insert", "b"],
    ]);
    expect(r.lineCountInserted).toBe(1);
    expect(r.lineCountDeleted).toBe(0);
  });

  it("marks removed tokens as deleted", () => {
    const r = patienceDiff(["a", "b"], ["a"]);
    expect(classify(r)).toEqual([
      ["keep", "a"],
      ["delete", "b"],
    ]);
    expect(r.lineCountDeleted).toBe(1);
    expect(r.lineCountInserted).toBe(0);
  });

  it("represents a middle replacement as delete then insert around kept tokens", () => {
    const r = patienceDiff(["a", "x", "c"], ["a", "y", "c"]);
    const ops = classify(r);
    expect(ops[0]).toEqual(["keep", "a"]);
    expect(ops.at(-1)).toEqual(["keep", "c"]);
    expect(ops).toContainEqual(["delete", "x"]);
    expect(ops).toContainEqual(["insert", "y"]);
    expect(r.lineCountDeleted).toBe(1);
    expect(r.lineCountInserted).toBe(1);
  });
});
