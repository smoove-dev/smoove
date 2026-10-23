/**
 * `transcribe`: every word of a recording with its time, written to
 * `transcripts/<name>.json` plus a phrase-per-line text file and subtitles.
 * The JSON is project data the agent corrects, so it is never overwritten
 * unless asked.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { FOOTAGE_DIR, TRANSCRIPTS_DIR, type Transcript } from "@smoove/agent";
import { type CommandResult, type RunContext, spell, UsageError } from "../commands.js";
import { readAudioMap } from "../media/audio-map.js";
import { MediaError, mediaKey, projectSource, writeAtomic } from "../media/cache.js";
import { extractAudio } from "../media/extract.js";
import { cachedInfo } from "../media/info.js";
import { awaitJob, startJob } from "../media/jobs.js";
import { runMedia } from "../media/runtime.js";
import { done, fail } from "../run.js";
import {
  CHUNK_PAD,
  CHUNK_SECONDS,
  chunkSpeech,
  defaultDeps,
  padChunks,
  type SpeechEngine,
  type TranscribeDeps,
} from "./engines.js";
import { parseTranscriptFile, toSrt, toText } from "./transcript.js";
import { isTranscript, transcriptName } from "./where.js";

const TRANSCRIPT_EXTS = [".srt", ".vtt", ".json"];
const MEDIA_EXTS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".m4a",
  ".mp3",
  ".wav",
  ".aac",
  ".flac",
  ".ogg",
  ".opus",
];

export interface TranscribeInput {
  source: string;
  engine?: "auto" | "import" | "local" | "api";
  language?: string;
  fresh?: boolean;
}

const files = (name: string) => ({
  json: `${TRANSCRIPTS_DIR}/${name}.json`,
  txt: `${TRANSCRIPTS_DIR}/${name}.txt`,
  srt: `${TRANSCRIPTS_DIR}/${name}.srt`,
});

/** Write the JSON (unless `keepJson`), the text and the subtitles. */
function write(root: string, name: string, t: Transcript, keepJson = false): string[] {
  const f = files(name);
  if (!keepJson) writeAtomic(join(root, f.json), `${JSON.stringify(t, null, 2)}\n`);
  writeAtomic(join(root, f.txt), toText(t.words));
  writeAtomic(join(root, f.srt), toSrt(t.words));
  return [f.json, f.txt, f.srt];
}

function kept(name: string): CommandResult {
  const f = files(name);
  return done({ kept: f.json }, [
    `${f.json} already exists, so it was kept: it may hold corrections. Pass fresh to replace it.`,
    `Read ${f.txt} for the words by time.`,
  ]);
}

function nextSteps(name: string): string {
  const f = files(name);
  return `Read ${f.txt}. Fix misheard words (names, technical terms) in ${f.json}, keeping each word's start and end, then run transcribe on ${f.json} to rewrite the text and subtitles.`;
}

/** A media file with a transcript file's name: beside it, else in footage/. */
function siblingMedia(root: string, source: string): string | null {
  const stem = basename(source, extname(source)).toLowerCase();
  for (const dir of [dirname(source), FOOTAGE_DIR]) {
    if (!existsSync(join(root, dir))) continue;
    const match = readdirSync(join(root, dir)).find(
      (f) =>
        basename(f, extname(f)).toLowerCase() === stem &&
        MEDIA_EXTS.includes(extname(f).toLowerCase()),
    );
    if (match) return dir === "." ? match : `${dir}/${match}`;
  }
  return null;
}

async function importTranscript(
  root: string,
  source: string,
  input: TranscribeInput,
): Promise<CommandResult> {
  const parsed = parseTranscriptFile(source, readFileSync(join(root, source), "utf8"));
  if (dirname(source) === TRANSCRIPTS_DIR && extname(source) === ".json") {
    const name = basename(source, ".json");
    const raw: unknown = JSON.parse(readFileSync(join(root, source), "utf8"));
    // Our own transcript: the agent corrected it, so rewrite only what's made from it.
    if (isTranscript(raw)) {
      const written = write(root, name, raw, true);
      return done({ files: written, words: raw.words.length }, [
        `Rewrote ${written[1]} and ${written[2]} from ${source}: ${raw.words.length} words.`,
      ]);
    }
    // Another tool's JSON saved here: rewrite it in smoove's shape, so cut_plan
    // and captions can read it. Its source is the recording, or they never
    // find it: the one it names, else the one with its name.
    const foreign = raw as { source?: unknown };
    const media =
      typeof foreign.source === "string" && existsSync(join(root, foreign.source))
        ? foreign.source
        : siblingMedia(root, source);
    const t: Transcript = {
      source: media ?? source,
      duration: media
        ? (await cachedInfo(root, media)).duration
        : (parsed.words[parsed.words.length - 1]?.end ?? 0),
      language: parsed.language ?? input.language ?? null,
      engine: "import",
      ...(parsed.estimatedTimes ? { estimatedTimes: true } : {}),
      words: parsed.words,
    };
    // The name the recording's tools look under; the same file unless the names differ.
    const target = media ? transcriptName(root, media) : name;
    const written = write(root, target, t);
    const result = done({ files: written, words: t.words.length }, [
      ...written,
      `Rewrote ${source} into smoove's transcript format: ${t.words.length} words.`,
      nextSteps(target),
    ]);
    if (!media) result.errors = unlinked(source);
    return result;
  }
  const media = siblingMedia(root, source);
  const name = media ? transcriptName(root, media) : mediaKey(root, source).name;
  if (existsSync(join(root, files(name).json)) && !input.fresh) return kept(name);
  const duration = media
    ? (await cachedInfo(root, media)).duration
    : (parsed.words[parsed.words.length - 1]?.end ?? 0);
  const t: Transcript = {
    source: media ?? source,
    duration,
    language: parsed.language ?? input.language ?? null,
    engine: "import",
    ...(parsed.estimatedTimes ? { estimatedTimes: true } : {}),
    words: parsed.words,
  };
  const written = write(root, name, t);
  const result = done({ files: written, words: t.words.length }, [
    ...written,
    `Imported ${t.words.length} words from ${source}.`,
    nextSteps(name),
  ]);
  const warnings = [
    ...(media ? [] : [unlinked(source)]),
    ...(parsed.estimatedTimes
      ? [
          "Warning: the word times are estimated from the subtitle cue times, so cuts and captions can land a little off a word.",
        ]
      : []),
  ];
  if (warnings.length) result.errors = warnings.join("\n");
  return result;
}

