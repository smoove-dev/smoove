import Konva from "konva";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bumpContentVersion,
  contentVersion,
  fingerprint,
  isTranslationOnly,
  peekContentVersion,
  untrackNode,
} from "./dirty.js";

describe("contentVersion", () => {
  let group: Konva.Group;
  let child: Konva.Rect;

  beforeEach(() => {
    group = new Konva.Group();
    child = new Konva.Rect({ width: 10, height: 10, fill: "black" });
    group.add(child);
  });

  it("starts at zero for a newly tracked node", () => {
    expect(contentVersion(group)).toBe(0);
  });

  it("increments on an explicit bump", () => {
    contentVersion(group);
    bumpContentVersion(group);
    expect(contentVersion(group)).toBe(1);
  });

  it("does not lose a bump that happened before the first read", () => {
    bumpContentVersion(group);
    expect(contentVersion(group)).toBe(1);
  });

  it("bumps when the node's own paint attr changes", () => {
    const before = contentVersion(group);
    group.opacity(0.5);
    expect(contentVersion(group)).toBeGreaterThan(before);
  });

  it("bumps when a DESCENDANT's paint attr changes", () => {
    const before = contentVersion(group);
    child.fill("red");
    expect(contentVersion(group)).toBeGreaterThan(before);
  });

  it("bumps when a child is added", () => {
    const before = contentVersion(group);
    group.add(new Konva.Rect({ width: 5, height: 5 }));
    expect(contentVersion(group)).toBeGreaterThan(before);
  });

  it("bumps when a child removes itself", () => {
    const before = contentVersion(group);
    child.remove();
    expect(contentVersion(group)).toBeGreaterThan(before);
  });

  it("does NOT bump on the node's own translation", () => {
    const before = contentVersion(group);
    group.x(100);
    group.y(50);
    expect(contentVersion(group)).toBe(before);
  });

  it("does NOT bump on a descendant's translation", () => {
    const before = contentVersion(group);
    child.x(7);
    expect(contentVersion(group)).toBe(before);
  });

  it("DOES bump on rotation and scale, which change rasterization", () => {
    const afterRotate = (() => {
      const before = contentVersion(group);
      group.rotation(15);
      return contentVersion(group) > before;
    })();
    const afterScale = (() => {
      const before = contentVersion(group);
      group.scaleX(2);
      return contentVersion(group) > before;
    })();
    expect([afterRotate, afterScale]).toEqual([true, true]);
  });

  it("does not bump one tracked node when an unrelated node changes", () => {
    const other = new Konva.Group();
    const otherChild = new Konva.Rect({ width: 4, height: 4 });
    other.add(otherChild);
    const groupBefore = contentVersion(group);
    contentVersion(other);

    otherChild.fill("blue");

    expect(contentVersion(group)).toBe(groupBefore);
    expect(contentVersion(other)).toBeGreaterThan(0);
  });

  it("stops accumulating after untrackNode", () => {
    contentVersion(group);
    untrackNode(group);
    // Read with peek, not contentVersion — the latter tracks on read.
    const before = peekContentVersion(group);
    child.fill("green");
    expect(peekContentVersion(group)).toBe(before);
  });
});

describe("isTranslationOnly", () => {
  it("accepts x and y", () => {
    expect(isTranslationOnly("x")).toBe(true);
    expect(isTranslationOnly("y")).toBe(true);
  });

  it("rejects rotation, scale and paint attrs", () => {
    for (const attr of ["rotation", "scaleX", "scaleY", "fill", "opacity", "width"]) {
      expect(isTranslationOnly(attr), attr).toBe(false);
    }
  });
});

describe("fingerprint", () => {
  it("is stable for equal param objects", () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ a: 1, b: [1, 2] }));
  });

  it("is order-independent over keys", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 1.5 }));
  });

  it("changes when an array value changes", () => {
    expect(fingerprint({ a: [1, 2] })).not.toBe(fingerprint({ a: [1, 3] }));
  });

  it("does not collide across differently-keyed sets with equal values", () => {
    expect(fingerprint({ a: 1, b: 2 })).not.toBe(fingerprint({ ab: 1, "": 2 }));
  });
});
