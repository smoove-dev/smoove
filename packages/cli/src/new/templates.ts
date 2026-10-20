/**
 * The files `smoove new` writes: a title card that shows the composition's
 * title, with its entry, props schema, checks and tests. Every string the
 * user typed goes in through JSON.stringify, so quotes stay safe.
 */

/** Everything a template needs, already defaulted and checked. */
export interface NewFiles {
  id: string;
  title: string;
  group: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  seconds: number;
}

const q = JSON.stringify;

export function indexTs(f: NewFiles): string {
  return `import type { RegistryEntry } from "@smoove/studio";
import { type Props, schema } from "./schema.js";

// The studio reads this entry to list the composition: the id, the title, the
// sidebar group, and how to load the composition and its checks.
const entry: RegistryEntry<Props> = {
  id: ${q(f.id)},
  title: ${q(f.title)},
  group: ${q(f.group)},
  description: ${q(f.description)},
  propsSchema: schema,
  composition: () => import("./composition.js"),
  checks: () => import("./composition.check.js"),
};

export default entry;
`;
}

export function schemaTs(f: NewFiles): string {
  return `import { kf } from "@smoove/studio";

export type Props = {
  title: string;
};

// The props the studio's props panel edits live.
export const schema = kf.object({
  fields: {
    title: kf.text({ label: "Title", default: ${q(f.title)} }),
  },
});
`;
}

export function compositionTs(f: NewFiles): string {
  return `import { Composition, Easing, Flex, interpolate, plan, Rect, Sequence, Text } from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";

export const width = ${f.width};
export const height = ${f.height};
export const fps = ${f.fps};
export const seconds = ${f.seconds};
// Size everything from the canvas's short side, so the card reads the same in
// every format.
const u = Math.min(width, height) / 1080;

// Every color in the video, decided once. The checks file declares the same
// palette, so \`npx smoove agent check\` warns about any color outside it.
export const palette = {
  bg: "#0d1117",
  fg: "#e6edf3",
  accent: "#ffc23c",
};

// The beats. \`npx smoove agent sheet\` shows one tile per beat.
const ENTER = 18; // frames for the title to fade in and the bar to grow
export const beats = plan({
  enter: { durationInFrames: ENTER },
  hold: { durationInFrames: Math.max(1, Math.round(seconds * fps) - ENTER) },
});

const comp = new Composition({
  id: ${q(f.id)},
  fps,
  width,
  height,
  durationInFrames: beats.hold.end,
  plan: beats,
  // Editable in the studio's props panel (see schema.ts).
  props: { title: ${q(f.title)} },
});
const p = () => comp.props.get();

// Registered on the sequence below, so the composition waits for the face.
export const comfortaa = new Comfortaa({ weights: ["700"] });

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: palette.bg }));
main.add(comfortaa);

// On a tall canvas, keep the card where a phone feed leaves it clear: its
// buttons sit along the right edge and its captions along the bottom.
const safe =
  height > width
    ? { x: 0.05 * width, y: 0.08 * height, width: 0.83 * width, height: 0.72 * height }
    : { x: 0, y: 0, width, height };

// The title over a short accent bar, centered in that area. Layout owns the
// children's positions, so the entrance animates opacity and size only.
const card = new Flex({
  ...safe,
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 36 * u,
});
const title = new Text({
  name: "title",
  text: p().title,
  font: comfortaa.face("700"),
  fontSize: 112 * u,
  fill: palette.fg,
  width: Math.min(width * 0.8, safe.width * 0.9),
  align: "center",
  // A long title wraps onto more lines; the card stays centered.
  wrap: "word",
  ellipsis: false,
});
const bar = new Rect({ name: "bar", width: 0, height: 10 * u, fill: palette.accent, cornerRadius: 5 * u });
card.add(title);
card.add(bar);
main.add(card);
comp.add(main);

let appliedTitle = p().title;
main.register((frame) => {
  title.opacity(
    interpolate(frame, [0, ENTER], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  bar.width(
    interpolate(frame, [4, ENTER], [0, 240 * u], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // The title is a prop: follow edits from the studio.
  const next = p().title;
  if (next !== appliedTitle) {
    appliedTitle = next;
    title.setText(next);
  }
});

export default comp;
`;
}

export function checkTs(_f: NewFiles): string {
  return `// What this composition promises, checked by \`npx smoove agent check\` and by
// the "passes its checks" test.
import { appearsBy, defineChecks, keepsMoving, staysInFrame } from "@smoove/core/testing";
import comp, { beats, comfortaa, palette } from "./composition.js";

export default defineChecks(comp, {
  intent: [
    // The title is on screen once the entrance is done.
    appearsBy(".title", beats.enter.end),
    staysInFrame(".title"),
    // The hold is meant to sit still.
    keepsMoving({ except: [beats.hold] }),
  ],
  style: { palette, fonts: [comfortaa] },
});
`;
}

export function testTs(f: NewFiles): string {
  return `// Headless tests: drive the composition to a frame and assert what's on
// screen there. Run them with \`npm test\`.
import { probe, runChecks } from "@smoove/core/testing";
import { beforeAll, describe, expect, it } from "vitest";
import comp, { beats, seconds } from "./composition.js";
import checks from "./composition.check.js";

// Fonts load asynchronously; measure against the real face, not a fallback.
beforeAll(async () => {
  await comp.whenReady();
});

describe(${q(f.id)}, () => {
  it("runs for its length", () => {
    expect(comp.durationInFrames.get()).toBe(Math.max(Math.round(seconds * comp.fps), 19));
  });

  it("shows the title by the end", () => {
    comp.setFrame(beats.hold.end.resolve() - 1);
    const [title] = probe(comp, ".title");
    expect(title?.visible).toBe(true);
    expect(title?.box.width).toBeGreaterThan(0);
  });

  it("passes its checks", async () => {
    const report = await runChecks(comp, checks);
    expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });
});
`;
}
