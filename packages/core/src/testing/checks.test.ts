import Konva from "konva";
import { describe, expect, it } from "vitest";
import { interpolate } from "../animation/interpolate.js";
import { Composition } from "../engine/composition.js";
import { plan } from "../engine/marker.js";
import { Sequence } from "../engine/sequence.js";
import { Text } from "../layout/text/text.js";
import {
  appearsBy,
  before,
  ChecksError,
  checksFrom,
  defineChecks,
  keepsMoving,
  runChecks,
  staysInFrame,
} from "./checks.js";

/**
 * Three beats at 30 frames a second: hook (2 s), land (2 s), outro (3 s).
 * The title fades in over the hook's first 10 frames, the tagline appears in
 * land, and the outro holds still. `hookFrames` retimes the hook.
 */
function build(
  opts: { hookFrames?: number; taglineFirst?: boolean; taglineSlides?: boolean } = {},
) {
  const beats = plan({
    hook: { durationInFrames: opts.hookFrames ?? 60 },
    land: { durationInFrames: 60 },
    outro: { durationInFrames: 90 },
  });
  const comp = new Composition({
    id: "checks-promo",
    fps: 30,
    width: 640,
    height: 360,
    durationInFrames: beats.outro.end,
    plan: beats,
  });
  const seq = new Sequence({ from: 0, durationInFrames: beats.outro.end.resolve() });
  seq.add(new Konva.Rect({ x: 0, y: 0, width: 640, height: 360, fill: "#0c0b16" }));
  const title = new Text({
    name: "title",
    text: "Launch",
    fontSize: 48,
    fill: "#f5f2ff",
    x: 40,
    y: 40,
    opacity: 0,
  });
  const tagline = new Text({
    name: "tagline",
    text: "Monday",
    fontSize: 32,
    fill: "#f5f2ff",
    x: 40,
    y: 200,
    opacity: 0,
  });
  const ghost = new Text({
    name: "ghost",
    text: "LAUNCH",
    fontSize: 200,
    fill: "#9a95b8",
    x: -120,
    y: 120,
    opacity: 0.12,
  });
  seq.add(title, tagline, ghost);
  const hookStart = beats.hook.start.resolve();
  const landStart = beats.land.start.resolve();
  const outroStart = beats.outro.start.resolve();
  seq.register((f) => {
    title.opacity(
      interpolate(f, [hookStart, hookStart + 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    const tagAt = opts.taglineFirst ? hookStart : landStart;
    tagline.opacity(f >= tagAt ? 1 : 0);
    // Everything moves until the outro, which holds.
    const t = Math.min(f, outroStart);
    title.x(40 + t * 0.5);
    tagline.x(opts.taglineSlides && f > landStart + 30 ? 700 : 40 + t * 0.2);
  });
  comp.add(seq);
  return { comp, beats };
}

const codes = (r: { findings: Array<{ code: string }> }) => r.findings.map((f) => f.code);

describe("intents", () => {
  it("passes appearsBy on a beat point, and keeps passing when the plan is retimed", async () => {
    for (const hookFrames of [60, 90]) {
      const { comp, beats } = build({ hookFrames });
      const checks = defineChecks(comp, {
        intent: [appearsBy(".tagline", beats.land.start.add(1))],
      });
      const r = await runChecks(comp, checks, { groups: ["intent"] });
      expect(codes(r)).toEqual([]);
    }
  });

  it("fails appearsBy when the node isn't visible there", async () => {
    const { comp } = build();
    const r = await runChecks(
      comp,
      defineChecks(comp, { intent: [appearsBy(".tagline", { time: 1 })] }),
      {
        groups: ["intent"],
      },
    );
    expect(codes(r)).toEqual(["intent/appears-by"]);
    expect(r.findings[0]?.severity).toBe("error");
    expect(r.findings[0]?.node?.name).toBe("tagline");
  });

  it("fails before when the second node shows first", async () => {
    const { comp } = build({ taglineFirst: true });
    const r = await runChecks(
      comp,
      defineChecks(comp, { intent: [before(".title", ".tagline")] }),
      {
        groups: ["intent"],
      },
    );
    expect(codes(r)).toEqual(["intent/before"]);
  });

  it("fails staysInFrame when a node leaves the canvas while visible", async () => {
    const { comp } = build({ taglineSlides: true });
    const r = await runChecks(comp, defineChecks(comp, { intent: [staysInFrame(".tagline")] }), {
      groups: ["intent"],
    });
    expect(codes(r)).toEqual(["intent/stays-in-frame"]);
  });

  it("fails keepsMoving on the held outro, unless the outro is excused", async () => {
    const { comp, beats } = build();
    const strict = await runChecks(comp, defineChecks(comp, { intent: [keepsMoving()] }), {
      groups: ["intent", "motion"],
    });
    expect(codes(strict)).toEqual(["intent/keeps-moving"]);
    const excused = await runChecks(
      comp,
      defineChecks(comp, { intent: [keepsMoving({ except: [beats.outro] })] }),
      {
        groups: ["intent", "motion"],
      },
    );
    expect(codes(excused)).toEqual([]);
  });

  it("reports a frozen stretch as a warning when nobody asked for keepsMoving", async () => {
    const { comp } = build();
    const r = await runChecks(comp, null, { groups: ["motion"] });
    expect(codes(r)).toEqual(["motion/frozen"]);
    expect(r.findings[0]?.severity).toBe("warning");
  });

  it("fails an intent whose selector matches nothing", async () => {
    const { comp } = build();
    const r = await runChecks(comp, defineChecks(comp, { intent: [appearsBy(".missing", 0)] }), {
      groups: ["intent"],
    });
    expect(codes(r)).toEqual(["intent/no-match"]);
  });
});

describe("the allow list", () => {
  it("moves an allowed finding aside with its reason", async () => {
    const { comp } = build();
    const checks = defineChecks(comp, {
      allow: [
        {
          select: ".ghost",
          checks: ["layout/off-canvas"],
          reason: "bleeds off the edge on purpose",
        },
      ],
    });
    const r = await runChecks(comp, checks, { groups: ["layout"] });
    expect(codes(r)).not.toContain("layout/off-canvas");
    expect(r.allowed.map((a) => [a.code, a.reason])).toContainEqual([
      "layout/off-canvas",
      "bleeds off the edge on purpose",
    ]);
  });

  it("limits an entry to its beats", async () => {
    const { comp, beats } = build();
    const checks = defineChecks(comp, {
      allow: [
        { select: ".ghost", checks: ["layout"], reason: "only in the outro", beats: [beats.outro] },
      ],
    });
    const r = await runChecks(comp, checks, { groups: ["layout"] });
    expect(codes(r)).toContain("layout/off-canvas");
  });

  it("warns about an entry that matches nothing", async () => {
    const { comp } = build();
    const checks = defineChecks(comp, {
      allow: [{ select: ".nothing", checks: ["layout"], reason: "stale" }],
    });
    const r = await runChecks(comp, checks, { groups: ["layout"] });
    expect(codes(r)).toContain("allow/no-match");
  });

  it("can't excuse a purity error", async () => {
    const { comp } = build();
    const seq = comp.getChildren()[0] as Sequence;
    const chip = new Konva.Rect({ name: "chip", width: 10, height: 10, fill: "#f5f2ff" });
    seq.add(chip);
    seq.register(() => chip.y(Math.random() * 100));
    const checks = defineChecks(comp, {
      allow: [{ select: ".chip", checks: ["purity"], reason: "no" }],
    });
    const r = await runChecks(comp, checks, { groups: ["purity"] });
    expect(codes(r)).toContain("purity/seek-mismatch");
  });
});

describe("defineChecks and checksFrom", () => {
  it("refuses an allow entry without a reason", () => {
    const { comp } = build();
    expect(() =>
      defineChecks(comp, { allow: [{ select: ".ghost", checks: ["layout"], reason: "" }] }),
    ).toThrow(/reason/);
  });

  it("names the file when a module's default export isn't a checks object", () => {
    expect(() => checksFrom({ default: 42 }, "a.check.ts")).toThrow(ChecksError);
    expect(() => checksFrom({}, "a.check.ts")).toThrow(/a\.check\.ts.*defineChecks/);
    const { comp } = build();
    const checks = defineChecks(comp, {});
    expect(checksFrom({ default: checks }, "a.check.ts")).toBe(checks);
  });
});

describe("runChecks", () => {
  it("runs only the asked-for groups, sorted, with nodes described", async () => {
    const { comp } = build();
    comp.setFrame(5);
    const r = await runChecks(comp, defineChecks(comp, { style: { palette: { bg: "#0c0b16" } } }), {
      groups: ["style"],
    });
    expect(new Set(codes(r))).toEqual(new Set(["style/color"]));
    expect(
      r.findings.every((f) => f.composition === "checks-promo" && f.node?.type === "Text"),
    ).toBe(true);
    expect(comp.frame.get()).toBe(5);
  });
});

describe("contrast messages", () => {
  it("names the palette key of the suggestion", async () => {
    const comp = new Composition({
      id: "checks-contrast",
      fps: 30,
      width: 1080,
      height: 1080,
      durationInFrames: 30,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 30 });
    seq.add(new Konva.Rect({ x: 0, y: 0, width: 1080, height: 1080, fill: "#ffd23f" }));
    seq.add(
      new Text({
        name: "caption",
        text: "Ships Monday",
        fontSize: 34,
        fill: "#9a95b8",
        x: 100,
        y: 100,
      }),
    );
    comp.add(seq);
    const checks = defineChecks(comp, {
      style: { palette: { bg: "#0c0b16", muted: "#9a95b8", accent: "#ffd23f" } },
    });
    const r = await runChecks(comp, checks, { groups: ["layout"] });
    const contrast = r.findings.find((f) => f.code === "layout/contrast");
    expect(contrast?.message).toBe(
      "Contrast 2.0 to 1, #9a95b8 on #ffd23f, under the floor of 4.5 to 1. The palette's bg, #0c0b16, passes.",
    );
  });
});
