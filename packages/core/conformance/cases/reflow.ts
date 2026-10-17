import { expect } from "vitest";
import { Block, Text } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

const FRAMES = [0, 15, 30];

/** Cross-frame observations, for the cases that assert a trend rather than a value. */
const textWidths = new Map<number, number>();

export const reflowCases: LayoutCase[] = [
  {
    id: "reflow-gap",
    group: "Animated reflow",
    title: "animating gap",
    note: "The updater changes one container prop and every child re-places itself; nothing is positioned by hand.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
      seq.register((frame) => {
        root.setAttr("gap", frame * 2);
      });
    },
    expect: (p, frame) => {
      const gap = frame * 2;
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".b").x).toBeCloseTo(100 + gap, 0);
      expect(p.box(".c").x).toBeCloseTo(200 + gap * 2, 0);
    },
  },
  {
    id: "reflow-grow",
    group: "Animated reflow",
    title: "animating flexGrow",
    note: "One child's grow factor ramps from 1 to 3, so the split slides from half-half to a quarter-three-quarters.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "row" });
      const a = new Block({
        name: "a",
        flexBasis: 0,
        flexGrow: 1,
        height: 80,
        background: "#4ea1ff",
      });
      const b = new Block({
        name: "b",
        flexBasis: 0,
        flexGrow: 1,
        height: 80,
        background: "#7ee787",
      });
      root.add(a);
      root.add(b);
      seq.register((frame) => {
        b.setAttr("flexGrow", 1 + frame / 15);
      });
    },
    expect: (p, frame) => {
      const growB = 1 + frame / 15;
      const expectedA = (480 * 1) / (1 + growB);
      expect(p.box(".a").width).toBeCloseTo(expectedA, 0);
      expect(p.box(".b").width).toBeCloseTo(480 - expectedA, 0);
    },
  },
  {
    id: "reflow-size",
    group: "Animated reflow",
    title: "animating a container's size",
    note: "Growing the card with width() drags its percent-sized child along with it.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      const cardNode = new Block({
        name: "card",
        flexDirection: "row",
        width: 200,
        height: 100,
        background: "#1f2937",
      });
      cardNode.add(new Block({ name: "child", width: "100%", height: 40, background: "#4ea1ff" }));
      root.add(cardNode);
      seq.register((frame) => {
        cardNode.width(200 + frame * 4);
      });
    },
    expect: (p, frame) => {
      const width = 200 + frame * 4;
      expect(p.box(".card").width).toBeCloseTo(width, 0);
      expect(p.box(".child").width).toBeCloseTo(width, 0);
    },
  },
  {
    id: "reflow-visibility",
    group: "Animated reflow",
    title: "a child appearing and disappearing",
    note: "Hiding the middle tile closes the row up, and showing it again reopens the space.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      const middle = new Block({ name: "b", width: 100, height: 60, background: "#7ee787" });
      root.add(middle);
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
      seq.register((frame) => {
        middle.visible(frame < 15);
      });
    },
    expect: (p, frame) => {
      expect(p.box(".c").x).toBe(frame < 15 ? 200 : 100);
    },
  },
  {
    id: "reflow-text",
    group: "Animated reflow",
    title: "text content changing",
    note: "The label re-measures as it grows, and its flexGrow sibling gives up exactly that much width.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      const label = new Text({ name: "t", text: "xxxx", fontSize: 24, fill: "#e6edf3" });
      root.add(label);
      root.add(new Block({ name: "rest", flexGrow: 1, height: 40, background: "#4ea1ff" }));
      seq.register((frame) => {
        label.setText("x".repeat(4 + frame));
      });
    },
    expect: (p, frame) => {
      const t = p.box(".t");
      const rest = p.box(".rest");
      // The two always tile the row exactly.
      expect(t.width + rest.width).toBeCloseTo(480, 0);
      expect(rest.x).toBeCloseTo(t.width, 0);
      // And the label grows monotonically as characters are added.
      textWidths.set(frame, t.width);
      const previous = textWidths.get(frame === 15 ? 0 : 15);
      if (frame > 0 && previous !== undefined) expect(t.width).toBeGreaterThan(previous);
    },
  },
  {
    id: "reflow-first-frame",
    group: "Animated reflow",
    title: "the very first frame is laid out",
    note: "Frame 0 is what a render starts on and what a still capture grabs, so it has to paint a laid-out scene.",
    frames: [0],
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      const cardNode = new Block({
        name: "card",
        flexDirection: "row",
        width: 200,
        height: 100,
        background: "#1f2937",
      });
      cardNode.add(new Block({ name: "child", width: "100%", height: 40, background: "#4ea1ff" }));
      root.add(cardNode);
    },
    expect: (p) => {
      // Pixels are read before anything measures, so this sees the real frame-0 canvas.
      p.expectColor(100, 20, "#4ea1ff");
      p.expectColor(100, 70, "#1f2937");
    },
  },
  {
    id: "reflow-child-position-is-owned-by-layout",
    group: "Animated reflow",
    title: "a child's x is owned by the layout pass",
    note: "Updaters run before layout, so setting x on a flex child has no effect. Animate opacity, scale, or rotation instead, or move the node out of the Flex to place it by hand.",
    divergence:
      "Intended: Sequence runs updaters, then re-places every flex child. Hand-positioning structure inside a Flex or Block cannot work, and this case exists so the behaviour stays deliberate.",
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      const middle = new Block({ name: "b", width: 100, height: 60, background: "#7ee787" });
      root.add(middle);
      seq.register(() => {
        middle.x(999);
      });
    },
    expect: (p) => {
      expect(p.box(".b").x).toBe(100);
    },
  },
  {
    id: "reflow-percent-width",
    group: "Animated reflow",
    title: "animating a percentage width",
    note: "width() takes a percentage, so a card can grow as a share of its parent, written from the frame.",
    frames: FRAMES,
    build: (root, seq) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      const cardNode = new Block({
        name: "card",
        flexDirection: "row",
        width: "40%",
        height: 100,
        background: "#1f2937",
      });
      cardNode.add(new Block({ name: "child", width: "100%", height: 40, background: "#4ea1ff" }));
      root.add(cardNode);
      seq.register((frame) => {
        cardNode.width(`${40 + frame}%`);
      });
    },
    expect: (p, frame) => {
      const width = (480 * (40 + frame)) / 100;
      expect(p.box(".card").width).toBeCloseTo(width, 0);
      expect(p.box(".child").width).toBeCloseTo(width, 0);
    },
  },
];
