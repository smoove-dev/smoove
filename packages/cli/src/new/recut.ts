/**
 * `smoove new --template recut`: a portrait composition that plays ranges of
 * the original footage back to back, read from its `cuts.json`, with captions
 * from the transcript when there is one. The footage is never cut; editing
 * the plan is editing numbers. Every string the user typed goes in through
 * JSON.stringify, so quotes stay safe.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { CutPlan } from "@smoove/agent";
import { type RunContext, spell, UsageError } from "../commands.js";
import { MediaError, projectSource } from "../media/cache.js";
import { cachedInfo } from "../media/info.js";
import { readTranscriptFor, transcriptFile } from "../transcribe/where.js";
import { claimId, DEFAULT_GROUP, FORMATS, type NewInput } from "./new.js";
import { indexTs } from "./templates.js";

const q = JSON.stringify;

export interface RecutFiles {
  id: string;
  title: string;
  group: string;
  description: string;
  width: number;
  height: number;
  /** The footage, relative to the composition folder. */
  footageImport: string;
  /** The footage, relative to the project, as the tools spell it. */
  source: string;
  /** The transcript, relative to the composition folder, or null. */
  transcriptImport: string | null;
}

export function recutSchemaTs(): string {
  return `import { kf } from "@smoove/studio";

export type Props = {
  captions: boolean;
};

// The props the studio's props panel edits live.
export const schema = kf.object({
  fields: {
    captions: kf.boolean({ label: "Captions", default: true }),
  },
});
`;
}

