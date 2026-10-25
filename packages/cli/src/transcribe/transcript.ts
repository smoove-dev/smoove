/**
 * Transcripts as words with times: reading the formats other tools write,
 * and writing the phrase-per-line text an agent reads and the subtitles a
 * person uses. All pure.
 */
import type { TranscriptWord } from "@smoove/agent";
import { MediaError } from "../media/cache.js";

/** A phrase ends at a gap this long. */
const PAUSE = 0.6;
const MAX_WORDS = 12;

export interface Parsed {
  words: TranscriptWord[];
  language: string | null;
  /** True when word times were spread across subtitle cues. */
  estimatedTimes: boolean;
}

const r3 = (t: number) => Math.round(t * 1000) / 1000;

/** Split a cue's text into words, timed in proportion to their length. */
function spread(text: string, start: number, end: number): TranscriptWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const total = words.reduce((a, w) => a + w.length, 0);
  if (total === 0) return [];
  const out: TranscriptWord[] = [];
  let before = 0;
  for (const w of words) {
    const a = start + ((end - start) * before) / total;
    before += w.length;
    const b = start + ((end - start) * before) / total;
    out.push({ text: w, start: r3(a), end: r3(b) });
  }
  return out;
}

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{3})/;

function seconds(stamp: string): number {
  const m = TIME.exec(stamp);
  if (!m) return Number.NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** SRT and VTT: blocks with a `start --> end` line and the text under it. */
function parseCues(body: string): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const block of body.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = (lines[at] as string).split("-->");
    const start = seconds(a ?? "");
    const end = seconds(b ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const text = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    words.push(...spread(text, start, end));
  }
  return words;
}

type JsonWord = {
  text?: unknown;
  word?: unknown;
  start?: unknown;
  end?: unknown;
  confidence?: unknown;
};

function toWord(w: JsonWord): TranscriptWord | null {
  const text = typeof w.text === "string" ? w.text : typeof w.word === "string" ? w.word : null;
  if (text === null || typeof w.start !== "number" || typeof w.end !== "number") return null;
  const word: TranscriptWord = { text: text.trim(), start: w.start, end: w.end };
  if (typeof w.confidence === "number") word.confidence = w.confidence;
  return word.text ? word : null;
}

function parseJson(body: string): Parsed {
  const data = JSON.parse(body) as unknown;
  const words = (list: unknown) =>
    Array.isArray(list) ? list.map((w) => toWord(w as JsonWord)).filter((w) => w !== null) : [];
  if (Array.isArray(data)) return { words: words(data), language: null, estimatedTimes: false };
  const obj = data as {
    words?: unknown;
    segments?: { words?: unknown; text?: unknown; start?: unknown; end?: unknown }[];
    language?: unknown;
    estimatedTimes?: unknown;
  };
  const language = typeof obj.language === "string" ? obj.language : null;
  if (Array.isArray(obj.words)) {
    return { words: words(obj.words), language, estimatedTimes: obj.estimatedTimes === true };
  }
  if (Array.isArray(obj.segments)) {
    if (obj.segments.every((s) => Array.isArray(s.words))) {
      return {
        words: obj.segments.flatMap((s) => words(s.words)),
        language,
        estimatedTimes: false,
      };
    }
    const cues = obj.segments.flatMap((s) =>
      typeof s.text === "string" && typeof s.start === "number" && typeof s.end === "number"
        ? spread(s.text, s.start, s.end)
        : [],
    );
    return { words: cues, language, estimatedTimes: true };
  }
  return { words: [], language, estimatedTimes: false };
}

/** Read a `.srt`, `.vtt` or transcript `.json` into words. */
export function parseTranscriptFile(name: string, body: string): Parsed {
  const lower = name.toLowerCase();
  let parsed: Parsed;
  try {
    parsed =
      lower.endsWith(".srt") || lower.endsWith(".vtt")
        ? { words: parseCues(body), language: null, estimatedTimes: true }
        : parseJson(body);
  } catch (err) {
    throw new MediaError(
      "media-error",
      `${name} isn't a transcript smoove can read: ${err instanceof Error ? err.message : String(err)}.`,
    );
  }
  if (parsed.words.length === 0) {
    throw new MediaError(
      "media-error",
      `${name} has no words smoove can read. It takes SRT, VTT, or JSON with words that have text, start and end.`,
    );
  }
  return parsed;
}

export interface Phrase {
  start: number;
  end: number;
  text: string;
}

/** Group words into phrases at punctuation, pauses, and every twelve words. */
export function phrases(words: TranscriptWord[], maxWords = MAX_WORDS): Phrase[] {
  const out: Phrase[] = [];
  let current: TranscriptWord[] = [];
  const close = () => {
    if (current.length === 0) return;
    out.push({
      start: (current[0] as TranscriptWord).start,
      end: (current[current.length - 1] as TranscriptWord).end,
      text: current.map((w) => w.text).join(" "),
    });
    current = [];
  };
  for (const [i, w] of words.entries()) {
    current.push(w);
    const next = words[i + 1];
    if (
      /[.?!]["')\]]*$/.test(w.text) ||
      current.length >= maxWords ||
      (next !== undefined && next.start - w.end >= PAUSE)
    ) {
      close();
    }
  }
  close();
  return out;
}

/** `mm:ss.s`, or `h:mm:ss.s` past an hour. */
function stamp(t: number): string {
  const tenths = Math.round(Math.max(0, t) * 10);
  const h = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const s = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${String(m).padStart(2, "0")}:${s}`;
}

/** One phrase per line, each starting with its timecode. */
export function toText(words: TranscriptWord[]): string {
  return phrases(words)
    .map((p) => `[${stamp(p.start)}] ${p.text}\n`)
    .join("");
}

function srtStamp(t: number): string {
  const ms = Math.round(Math.max(0, t) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
}

/** Subtitles, one cue per phrase. */
export function toSrt(words: TranscriptWord[]): string {
  return phrases(words)
    .map((p, i) => `${i + 1}\n${srtStamp(p.start)} --> ${srtStamp(p.end)}\n${p.text}\n`)
    .join("\n");
}