/** The warning for a transcript with no recording of its name to belong to. */
function unlinked(source: string): string {
  return `Warning: no recording has the name of ${source}, beside it or in ${FOOTAGE_DIR}/, so cut_plan and recuts won't find these words. Name the file after its recording and import it again.`;
}

async function pickEngine(
  ctx: RunContext,
  source: string,
  input: TranscribeInput,
  deps: TranscribeDeps,
): Promise<SpeechEngine | CommandResult> {
  const language = input.language ?? null;
  const order =
    input.engine === "local"
      ? [deps.local]
      : input.engine === "api"
        ? [deps.api]
        : [deps.local, deps.api];
  const reasons: string[] = [];
  for (const engine of order) {
    const why = await engine.unavailable(language);
    if (why === null) return engine;
    reasons.push(`${engine.name === "local" ? "On this machine" : "Through an API"}: ${why}`);
  }
  return fail(
    "model-missing",
    [
      `smoove can't transcribe ${source} here.`,
      ...reasons,
      `If your own tools can transcribe, use them and import the result with ${spell(ctx, "transcribe")}. Or ask the user whether to install local transcription with ${spell(ctx, "models")}, or to set SMOOVE_TRANSCRIBE_URL and SMOOVE_TRANSCRIBE_KEY.`,
    ].join(" "),
  );
}

export function runTranscribe(
  ctx: RunContext,
  input: TranscribeInput,
  deps: TranscribeDeps = defaultDeps(ctx.env),
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    const isTranscriptFile = TRANSCRIPT_EXTS.includes(extname(source).toLowerCase());
    if (isTranscriptFile && (input.engine ?? "auto") !== "local" && input.engine !== "api") {
      return importTranscript(root, source, input);
    }
    if (input.engine === "import") {
      throw new UsageError("engine import takes a .srt, .vtt or .json transcript file.");
    }

    const info = await cachedInfo(root, source);
    if (!info.hasAudio)
      throw new MediaError("no-audio-track", `${source} has no audio track to transcribe.`);
    const name = transcriptName(root, source);
    if (existsSync(join(root, files(name).json)) && !input.fresh) return kept(name);

    const engine = await pickEngine(ctx, source, input, deps);
    if (!("transcribe" in engine)) return engine;
    const speaker = engine;
    const job = startJob(root, "transcribe", source, async (report, signal) => {
      report(0, "Mapping the audio");
      const map = await readAudioMap(root, source);
      const chunks = padChunks(
        chunkSpeech(map.speech, CHUNK_SECONDS[speaker.name], map),
        CHUNK_PAD,
        info.duration,
      );
      report(0.05, "Extracting the audio");
      const wav = await extractAudio(root, source, { preset: "transcribe" });
      const words = await speaker.transcribe(join(root, wav), chunks, {
        language: input.language ?? null,
        // The job's own signal, never the request's: the job outlives a call
        // that hands back, and other calls may have joined it.
        signal,
        progress: (share) =>
          report(0.1 + share * 0.9, `Transcribing (${Math.round(share * 100)} percent)`),
      });
      const t: Transcript = {
        source,
        duration: info.duration,
        language: input.language ?? null,
        engine: speaker.name,
        words,
      };
      return write(root, name, t);
    });
    const result = await awaitJob(ctx, job);
    if ("handedBack" in result) {
      return done({ job: result.handedBack }, [
        `Still transcribing ${source}. It goes on in the background.`,
        `Check on it with ${spell(ctx, "media_status")}, job ${result.handedBack}.`,
      ]);
    }
    if (result.status === "error" && result.error)
      return fail(result.error.code, result.error.message);
    const written = result.result ?? [];
    const words = (JSON.parse(readFileSync(join(root, files(name).json), "utf8")) as Transcript)
      .words;
    return done({ files: written, words: words.length }, [
      ...written,
      `Transcribed ${words.length} words from ${source}.`,
      nextSteps(name),
    ]);
  });
}