export function recutCompositionTs(f: RecutFiles): string {
  const captions = f.transcriptImport
    ? `
// Captions: the transcript's words, timed to the cut. A word lands on the
// output frame its source time maps to; words in dropped ranges never show.
// Two to five words at a time, the spoken one boxed, outlined to read over
// any footage. (The "word-by-word captions" recipe in the smoove-video skill.)
type Word = { text: string; from: number; to: number };
const words: Word[] = (transcript as { words: { text: string; start: number; end: number }[] }).words.flatMap((w) => {
  const at = Math.round(w.start * fps);
  const s = segments.find((x) => at >= x.a && at < x.b);
  if (!s) return [];
  const from = s.from + at - s.a;
  const to = s.from + Math.min(s.b, Math.round(w.end * fps)) - s.a;
  return [{ text: w.text, from, to: Math.max(from + 1, to) }];
});

function groupWords(list: Word[], maxWords = 5, maxChars = 18) {
  const groups: { words: Word[]; text: string; ranges: [number, number][]; from: number; to: number }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    let pos = 0;
    const ranges: [number, number][] = [];
    const text = cur
      .map((w) => {
        const t = w.text.toUpperCase();
        ranges.push([pos, pos + t.length]);
        pos += t.length + 1;
        return t;
      })
      .join(" ");
    groups.push({ words: cur, text, ranges, from: cur[0].from, to: cur[cur.length - 1].to });
    cur = [];
  };
  for (const w of list) {
    const len = cur.map((x) => x.text).join(" ").length + w.text.length + 1;
    if (cur.length >= maxWords || (cur.length && len > maxChars)) flush();
    cur.push(w);
    if (/[.,!?]$/.test(w.text)) flush();
  }
  flush();
  // Hold a line until the next one starts when the gap is short, so captions
  // don't flicker between phrases.
  for (let i = 0; i + 1 < groups.length; i++) {
    if (groups[i + 1].from - groups[i].to < fps / 2) groups[i].to = groups[i + 1].from;
  }
  return groups;
}

const lines = groupWords(words);
/** The first frame a caption shows, or null when nothing is said. */
export const firstCaption = lines.length ? lines[0].from : null;

export const montserrat = new Montserrat({ weights: ["800"] });
const captions = new Sequence();
captions.add(montserrat);
// Centered, with its bottom edge above three quarters of the height, clear of
// the buttons and text a phone feed draws along the bottom.
const line = new Group({ x: width / 2, y: height * 0.7, listening: false });
captions.add(line);
const opts = {
  text: " ",
  width: width * 0.9,
  x: -width * 0.45,
  y: -40 * u,
  align: "center" as const,
  wrap: "none" as const,
  ellipsis: false,
  font: montserrat.face("800"),
  fontSize: 64 * u,
};
// Eight dark offset copies behind the text make the outline. Never shadowBlur.
const outline = Array.from({ length: 8 }, (_, k) => {
  const a = (k / 8) * Math.PI * 2;
  return new Text({ ...opts, fill: palette.outline, x: opts.x + Math.cos(a) * 6 * u, y: opts.y + Math.sin(a) * 6 * u });
});
const spoken: HighlightConfig = {
  start: 0,
  end: 0,
  background: palette.spoken,
  color: palette.outline,
  paddingStart: 10 * u,
  paddingEnd: 10 * u,
  cornerRadiusStart: 12 * u,
  cornerRadiusEnd: 12 * u,
  progress: 0,
};
const caption = new Text({ ...opts, name: "caption", fill: palette.caption, highlights: [spoken] });
line.add(...outline, caption);
comp.add(captions);

let shown: (typeof lines)[number] | undefined;
captions.register((frame) => {
  const g = p().captions ? lines.find((x) => frame >= x.from && frame < x.to) : undefined;
  line.visible(!!g);
  if (!g) return;
  // Re-set the text only when the line changes; \`shown\` is derived from the
  // frame, so a seek still lands on the right line.
  if (g !== shown) {
    shown = g;
    for (const t of [...outline, caption]) t.setText(g.text);
  }
  const s = interpolate(frame, [g.from, g.from + 5], [0.85, 1], { extrapolateRight: "clamp" });
  line.scaleX(s);
  line.scaleY(s);
  let wi = 0;
  for (let i = 0; i < g.words.length; i++) if (frame >= g.words[i].from) wi = i;
  spoken.start = g.ranges[wi][0];
  spoken.end = g.ranges[wi][1];
  spoken.progress = interpolate(frame, [g.words[wi].from, g.words[wi].from + 2], [0, 1], {
    extrapolateRight: "clamp",
  });
});
`
    : `
// Captions: there was no transcript when this was made. Transcribe the
// footage (npx smoove agent transcribe ${f.source}), then follow the
// "word-by-word captions" recipe in the smoove-video skill's text rules,
// mapping each word's source time to the cut the way sourceTimeAt does.
export const firstCaption: number | null = null;
`;

  return `// A recut: ranges of the original footage, back to back, from cuts.json.
// The footage itself is never cut. To change the edit, change cuts.json
// (npx smoove agent cut_plan writes it), not the numbers in this file.
import {
  Composition,${f.transcriptImport ? "\n  Group,\n  type HighlightConfig," : ""}
  interpolate,
  plan,
  Rect,
  Series,${f.transcriptImport ? "\n  Sequence,\n  Text," : ""}
} from "@smoove/core";${f.transcriptImport ? '\nimport Montserrat from "@smoove/google-fonts/montserrat";' : ""}
import { Video } from "@smoove/media";
import footage from ${q(f.footageImport)};
import cuts from "./cuts.json";${f.transcriptImport ? `\nimport transcript from ${q(f.transcriptImport)};` : ""}

export const width = ${f.width};
export const height = ${f.height};
export const fps = cuts.fps;
// Size everything from the canvas's short side.
const u = Math.min(width, height) / 1080;

// Where the portrait crop sits on landscape footage, as in CSS
// object-position: "center", "left", "right", "top left" and the rest. To
// follow a speaker who moves, see "Reframing 16:9 to 9:16" in the
// smoove-video skill's media rules.
const FOCUS = "center";

// Every color in the video. The checks file declares the same palette.
export const palette = {
  bg: "#000000",
  caption: "#ffffff",
  outline: "#0b0e14",
  spoken: "#ffd43b",
};

// Each kept range, in source frames, and where it lands in the cut.
const segments = (() => {
  let at = 0;
  return cuts.segments.map((s, i) => {
    const a = Math.round(s.start * fps);
    const b = Math.round(s.end * fps);
    const from = at;
    at += b - a;
    return { name: \`cut\${i + 1}\`, a, b, from, length: b - a };
  });
})();
const total = Math.max(
  1,
  segments.reduce((sum, s) => sum + s.length, 0),
);

/** The source time, in seconds, that output frame \`frame\` shows, or null past the end. */
export function sourceTimeAt(frame: number): number | null {
  const s = segments.find((x) => frame >= x.from && frame < x.from + x.length);
  return s ? (s.a + frame - s.from) / fps : null;
}

// One beat per kept range, so \`npx smoove agent sheet\` shows one tile each.
export const beats = plan(
  segments.length
    ? Object.fromEntries(segments.map((s) => [s.name, { durationInFrames: s.length }]))
    : { empty: { durationInFrames: 1 } },
);

const comp = new Composition({
  id: ${q(f.id)},
  fps,
  width,
  height,
  durationInFrames: total,
  plan: beats,
  // Editable in the studio's props panel (see schema.ts).
  props: { captions: true },
});
const p = () => comp.props.get();

// The edit: one Video per kept range, each playing that range of the
// original file, with short volume fades so a cut never clicks.
const edit = new Series();
for (const s of segments) {
  edit.add({ durationInFrames: s.length, name: s.name }, (seq) => {
    seq.add(new Rect({ x: 0, y: 0, width, height, fill: palette.bg }));
    const clip = new Video({
      src: footage,
      width,
      height,
      objectFit: "cover",
      objectPosition: FOCUS,
      trimBefore: s.a,
      trimAfter: s.b,
    });
    seq.add(clip);
    // Under half the range each way: interpolate needs its frames strictly in order.
    const fade = Math.min(2, Math.floor((s.length - 1) / 2));
    if (fade >= 1) {
      seq.register((frame) =>
        clip.setVolume(
          interpolate(frame, [0, fade, s.length - fade, s.length], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        ),
      );
    }
  });
}
comp.add(edit);
${captions}
export default comp;
`;
}

