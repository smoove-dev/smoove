import Konva from "konva";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withDerivedWrites } from "../effects/dirty.js";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "./block.js";
import { Flex } from "./flex/flex.js";
import { Circle, Ellipse, Rect } from "./shapes.js";
import { layoutEpoch } from "./size.js";
import { Text } from "./text/text.js";

let n = 0;
function makeScene(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `size-${n}`,
    fps: 30,
    durationInFrames: 10,
    width: 1280,
    height: 720,
  });
  const seq = new Sequence();
  comp.add(seq);
  return { comp, seq };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("layout epoch", () => {
  it("bumps the epoch on an attr write", () => {
    const rect = new Konva.Rect();
    const e = layoutEpoch();
    rect.setAttr("fill", "red");
    expect(layoutEpoch()).toBeGreaterThan(e);
  });

  it("does not bump inside withDerivedWrites", () => {
    const rect = new Konva.Rect();
    const e = layoutEpoch();
    withDerivedWrites(() => rect.setAttr("fill", "blue"));
    expect(layoutEpoch()).toBe(e);
  });
});

describe("flexWidth / flexHeight", () => {
  it("warns once on flexWidth", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rect = new Konva.Rect();
    rect.setAttr("flexWidth", 1);
    rect.setAttr("flexWidth", 2);
    const calls = warn.mock.calls.filter((c) => String(c[0]).includes("flexWidth"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain("width()");
  });
});

describe("containers", () => {
  it("width() in an updater reflows on the same frame", () => {
    const { comp, seq } = makeScene();
    const row = new Block({ flexDirection: "row" });
    const a = new Block({ width: 100, height: 50 });
    const b = new Block({ width: 100, height: 50 });
    row.add(a, b);
    seq.add(row);
    seq.register((frame) => {
      if (frame === 1) a.width(300);
    });
    comp.setFrame(1);
    expect(b.x()).toBe(300);
  });

  it("reads are fresh after a set", () => {
    const { seq } = makeScene();
    const col = new Block({ width: 1280, flexDirection: "column" });
    const c = new Block({ height: 40 });
    col.add(c);
    seq.add(col);
    c.width("50%");
    expect(c.width()).toBe(640);
  });

  it("width() returns the declared px immediately", () => {
    const { seq } = makeScene();
    const col = new Block({ width: 1280, flexDirection: "column", alignItems: "flex-start" });
    const c = new Block({ height: 40 });
    col.add(c);
    seq.add(col);
    c.width(200);
    expect(c.width()).toBe(200);
  });

  it("auto returns a Block to hugging", () => {
    const { seq } = makeScene();
    const b = new Block({ width: 500 });
    b.add(new Block({ width: 120, height: 30 }));
    seq.add(b);
    b.width("auto");
    expect(b.width()).toBe(120);
  });

  it("root 100% fills the composition", () => {
    const { comp, seq } = makeScene();
    const b = new Block({ width: "100%", height: 100 });
    seq.add(b);
    comp.setFrame(0);
    expect(b.width()).toBe(1280);
  });

  it("hugging root Flex reports its size", () => {
    const { comp, seq } = makeScene();
    const f = new Flex({});
    f.add(new Block({ width: 90, height: 30 }));
    seq.add(f);
    comp.setFrame(0);
    expect(f.width()).toBe(90);
  });

  it("drawing never runs layout", () => {
    const { comp, seq } = makeScene();
    const row = new Block({ flexDirection: "row" });
    row.add(new Block({ width: 100, height: 50, background: "#f00" }));
    seq.add(row);
    comp.setFrame(1);
    const spy = vi.spyOn(row, "_kmComputeLayout");
    (row.getChildren()[2] as Konva.Node | undefined)?.setAttr("opacity", 0.5);
    seq.draw();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("leaves", () => {
  it("Circle width sets the radius", () => {
    const c = new Circle({ width: 100 });
    expect(c.radius()).toBe(50);
    expect(c.width()).toBe(100);
  });

  it("clone keeps a declared percent", () => {
    const r = new Rect({ height: 10 });
    r.width("50%");
    expect(r.clone().getAttr("__kmWidth")).toBe("50%");
  });

  it("setAttrs and config match width()", () => {
    const { seq } = makeScene();
    const row = new Block({ width: 1280, flexDirection: "row", alignItems: "flex-start" });
    const byConfig = new Rect({ width: "25%", height: 10 });
    const byAttrs = new Rect({ height: 10 });
    const bySetter = new Rect({ height: 10 });
    row.add(byConfig, byAttrs, bySetter);
    seq.add(row);
    // Konva types setAttrs' width as a number; at runtime it reaches the setter.
    byAttrs.setAttrs({ width: "25%" as unknown as number });
    bySetter.width("25%");
    expect([byConfig.width(), byAttrs.width(), bySetter.width()]).toEqual([320, 320, 320]);
  });

  it("wrapping Text reports its height", () => {
    const { seq } = makeScene();
    const col = new Block({ width: 1280, flexDirection: "column", alignItems: "flex-start" });
    const t = new Text({
      width: 200,
      fontSize: 20,
      text: "a long line of words that has to wrap across several lines in two hundred px",
    });
    col.add(t);
    seq.add(col);
    expect(t.height()).toBeGreaterThan(40);
  });
});

describe("config", () => {
  it("accepts auto in the config", () => {
    const { seq } = makeScene();
    const b = new Block({ width: "auto", height: "auto" });
    b.add(new Block({ width: 70, height: 20 }));
    seq.add(b);
    expect([b.width(), b.height()]).toEqual([70, 20]);
  });
});

describe("centred shapes", () => {
  it("a shrunk Ellipse sits in its slot", () => {
    const { seq } = makeScene();
    const row = new Block({ width: 500, flexDirection: "row", alignItems: "flex-start" });
    const a = new Rect({ width: 300, height: 40, flexShrink: 1 });
    const b = new Ellipse({ radiusX: 10, radiusY: 10, flexShrink: 1 });
    row.add(a, b);
    seq.add(row);
    b.width(300).height(40);
    // 600 of content in a 500 row: each gives up 50.
    expect(Math.round(b.width())).toBe(250);
    const box = b.getClientRect({ relativeTo: row });
    expect(Math.round(box.x)).toBe(250);
  });
});
