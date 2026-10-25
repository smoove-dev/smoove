import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Transcript, TranscriptWord } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeWav } from "../test/media-fixtures.js";
import type { SpeechEngine, TranscribeDeps } from "./engines.js";
import { runTranscribe } from "./run.js";
import { readTranscriptFor } from "./where.js";

let project: ReturnType<typeof tempProject>;

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
});

afterEach(() => project.remove());

const ctx = (): RunContext => ({
  cwd: project.root,
  env: {},
  sleep: async () => {},
  door: "mcp",
});

const engine = (name: "local" | "api", words: TranscriptWord[] | string): SpeechEngine => ({
  name,
  unavailable: async () => (typeof words === "string" ? words : null),
  transcribe: async () => (typeof words === "string" ? [] : words),
});

const deps = (local: SpeechEngine, api = engine("api", "No API is set up.")): TranscribeDeps => ({
  local,
  api,
});

const read = (rel: string) => readFileSync(join(project.root, rel), "utf8");
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nHello world.\n";

describe("transcribe", () => {
  it("imports a transcript into transcripts/", async () => {
    writeFileSync(join(project.root, "footage/talk.srt"), SRT);
    const result = await runTranscribe(ctx(), { source: "footage/talk.srt" });
    expect(result.code).toBe(0);
    for (const f of ["transcripts/talk.json", "transcripts/talk.txt", "transcripts/talk.srt"]) {
      expect(existsSync(join(project.root, f)), f).toBe(true);
      expect(result.text).toContain(f);
    }
    const t = JSON.parse(read("transcripts/talk.json")) as Transcript;
    expect(t).toMatchObject({ engine: "import", estimatedTimes: true });
    expect(t.words.map((x) => x.text)).toEqual(["Hello", "world."]);
    expect(read("transcripts/talk.txt")).toBe("[00:01.0] Hello world.\n");
  });

  it("warns when word times are estimated", async () => {
    writeFileSync(join(project.root, "footage/talk.srt"), SRT);
    const result = await runTranscribe(ctx(), { source: "footage/talk.srt" });
    expect(result.errors).toContain("estimated");
  });

  it("names an import after the media file beside it", async () => {
    writeWav(join(project.root, "footage/Talk.wav"), { seconds: 3, loud: [] });
    writeFileSync(join(project.root, "footage/Talk.srt"), SRT);
    await runTranscribe(ctx(), { source: "footage/Talk.srt" });
    const t = JSON.parse(read("transcripts/talk.json")) as Transcript;
    expect(t.source).toBe("footage/Talk.wav");
    expect(t.duration).toBeCloseTo(3, 1);
  });

  it("transcribes media with the first engine that can run", async () => {
    writeWav(join(project.root, "footage/talk.wav"), { seconds: 2, loud: [{ start: 0, end: 2 }] });
    const result = await runTranscribe(
      ctx(),
      { source: "footage/talk.wav" },
      deps(engine("local", [{ text: "hi", start: 0.2, end: 0.5 }])),
    );
    expect(result.code).toBe(0);
    const t = JSON.parse(read("transcripts/talk.json")) as Transcript;
    expect(t).toMatchObject({ source: "footage/talk.wav", engine: "local" });
    expect(t.words).toEqual([{ text: "hi", start: 0.2, end: 0.5 }]);
  });

  it("keeps a corrected transcript", async () => {
    writeWav(join(project.root, "footage/talk.wav"), { seconds: 2, loud: [{ start: 0, end: 2 }] });
    mkdirSync(join(project.root, "transcripts"));
    const corrected: Transcript = {
      source: "footage/talk.wav",
      duration: 2,
      language: "en",
      engine: "local",
      words: [{ text: "Rotem", start: 0.2, end: 0.5 }],
    };
    writeFileSync(join(project.root, "transcripts/talk.json"), JSON.stringify(corrected));
    const fake = deps(engine("local", [{ text: "Rotten", start: 0.2, end: 0.5 }]));

    const kept = await runTranscribe(ctx(), { source: "footage/talk.wav" }, fake);
    expect(kept.code).toBe(0);
    expect(kept.text).toContain("kept");
    expect(kept.text).toContain("fresh");
    expect((JSON.parse(read("transcripts/talk.json")) as Transcript).words[0]?.text).toBe("Rotem");

    await runTranscribe(ctx(), { source: "footage/talk.wav", fresh: true }, fake);
    expect((JSON.parse(read("transcripts/talk.json")) as Transcript).words[0]?.text).toBe("Rotten");
  });

  it("regenerates the text from the corrected JSON", async () => {
    mkdirSync(join(project.root, "transcripts"));
    const t: Transcript = {
      source: "footage/talk.wav",
      duration: 2,
      language: "en",
      engine: "local",
      words: [{ text: "Corrected.", start: 0.2, end: 0.5 }],
    };
    writeFileSync(join(project.root, "transcripts/talk.json"), JSON.stringify(t));
    writeFileSync(join(project.root, "transcripts/talk.txt"), "[00:00.2] Wrong.\n");
    const result = await runTranscribe(ctx(), { source: "transcripts/talk.json" });
    expect(result.code).toBe(0);
    expect(read("transcripts/talk.txt")).toBe("[00:00.2] Corrected.\n");
    expect(JSON.parse(read("transcripts/talk.json"))).toEqual(t);
  });

  it("rewrites a foreign transcript saved in transcripts/ into smoove's format", async () => {
    mkdirSync(join(project.root, "transcripts"));
    writeFileSync(
      join(project.root, "transcripts/talk.json"),
      JSON.stringify({
        language: "en",
        segments: [{ words: [{ word: " Hello", start: 1, end: 1.4 }] }],
      }),
    );
    const result = await runTranscribe(ctx(), { source: "transcripts/talk.json" });
    expect(result.code).toBe(0);
    const t = JSON.parse(read("transcripts/talk.json")) as Transcript;
    expect(t.words).toEqual([{ text: "Hello", start: 1, end: 1.4 }]);
    expect(t).toMatchObject({ engine: "import", language: "en" });
    expect(read("transcripts/talk.txt")).toBe("[00:01.0] Hello\n");
    expect(result.errors).toContain("no recording has the name");
  });

  it("ties a foreign transcript to the recording of its name, so cut_plan finds it", async () => {
    writeWav(join(project.root, "footage/talk.wav"), { seconds: 2, loud: [{ start: 0, end: 2 }] });
    mkdirSync(join(project.root, "transcripts"));
    writeFileSync(
      join(project.root, "transcripts/talk.json"),
      JSON.stringify({ words: [{ word: "Hello", start: 1, end: 1.4 }] }),
    );
    const result = await runTranscribe(ctx(), { source: "transcripts/talk.json" });
    expect(result.code).toBe(0);
    expect(result.errors ?? "").not.toContain("no recording");
    const t = JSON.parse(read("transcripts/talk.json")) as Transcript;
    expect(t).toMatchObject({ source: "footage/talk.wav", duration: 2 });
    expect(readTranscriptFor(project.root, "footage/talk.wav")?.words).toEqual([
      { text: "Hello", start: 1, end: 1.4 },
    ]);
  });

  it("keeps transcripts of different recordings with the same name apart", async () => {
    writeWav(join(project.root, "footage/talk.wav"), { seconds: 2, loud: [{ start: 0, end: 2 }] });
    writeWav(join(project.root, "footage/talk.mp4"), { seconds: 2, loud: [] });
    mkdirSync(join(project.root, "transcripts"));
    const other: Transcript = {
      source: "footage/talk.mp4",
      duration: 2,
      language: "en",
      engine: "local",
      words: [],
    };
    writeFileSync(join(project.root, "transcripts/talk.json"), JSON.stringify(other));
    const result = await runTranscribe(
      ctx(),
      { source: "footage/talk.wav" },
      deps(engine("local", [{ text: "hi", start: 0.2, end: 0.5 }])),
    );
    expect(result.text).not.toContain("kept");
    expect((JSON.parse(read("transcripts/talk-wav.json")) as Transcript).source).toBe(
      "footage/talk.wav",
    );
    expect(JSON.parse(read("transcripts/talk.json"))).toEqual(other);
  });

  it("says there's no audio to transcribe", async () => {
    const { writeMp4, solid } = await import("../test/media-fixtures.js");
    await writeMp4(join(project.root, "footage/silent.mp4"), {
      seconds: 1,
      fps: 10,
      width: 32,
      height: 32,
      color: solid([0, 0, 0]),
    });
    const result = await runTranscribe(
      ctx(),
      { source: "footage/silent.mp4" },
      deps(engine("local", [])),
    );
    expect((result.answer as { error: { code: string } }).error.code).toBe("no-audio-track");
  });

  it("explains what to do when nothing can transcribe", async () => {
    writeWav(join(project.root, "footage/talk.wav"), { seconds: 1, loud: [] });
    const result = await runTranscribe(
      ctx(),
      { source: "footage/talk.wav" },
      deps(engine("local", "Parakeet isn't installed."), engine("api", "No API is set up.")),
    );
    expect(result.code).toBe(1);
    expect((result.answer as { error: { code: string } }).error.code).toBe("model-missing");
    expect(result.errors).toContain("Parakeet isn't installed.");
    expect(result.errors).toContain("No API is set up.");
    expect(result.errors).toContain("If your own tools can transcribe");
  });
});
