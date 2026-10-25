import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CutPlan } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UsageError } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeWav } from "../test/media-fixtures.js";
import { createComposition, runNew } from "./new.js";
import { createRecut } from "./recut.js";

let project: ReturnType<typeof tempProject>;

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
});

afterEach(() => project.remove());

/** A 3 second recording at footage/talk.wav. */
function footage(): string {
  writeWav(join(project.root, "footage/talk.wav"), { seconds: 3, loud: [{ start: 0, end: 3 }] });
  return "footage/talk.wav";
}

const read = (rel: string) => readFileSync(join(project.root, rel), "utf8");

describe("smoove new --template recut", () => {
  it("writes a recut composition with a whole-source plan", async () => {
    const source = footage();
    const { dir, files } = await createRecut(project.root, { title: "Talk short", source });
    expect(dir).toBe(join(project.root, "compositions/talk-short"));
    expect([...files].sort()).toEqual(
      [
        "composition.check.ts",
        "composition.test.ts",
        "composition.ts",
        "cuts.json",
        "index.ts",
        "schema.ts",
      ].sort(),
    );
    const plan = JSON.parse(read("compositions/talk-short/cuts.json")) as CutPlan;
    expect(plan).toEqual({ source, fps: 30, segments: [{ start: 0, end: 90 / 30 }], seconds: 3 });
    const comp = read("compositions/talk-short/composition.ts");
    expect(comp).toContain("export const width = 1080;");
    expect(comp).toContain("export const height = 1920;");
  });

  it("needs footage it can read", async () => {
    await expect(
      createRecut(project.root, { title: "Talk", source: "footage/missing.mp4" }),
    ).rejects.toThrow(/footage_add/);
    await expect(createRecut(project.root, { title: "Talk" })).rejects.toBeInstanceOf(UsageError);
  });

  it("imports the footage relative to the composition", async () => {
    await createRecut(project.root, { title: "Talk", source: footage() });
    expect(read("compositions/talk/composition.ts")).toContain('"../../footage/talk.wav"');
  });

  it("captions from the transcript when there is one", async () => {
    const source = footage();
    mkdirSync(join(project.root, "transcripts"));
    writeFileSync(
      join(project.root, "transcripts/talk.json"),
      JSON.stringify({
        source,
        duration: 3,
        language: "en",
        engine: "import",
        words: [{ text: "hi", start: 0.5, end: 0.8 }],
      }),
    );
    await createRecut(project.root, { title: "Talk", source });
    expect(read("compositions/talk/composition.ts")).toContain('"../../transcripts/talk.json"');
  });

  it("uses nothing newer than ES2022, the projects' lib", async () => {
    const source = footage();
    mkdirSync(join(project.root, "transcripts"));
    writeFileSync(
      join(project.root, "transcripts/talk.json"),
      JSON.stringify({
        source,
        duration: 3,
        language: "en",
        engine: "import",
        words: [{ text: "hi", start: 0.5, end: 0.8 }],
      }),
    );
    await createRecut(project.root, { title: "Talk", source });
    const comp = read("compositions/talk/composition.ts");
    for (const api of ["findLast", "toSorted", "toReversed", ".at("])
      expect(comp, api).not.toContain(api);
  });

  it("leaves captions for later without a transcript", async () => {
    await createRecut(project.root, { title: "Talk", source: footage() });
    expect(read("compositions/talk/composition.ts")).not.toContain("transcripts/");
  });

  it("skips its own tests when the footage is missing", async () => {
    await createRecut(project.root, { title: "Talk", source: footage() });
    const test = read("compositions/talk/composition.test.ts");
    expect(test).toContain("skipIf");
    expect(test).toContain("footage/talk.wav");
  });

  it("refuses a folder that's already there", async () => {
    const source = footage();
    await createRecut(project.root, { title: "Talk", source });
    await expect(createRecut(project.root, { title: "Talk", source })).rejects.toThrow(
      /already there/,
    );
  });

  it("fades every cut with its frames in order, however short", async () => {
    await createRecut(project.root, { title: "Talk", source: footage() });
    const comp = read("compositions/talk/composition.ts");
    const fade = /const fade = (.+);/.exec(comp)?.[1];
    expect(fade).toBeDefined();
    const fadeFor = new Function("s", `return ${fade};`) as (s: { length: number }) => number;
    for (let length = 1; length <= 12; length++) {
      const f = fadeFor({ length });
      if (f < 1) continue;
      const range = [0, f, length - f, length];
      for (let i = 1; i < range.length; i++)
        expect(range[i], `length ${length}`).toBeGreaterThan(range[i - 1] as number);
    }
  });

  it("finds the footage from where the command runs", async () => {
    footage();
    const { dir } = await createRecut(
      project.root,
      { title: "Talk", source: "talk.wav" },
      { cwd: join(project.root, "footage"), door: "cli" },
    );
    expect(dir).toBe(join(project.root, "compositions/talk"));
    await expect(
      createRecut(
        project.root,
        { title: "Other", source: "missing.wav" },
        { cwd: project.root, door: "cli" },
      ),
    ).rejects.toThrow(/smoove agent footage_add/);
  });

  it("answers unreadable footage with a media error, not a throw", async () => {
    writeFileSync(join(project.root, "footage/broken.mp4"), "not a video");
    const result = await runNew(
      { cwd: project.root, env: {}, sleep: async () => {}, door: "cli" },
      { title: "Broken", template: "recut", source: "footage/broken.mp4" },
    );
    expect(result.code).toBe(1);
    expect((result.answer as { error: { code: string } }).error.code).toBe("media-error");
    expect(existsSync(join(project.root, "compositions/broken"))).toBe(false);
  });

  it("keeps the title card as the default", () => {
    const { files } = createComposition(project.root, { title: "Card" });
    expect(files).toHaveLength(5);
    expect(existsSync(join(project.root, "compositions/card/cuts.json"))).toBe(false);
    expect(readdirSync(join(project.root, "compositions/card"))).toHaveLength(5);
  });
});
