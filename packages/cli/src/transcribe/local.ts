/**
 * Transcription on this machine: NVIDIA's Parakeet through sherpa-onnx, both
 * installed by `models` into the shared cache. sherpa-onnx is loaded from
 * there at run time, so it's never a dependency of the command line.
 */
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { join } from "node:path";
import type { TimeRange, TranscriptWord } from "@smoove/agent";
import { MediaError } from "../media/cache.js";
import type { SpeechEngine } from "./engines.js";
import {
  MODELS,
  megabytes,
  modelBytes,
  modelDir,
  modelInstalled,
  RUNTIME,
  runtimeDir,
  runtimeInstalled,
} from "./models.js";

/** What sherpa-onnx's offline recognizer returns for one stream. */
export interface SherpaResult {
  tokens: string[];
  /** Seconds from the start of the stream. */
  timestamps: number[];
  /** Seconds each token lasts, when the model reports it. */
  durations?: number[];
}

const r3 = (t: number) => Math.round(t * 1000) / 1000;
const marker = /^[\s▁]+/;

/**
 * Merge sub-word tokens into words. A token that starts with a space (or the
 * SentencePiece marker) starts a word; times are offset to source seconds.
 */
export function tokensToWords(
  result: SherpaResult,
  offset: number,
  chunkEnd: number,
): TranscriptWord[] {
  const groups: number[][] = [];
  result.tokens.forEach((token, i) => {
    if (groups.length === 0 || marker.test(token)) groups.push([i]);
    else (groups[groups.length - 1] as number[]).push(i);
  });
  return groups
    .map((g, gi) => {
      const first = g[0] as number;
      const last = g[g.length - 1] as number;
      const text = g
        .map((i) => (result.tokens[i] as string).replace(marker, ""))
        .join("")
        .trim();
      const start = offset + (result.timestamps[first] ?? 0);
      const nextStart = groups[gi + 1]
        ? offset + (result.timestamps[(groups[gi + 1] as number[])[0] as number] ?? 0)
        : chunkEnd;
      const dur = result.durations?.[last];
      const end = dur !== undefined ? offset + (result.timestamps[last] ?? 0) + dur : nextStart;
      return { text, start: r3(start), end: r3(Math.max(start, end)) };
    })
    .filter((w) => w.text.length > 0);
}

type Sherpa = {
  OfflineRecognizer: new (
    config: object,
  ) => {
    createStream(): { acceptWaveform(wave: { sampleRate: number; samples: Float32Array }): void };
    decode(stream: unknown): void;
    getResult(stream: unknown): SherpaResult;
  };
  readWave(path: string): { sampleRate: number; samples: Float32Array };
};

export function localEngine(dir: string): SpeechEngine {
  const languages = MODELS.parakeet.languages;
  return {
    name: "local",
    async unavailable(language) {
      const base = language?.toLowerCase().split(/[-_]/)[0];
      if (base && !languages.includes(base)) {
        return `Parakeet covers ${languages.join(" ")}, and "${language}" isn't one of them.`;
      }
      if (!runtimeInstalled(dir) || !modelInstalled(dir, "parakeet")) {
        return `Parakeet isn't installed (about ${megabytes(modelBytes("parakeet"))} for the model, plus the sherpa-onnx runtime from npm, once per machine). Install it with the models command after the user agrees.`;
      }
      return null;
    },
    async transcribe(wav: string, chunks: TimeRange[], opts) {
      const require = createRequire(join(runtimeDir(dir), "package.json"));
      let sherpa: Sherpa;
      try {
        sherpa = require(RUNTIME.package) as Sherpa;
      } catch (err) {
        throw new MediaError(
          "model-missing",
          `${RUNTIME.package} is installed but didn't load: ${err instanceof Error ? err.message : String(err)}. Reinstall it with the models command.`,
        );
      }
      const model = modelDir(dir, "parakeet");
      const recognizer = new sherpa.OfflineRecognizer({
        featConfig: { sampleRate: 16000, featureDim: 80 },
        modelConfig: {
          transducer: {
            encoder: join(model, "encoder.int8.onnx"),
            decoder: join(model, "decoder.int8.onnx"),
            joiner: join(model, "joiner.int8.onnx"),
          },
          tokens: join(model, "tokens.txt"),
          numThreads: Math.max(1, Math.min(4, cpus().length)),
          provider: "cpu",
          debug: 0,
          modelType: "nemo_transducer",
        },
      });
      const wave = sherpa.readWave(wav);
      const words: TranscriptWord[] = [];
      for (const [i, chunk] of chunks.entries()) {
        // decode() is synchronous: give the event loop a turn between chunks,
        // so a long transcription can hand back, report progress and stop.
        if (i > 0) await new Promise((r) => setImmediate(r));
        if (opts.signal.aborted) throw new MediaError("media-error", "Transcription was stopped.");
        const a = Math.max(0, Math.floor(chunk.start * wave.sampleRate));
        const b = Math.min(wave.samples.length, Math.ceil(chunk.end * wave.sampleRate));
        if (b <= a) continue;
        const stream = recognizer.createStream();
        stream.acceptWaveform({
          sampleRate: wave.sampleRate,
          samples: wave.samples.subarray(a, b),
        });
        recognizer.decode(stream);
        words.push(
          ...tokensToWords(recognizer.getResult(stream), a / wave.sampleRate, b / wave.sampleRate),
        );
        opts.progress((i + 1) / chunks.length);
      }
      return words;
    },
  };
}
