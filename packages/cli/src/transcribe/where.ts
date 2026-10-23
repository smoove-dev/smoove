/**
 * Where a recording's transcript lives: `transcripts/<name>.json`, named for
 * the recording. Two recordings with the same name get different files, so
 * `transcribe`, `cut_plan` and recuts never read each other's words.
 */
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { TRANSCRIPTS_DIR, type Transcript } from "@smoove/agent";
import { mediaKey } from "../media/cache.js";

/** A parsed file that has smoove's transcript shape. */
export function isTranscript(x: unknown): x is Transcript {
  const t = x as Partial<Transcript> | null;
  return (
    typeof t === "object" &&
    t !== null &&
    typeof t.source === "string" &&
    Array.isArray(t.words) &&
    t.words.every(
      (w) =>
        typeof w === "object" &&
        w !== null &&
        typeof w.text === "string" &&
        typeof w.start === "number" &&
        typeof w.end === "number",
    )
  );
}

function read(root: string, name: string): unknown {
  try {
    return JSON.parse(readFileSync(join(root, TRANSCRIPTS_DIR, `${name}.json`), "utf8"));
  } catch {
    return undefined;
  }
}

/** True when `name`'s file is free, or holds `source`'s words (or words of unknown origin). */
function fits(root: string, name: string, source: string): boolean {
  if (!existsSync(join(root, TRANSCRIPTS_DIR, `${name}.json`))) return true;
  const t = read(root, name);
  if (!isTranscript(t)) return true;
  return t.source === source || !existsSync(join(root, t.source));
}

/** The transcript name for project-relative `source`: its file name, then with its extension, then with its cache key. */
export function transcriptName(root: string, source: string): string {
  const { name, key } = mediaKey(root, source);
  const ext = extname(source).slice(1).toLowerCase();
  for (const candidate of [name, ext ? `${name}-${ext}` : null, `${name}-${key}`]) {
    if (candidate && fits(root, candidate, source)) return candidate;
  }
  return `${name}-${key}`;
}

export function transcriptFile(root: string, source: string): string {
  return `${TRANSCRIPTS_DIR}/${transcriptName(root, source)}.json`;
}

/** `source`'s transcript, when there is one in smoove's shape. */
export function readTranscriptFor(root: string, source: string): Transcript | null {
  const t = read(root, transcriptName(root, source));
  return isTranscript(t) ? t : null;
}
