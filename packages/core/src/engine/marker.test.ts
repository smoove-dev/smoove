import { describe, expect, it } from "vitest";
import { Composition } from "./composition.js";
import { Marker, plan } from "./marker.js";
import { Sequence } from "./sequence.js";
import { Series } from "./series.js";

let compN = 0;
function compOpts() {
  compN += 1;
  return { id: `marker-comp-${compN}`, fps: 30, width: 320, height: 240 };
}

describe("declared Marker", () => {
  it("resolves start/end/settled from start + durationInFrames", () => {
    const m = new Marker({ start: 10, durationInFrames: 50 });
    expect(m.start.resolve()).toBe(10);
    expect(m.end.resolve()).toBe(60);
    expect(m.settled.resolve()).toBe(10);
  });

  it("defaults start to 0", () => {
    const m = new Marker({ durationInFrames: 30 });
    expect(m.start.resolve()).toBe(0);
    expect(m.end.resolve()).toBe(30);
  });

  it("chains: a marker's start can be another marker's end", () => {
    const intro = new Marker({ start: 0, durationInFrames: 150 });
    const hero = new Marker({ start: intro.end, durationInFrames: 300 });
    const outro = new Marker({ start: hero.end, durationInFrames: 150 });
    expect(outro.start.resolve()).toBe(450);
    expect(outro.end.resolve()).toBe(600);
  });

  it("accepts a bare Marker as start (meaning its .start)", () => {
    const a = new Marker({ start: 5, durationInFrames: 10 });
    const b = new Marker({ start: a, durationInFrames: 10 });
    expect(b.start.resolve()).toBe(5);
  });

  it("supports until instead of durationInFrames", () => {
    const a = new Marker({ start: 0, durationInFrames: 100 });
    const b = new Marker({ start: 20, until: a.end });
    expect(b.end.resolve()).toBe(100);
  });

  it("throws when neither or both of durationInFrames/until are given", () => {
    expect(() => new Marker({ start: 0 })).toThrow(/exactly one/);
    const a = new Marker({ durationInFrames: 10 });
    expect(() => new Marker({ start: 0, durationInFrames: 10, until: a.end })).toThrow(
      /exactly one/,
    );
  });

  it("validates durationInFrames and numeric start eagerly", () => {
    expect(() => new Marker({ durationInFrames: 0 })).toThrow(/positive integer/);
    expect(() => new Marker({ durationInFrames: 1.5 })).toThrow(/positive integer/);
    expect(() => new Marker({ start: -1, durationInFrames: 10 })).toThrow(/non-negative/);
    expect(() => new Marker({ start: 1.5, durationInFrames: 10 })).toThrow(/non-negative/);
  });

  it("throws at resolve when until lands at or before start", () => {
    const a = new Marker({ start: 0, durationInFrames: 10 });
    const b = new Marker({ start: 50, until: a.end });
    expect(() => b.end.resolve()).toThrow(/after start/);
  });

  it("detects circular anchoring between declared markers", () => {
    // a.end depends on b.end which depends on a.end. The options object uses
    // a getter so `until` is only read lazily at resolve time.
    let a: Marker;
    const b = new Marker({
      start: 0,
      get until() {
        return a.end;
      },
    });
    a = new Marker({ start: b.end, durationInFrames: 10 });
    expect(() => a.start.resolve()).toThrow(/circular/);
  });
});

describe("plan()", () => {
  it("chains named beats back to back", () => {
    const { intro, hero, outro } = plan({
      intro: { durationInFrames: 150 },
      hero: { durationInFrames: 300 },
      outro: { durationInFrames: 150 },
    });
    expect(intro.start.resolve()).toBe(0);
    expect(hero.start.resolve()).toBe(150);
    expect(outro.start.resolve()).toBe(450);
    expect(outro.end.resolve()).toBe(600);
  });

  it("applies offset as gap or overlap, and settles after an overlap", () => {
    const { b, c } = plan({
      a: { durationInFrames: 100 },
      b: { durationInFrames: 100, offset: -10 }, // overlap
      c: { durationInFrames: 100, offset: 20 }, // gap
    });
    expect(b.start.resolve()).toBe(90);
    expect(b.settled.resolve()).toBe(100); // start + |offset|
    expect(c.start.resolve()).toBe(210); // 190 + 20
    expect(c.settled.resolve()).toBe(210); // gap: settled === start
  });

  it("anchors the whole plan with opts.from", () => {
    const pre = new Marker({ start: 0, durationInFrames: 60 });
    const { main } = plan({ main: { durationInFrames: 90 } }, { from: pre.end });
    expect(main.start.resolve()).toBe(60);
  });

  it("throws on an empty plan and on non-integer offsets", () => {
    expect(() => plan({})).toThrow(/at least one/);
    expect(() => plan({ a: { durationInFrames: 10, offset: 0.5 } })).toThrow(/integer/);
  });
});

describe("Composition durationInFrames from an anchor", () => {
  it("resolves a marker point lazily on first read", () => {
    const { outro } = plan({
      intro: { durationInFrames: 150 },
      outro: { durationInFrames: 150 },
    });
    const comp = new Composition({ ...compOpts(), durationInFrames: outro.end });
    expect(comp.durationInFrames.get()).toBe(300);
  });

  it("resolves a Series-derived anchor whose series is populated after construction", () => {
    const series = new Series();
    const comp = new Composition({
      ...compOpts(),
      durationInFrames: series.marker("outro").end,
    });
    series
      .add({ durationInFrames: 100, name: "intro" }, () => {})
      .add({ durationInFrames: 50, name: "outro" }, () => {});
    comp.add(series);
    expect(comp.durationInFrames.get()).toBe(150);
  });

  it("throws when the anchor resolves to a non-positive duration", () => {
    const m = new Marker({ start: 0, durationInFrames: 10 });
    const comp = new Composition({ ...compOpts(), durationInFrames: m.start });
    expect(() => comp.durationInFrames.get()).toThrow(/positive integer/);
  });

  it("still validates plain numbers eagerly", () => {
    expect(() => new Composition({ ...compOpts(), durationInFrames: 0 })).toThrow(
      /positive integer/,
    );
  });

  it("a spanning Sequence follows the resolved duration", () => {
    const { only } = plan({ only: { durationInFrames: 90 } });
    const comp = new Composition({ ...compOpts(), durationInFrames: only.end });
    const seq = new Sequence();
    comp.add(seq);
    expect(seq.durationInFrames).toBe(90);
  });
});
