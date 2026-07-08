import Konva from "konva";
import { describe, expect, it } from "vitest";
import { getContentVersion, trackEffected, untrackEffected } from "../src/effects/dirty.js";

describe("effects dirty tracking", () => {
  it("bumps on attr changes but not on x/y of the effected node", () => {
    const g = new Konva.Group();
    const r = new Konva.Rect({ width: 10, height: 10, fill: "red" });
    g.add(r);
    trackEffected(g);
    const v0 = getContentVersion(g);

    g.x(50); // translation of the effected node itself: carve-out
    expect(getContentVersion(g)).toBe(v0);

    r.fill("blue"); // child mutation: invalidates
    expect(getContentVersion(g)).toBeGreaterThan(v0);
    untrackEffected(g);
  });

  it("bumps the effected node when a child's x changes (child translation moves pixels)", () => {
    const g = new Konva.Group();
    const r = new Konva.Rect({ width: 10, height: 10 });
    g.add(r);
    trackEffected(g);
    const v0 = getContentVersion(g);
    r.x(5); // translation of a DESCENDANT changes the captured content
    expect(getContentVersion(g)).toBeGreaterThan(v0);
    untrackEffected(g);
  });

  it("does not bump an effected descendant when an ancestor translates", () => {
    const parent = new Konva.Group();
    const child = new Konva.Group();
    parent.add(child);
    child.add(new Konva.Rect({ width: 4, height: 4 }));
    trackEffected(child);
    const v0 = getContentVersion(child);
    parent.x(100); // pure ancestor translation: region follows, cache holds
    expect(getContentVersion(child)).toBe(v0);
    parent.scaleX(2); // non-translation ancestor change: invalidates
    expect(getContentVersion(child)).toBeGreaterThan(v0);
    untrackEffected(child);
  });

  it("bumps on add/remove", () => {
    const g = new Konva.Group();
    trackEffected(g);
    const v0 = getContentVersion(g);
    const r = new Konva.Rect({ width: 2, height: 2 });
    g.add(r);
    expect(getContentVersion(g)).toBeGreaterThan(v0);
    const v1 = getContentVersion(g);
    r.remove();
    expect(getContentVersion(g)).toBeGreaterThan(v1);
    untrackEffected(g);
  });
});
