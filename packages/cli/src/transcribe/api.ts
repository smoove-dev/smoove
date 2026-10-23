/**
 * Transcription through an OpenAI-compatible API the user set up: the audio
 * goes up a chunk at a time as WAV, and words with times come back.
 */
import { readFileSync } from "node:fs";
import {
  TRANSCRIBE_KEY_ENV,
  TRANSCRIBE_MODEL_ENV,
  TRANSCRIBE_URL_ENV,
  type TranscriptWord,
} from "@smoove/agent";
import { MediaError } from "../media/cache.js";
import type { SpeechEngine } from "./engines.js";

const DEFAULT_MODEL = "whisper-1";

/** The PCM inside a WAV file, and how to cut it by time. */
function readPcm(path: string) {
  const buf = readFileSync(path);
  let pos = 12;
  let format: { channels: number; rate: number; bits: number } | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      format = {
        channels: buf.readUInt16LE(pos + 10),
        rate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    }
    if (id === "data" && format) {
      const fmt = format;
      const data = buf.subarray(pos + 8, Math.min(buf.length, pos + 8 + size));
      const frame = (fmt.channels * fmt.bits) / 8;
      return {
        /** A standalone WAV of `[start, end)` seconds. */
        slice(start: number, end: number): Buffer {
          const a = Math.max(0, Math.floor(start * fmt.rate)) * frame;
          const b = Math.min(data.length, Math.ceil(end * fmt.rate) * frame);
          const pcm = data.subarray(a, Math.max(a, b));
          const head = Buffer.alloc(44);
          head.write("RIFF", 0);
          head.writeUInt32LE(36 + pcm.length, 4);
          head.write("WAVE", 8);
          head.write("fmt ", 12);
          head.writeUInt32LE(16, 16);
          head.writeUInt16LE(1, 20);
          head.writeUInt16LE(fmt.channels, 22);
          head.writeUInt32LE(fmt.rate, 24);
          head.writeUInt32LE(fmt.rate * frame, 28);
          head.writeUInt16LE(frame, 32);
          head.writeUInt16LE(fmt.bits, 34);
          head.write("data", 36);
          head.writeUInt32LE(pcm.length, 40);
          return Buffer.concat([head, pcm]);
        },
      };
    }
    pos += 8 + size + (size % 2);
  }
  throw new MediaError("media-error", `${path} isn't a PCM WAV file.`);
}

type ApiWord = { word?: unknown; text?: unknown; start?: unknown; end?: unknown };

function wordsOf(data: unknown): ApiWord[] {
  const d = data as { words?: ApiWord[]; segments?: { words?: ApiWord[] }[] };
  if (Array.isArray(d.words)) return d.words;
  if (Array.isArray(d.segments))
    return d.segments.flatMap((s) => (Array.isArray(s.words) ? s.words : []));
  return [];
}

const r3 = (t: number) => Math.round(t * 1000) / 1000;

export function apiEngine(env: NodeJS.ProcessEnv, fetcher: typeof fetch = fetch): SpeechEngine {
  const url = env[TRANSCRIBE_URL_ENV];
  const key = env[TRANSCRIBE_KEY_ENV];
  const model = env[TRANSCRIBE_MODEL_ENV] || DEFAULT_MODEL;
  const scrub = (text: string) => (key ? text.split(key).join("[the key]") : text);
  return {
    name: "api",
    async unavailable() {
      if (url && key) return null;
      return `No transcription API is set up. Set ${TRANSCRIBE_URL_ENV} to an OpenAI-compatible transcriptions endpoint and ${TRANSCRIBE_KEY_ENV} to its key.`;
    },
    async transcribe(wav, chunks, opts) {
      if (!url || !key)
        throw new MediaError("model-missing", (await this.unavailable(null)) as string);
      const pcm = readPcm(wav);
      const words: TranscriptWord[] = [];
      for (const [i, chunk] of chunks.entries()) {
        if (opts.signal.aborted) throw new MediaError("media-error", "Transcription was stopped.");
        const form = new FormData();
        form.append(
          "file",
          new Blob([new Uint8Array(pcm.slice(chunk.start, chunk.end))], { type: "audio/wav" }),
          "chunk.wav",
        );
        form.append("model", model);
        form.append("response_format", "verbose_json");
        form.append("timestamp_granularities[]", "word");
        if (opts.language) form.append("language", opts.language);
        let res: Response;
        try {
          res = await fetcher(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: form,
            signal: opts.signal,
          });
        } catch (err) {
          throw new MediaError(
            "media-error",
            scrub(
              `The transcription API at ${url} couldn't be reached: ${err instanceof Error ? err.message : String(err)}.`,
            ),
          );
        }
        const text = await res.text();
        if (!res.ok) {
          throw new MediaError(
            "media-error",
            scrub(`The transcription API answered ${res.status}: ${text.slice(0, 200)}`),
          );
        }
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new MediaError(
            "media-error",
            scrub(`The transcription API didn't answer with JSON: ${text.slice(0, 200)}`),
          );
        }
        for (const w of wordsOf(data)) {
          const t = typeof w.word === "string" ? w.word : typeof w.text === "string" ? w.text : "";
          if (!t.trim() || typeof w.start !== "number" || typeof w.end !== "number") continue;
          words.push({
            text: t.trim(),
            start: r3(chunk.start + w.start),
            end: r3(chunk.start + w.end),
          });
        }
        opts.progress((i + 1) / chunks.length);
      }
      return words;
    },
  };
}