export function recutCheckTs(f: RecutFiles): string {
  return f.transcriptImport
    ? `// What this composition promises, checked by \`npx smoove agent check\` and by
// the "passes its checks" test.
import { appearsBy, defineChecks, staysInFrame } from "@smoove/core/testing";
import comp, { firstCaption, montserrat, palette } from "./composition.js";

export default defineChecks(comp, {
  intent: [
    staysInFrame(".caption"),
    // The first line of captions is on screen once its first word is spoken.
    ...(firstCaption !== null ? [appearsBy(".caption", firstCaption + 1)] : []),
  ],
  style: { palette, fonts: [montserrat] },
});
`
    : `// What this composition promises, checked by \`npx smoove agent check\` and by
// the "passes its checks" test.
import { defineChecks } from "@smoove/core/testing";
import comp, { palette } from "./composition.js";

export default defineChecks(comp, {
  intent: [],
  style: { palette },
});
`;
}

export function recutTestTs(f: RecutFiles): string {
  return `// Headless tests. Run them with \`npm test\`.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runChecks } from "@smoove/core/testing";
import { beforeAll, describe, expect, it } from "vitest";
import cuts from "./cuts.json";

// footage/ is kept out of git, so on a fresh clone the recording isn't here:
// add it with \`npx smoove agent footage_add\` to run these.
const footage = fileURLToPath(new URL(${q(f.footageImport)}, import.meta.url));

describe.skipIf(!existsSync(footage))(${q(`${f.id} (needs ${f.source})`)}, () => {
  let mod: typeof import("./composition.js");
  beforeAll(async () => {
    mod = await import("./composition.js");
    await mod.default.whenReady();
  });

  it("runs for the length of the cut", () => {
    const frames = cuts.segments.reduce(
      (sum, s) => sum + Math.round(s.end * cuts.fps) - Math.round(s.start * cuts.fps),
      0,
    );
    expect(mod.default.durationInFrames.get()).toBe(Math.max(1, frames));
  });

  it("opens on the first kept moment", () => {
    const first = cuts.segments[0];
    if (first) expect(mod.sourceTimeAt(0)).toBeCloseTo(Math.round(first.start * cuts.fps) / cuts.fps, 5);
  });

  it("passes its checks", async () => {
    const { default: checks } = await import("./composition.check.js");
    const report = await runChecks(mod.default, checks);
    expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });
});
`;
}

/** Write `compositions/<id>/` as a recut of `input.source`. */
export async function createRecut(
  root: string,
  input: NewInput & { source?: string },
  where: Pick<RunContext, "cwd" | "door"> = { cwd: root, door: "mcp" },
): Promise<{ dir: string; files: string[] }> {
  if (!input.source) {
    throw new UsageError(
      "A recut needs its footage: pass source, a path inside the project like footage/talk.mp4.",
    );
  }
  let source: string;
  try {
    source = projectSource(root, where.cwd, input.source, where.door);
  } catch (err) {
    if (err instanceof MediaError) {
      throw new UsageError(
        `${err.message} A recut needs footage it can read: bring it in with ${spell(where, "footage_add")} first.`,
      );
    }
    throw err;
  }
  const info = await cachedInfo(root, source);
  const { id, dir } = claimId(root, input);
  const { width, height } = FORMATS[input.format ?? "portrait"];
  const fps = 30;
  const end = Math.floor(info.duration * fps) / fps;
  const plan: CutPlan = {
    source,
    fps,
    segments: [{ start: 0, end }],
    seconds: Math.round(end * 1000) / 1000,
  };
  const fromComp = (rel: string) => relative(dir, join(root, rel)).split(sep).join("/");
  const transcript = transcriptFile(root, source);
  const f: RecutFiles = {
    id,
    title: input.title,
    group: input.group ?? DEFAULT_GROUP,
    description: input.description ?? "",
    width,
    height,
    footageImport: fromComp(source),
    source,
    transcriptImport: readTranscriptFor(root, source) ? fromComp(transcript) : null,
  };
  const files: Record<string, string> = {
    "index.ts": indexTs({ ...f, fps, seconds: plan.seconds }),
    "schema.ts": recutSchemaTs(),
    "composition.ts": recutCompositionTs(f),
    "composition.check.ts": recutCheckTs(f),
    "composition.test.ts": recutTestTs(f),
    "cuts.json": `${JSON.stringify(plan, null, 2)}\n`,
  };
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return { dir, files: Object.keys(files) };
}
