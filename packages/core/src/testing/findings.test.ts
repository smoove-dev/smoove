import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "../layout/block.js";
import { Flex } from "../layout/flex/flex.js";
import { Text } from "../layout/text/text.js";
import {
  authoredNodes,
  type CheckBeat,
  describeNode,
  dropFillers,
  type Finding,
  groupSamples,
  type Hit,
  sortFindings,
} from "./findings.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `findings-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 640,
    height: 360,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 300 });
  comp.add(seq);
  return { comp, seq };
}

type Tagged = Konva.Node & { _smooveSource?: { file: string; line: number; column: number } };

describe("describeNode", () => {
  it("records the type, text, named ancestors and source tag", () => {
    const { comp, seq } = makeComp();
    const card = new Flex({ name: "card", width: 400, height: 200 });
    const title = new Text({ name: "title", text: "Launch day", fontSize: 32 });
    (title as Tagged)._smooveSource = { file: "src/promo.ts", line: 42, column: 17 };
    card.add(title);
    seq.add(card);
    comp.setFrame(0);

    const d = describeNode(title);
    expect(d.type).toBe("Text");
    expect(d.name).toBe("title");
    expect(d.text).toBe("Launch day");
    expect(d.ancestors).toEqual(["card"]);
    expect(d.source).toEqual({ file: "src/promo.ts", line: 42, column: 17, inherited: false });
  });

  it("inherits the nearest tagged ancestor's location", () => {
    const { seq } = makeComp();
    const group = new Konva.Group({ name: "outer" });
    (group as Tagged)._smooveSource = { file: "src/promo.ts", line: 10, column: 3 };
    const rect = new Konva.Rect({ width: 10, height: 10 });
    group.add(rect);
    seq.add(group);

    expect(describeNode(rect).source).toEqual({
      file: "src/promo.ts",
      line: 10,
      column: 3,
      inherited: true,
    });
  });
});

describe("authoredNodes", () => {
  it("leaves out layers, a Text's own parts and a Block's chrome", () => {
    const { comp, seq } = makeComp();
    const block = new Block({ name: "box", padding: 0, background: "#222" });
    const label = new Text({ name: "label", text: "Hi", fontSize: 24 });
    block.add(label);
    seq.add(block);
    comp.setFrame(0);

    const names = authoredNodes(comp).map((node) => node.name() || node.getClassName());
    expect(names).toEqual(["box", "label"]);
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

describe("groupSamples", () => {
  // One beat: starts at 0, fully revealed at 30, sheet frame 89, ends at 90.
  const beats: CheckBeat[] = [
    { name: "hook", start: 0, settled: 30, end: 90, heldTo: 89, sheet: 89 },
  ];
  const samples = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 89];
  const a = new Konva.Rect();
  const b = new Konva.Rect();
  const hit = (node: Konva.Node, frame: number): Hit => ({
    node,
    code: "layout/off-canvas",
    frame,
  });

  it("merges hits on adjacent samples into one range", () => {
    const [g] = groupSamples([hit(a, 3), hit(a, 6), hit(a, 9)], samples, beats, 30);
    expect(g?.frames).toEqual([{ from: 3, to: 9 }]);
    expect(g?.beats).toEqual(["hook"]);
  });

  it("calls a short hit before the settled frame passing", () => {
    const [g] = groupSamples([hit(a, 3), hit(a, 6)], samples, beats, 30);
    expect(g?.held).toBe(false);
  });

  it("calls a hit inside the settled stretch held", () => {
    const [g] = groupSamples([hit(a, 89)], samples, beats, 30);
    expect(g?.held).toBe(true);
  });

  it("calls a run of half a second held, even outside the stretch", () => {
    const frames = [0, 3, 6, 9, 12];
    const [g] = groupSamples(
      frames.map((f) => hit(a, f)),
      samples,
      beats,
      30,
    );
    expect(g?.held).toBe(true);
  });

  it("keeps two nodes with the same code apart", () => {
    const groups = groupSamples([hit(a, 3), hit(b, 3)], samples, beats, 30);
    expect(groups).toHaveLength(2);
  });

  it("splits a hit that stops and starts again into two ranges", () => {
    const [g] = groupSamples([hit(a, 3), hit(a, 12)], samples, beats, 30);
    expect(g?.frames).toEqual([
      { from: 3, to: 3 },
      { from: 12, to: 12 },
    ]);
  });
});

describe("sortFindings", () => {
  const base = { message: "", composition: "c", node: null, beats: [], source: null };
  const f = (
    code: Finding["code"],
    severity: Finding["severity"],
    held: boolean,
    from: number,
  ): Finding => ({
    ...base,
    code,
    severity,
    held,
    frames: [{ from, to: from }],
  });

  it("puts errors first, then held before passing, then by first frame", () => {
    const sorted = sortFindings([
      f("layout/off-canvas", "warning", false, 1),
      f("layout/contrast", "warning", true, 50),
      f("intent/no-match", "error", false, 90),
      f("layout/safe-zone", "warning", true, 10),
    ]);
    expect(sorted.map((x) => x.code)).toEqual([
      "intent/no-match",
      "layout/safe-zone",
      "layout/contrast",
      "layout/off-canvas",
    ]);
  });
});
