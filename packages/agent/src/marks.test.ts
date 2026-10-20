import { describe, expect, it } from "vitest";
import { closestMarked, coverage, dropFillers, MARK_MIN_COVER, selectMarked } from "./index.js";

const rect = { x: 0, y: 0, width: 100, height: 100 };

describe("coverage", () => {
  it("is 1 for a box fully inside the rectangle", () => {
    expect(coverage({ x: 10, y: 10, width: 20, height: 20 }, rect)).toBe(1);
  });

  it("is the share of the box's own area inside", () => {
    expect(coverage({ x: 50, y: 0, width: 100, height: 100 }, rect)).toBe(0.5);
  });

  it("is 0 for a box outside the rectangle", () => {
    expect(coverage({ x: 200, y: 0, width: 10, height: 10 }, rect)).toBe(0);
  });

  it("is 0 for a box with no area", () => {
    expect(coverage({ x: 10, y: 10, width: 0, height: 20 }, rect)).toBe(0);
  });
});

describe("selectMarked", () => {
  it("keeps boxes more than 60 percent inside, smallest first", () => {
    expect(MARK_MIN_COVER).toBe(0.6);
    const picked = selectMarked(
      [
        { n: "big", box: { x: 0, y: 0, width: 90, height: 90 } },
        { n: "exact", box: { x: 40, y: 0, width: 100, height: 100 } },
        { n: "small", box: { x: 10, y: 10, width: 10, height: 10 } },
        { n: "edge", box: { x: 39, y: 0, width: 100, height: 100 } },
        { n: "half", box: { x: 50, y: 0, width: 100, height: 100 } },
      ],
      rect,
    );
    expect(picked.map((p) => p.n)).toEqual(["small", "big", "edge"]);
    expect(picked[2]?.cover).toBeCloseTo(0.61);
  });

  it("keeps input order for boxes of equal area", () => {
    const picked = selectMarked(
      [
        { n: "a", box: { x: 0, y: 0, width: 10, height: 10 } },
        { n: "b", box: { x: 20, y: 20, width: 10, height: 10 } },
      ],
      rect,
    );
    expect(picked.map((p) => p.n)).toEqual(["a", "b"]);
  });
});

describe("dropFillers", () => {
  type Item = {
    n: string;
    box: { x: number; y: number; width: number; height: number };
    tagged: boolean;
    parent: Item | null;
  };
  const box = { x: 10, y: 10, width: 50, height: 20 };

  it("drops an untagged node that only fills an ancestor's box", () => {
    const text: Item = { n: "Text", box, tagged: true, parent: null };
    const inner: Item = { n: "Group", box: { ...box }, tagged: false, parent: text };
    const konvaText: Item = {
      n: "Konva.Text",
      box: { ...box, x: 10.2 },
      tagged: false,
      parent: inner,
    };
    const kept = dropFillers(
      [text, inner, konvaText],
      (i) => i.parent,
      (i) => i.tagged,
    );
    expect(kept.map((i) => i.n)).toEqual(["Text"]);
  });

  it("keeps a tagged node with its parent's box, and untagged parts with their own box", () => {
    const block: Item = { n: "Block", box, tagged: true, parent: null };
    const text: Item = { n: "Text", box: { ...box }, tagged: true, parent: block };
    const token: Item = {
      n: "token",
      box: { x: 12, y: 12, width: 8, height: 8 },
      tagged: false,
      parent: block,
    };
    const kept = dropFillers(
      [block, text, token],
      (i) => i.parent,
      (i) => i.tagged,
    );
    expect(kept.map((i) => i.n)).toEqual(["Block", "Text", "token"]);
  });
});

describe("closestMarked", () => {
  it("lists the three best-covered nodes, most covered first, leaving out untouched ones", () => {
    const picked = closestMarked(
      [
        { n: "a", box: { x: 50, y: 0, width: 100, height: 100 } },
        { n: "b", box: { x: 80, y: 0, width: 100, height: 100 } },
        { n: "c", box: { x: 0, y: 0, width: 200, height: 100 } },
        { n: "d", box: { x: 90, y: 0, width: 100, height: 100 } },
        { n: "out", box: { x: 300, y: 0, width: 10, height: 10 } },
      ],
      rect,
    );
    expect(picked.map((p) => p.n)).toEqual(["a", "c", "b"]);
    expect(picked[0]?.cover).toBe(0.5);
  });
});
