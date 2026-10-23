/**
 * Where the media tools keep what they learn about a source: one folder per
 * source under `.smoove/media/`, named for the file and keyed to its path,
 * size and modification time, so a changed source never reads stale results.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { type ErrorCode, MEDIA_DIR } from "@smoove/agent";
import { type RunContext, spell } from "../commands.js";

/** A media failure the agent can tell apart by its code. */
export class MediaError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** The cache folder for a project-relative `source`. */
export function mediaKey(root: string, source: string): { name: string; key: string; dir: string } {
  const st = statSync(join(root, source));
  const key = createHash("sha1")
    .update(`${source}\0${st.size}\0${st.mtimeMs}`)
    .digest("hex")
    .slice(0, 10);
  const name = basename(source, extname(source))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { name, key, dir: join(root, MEDIA_DIR, `${name}-${key}`) };
}

export function readCached<T>(dir: string, file: string): T | null {
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Write to a temporary name, then rename, so a reader never sees half a file. */
export function writeAtomic(path: string, body: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

/** A leading `~/` as the home folder: MCP arguments get no shell to expand it. */
export function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

/** `input` (resolved against `cwd`) as a path relative to `root`, which must hold it. */
export function projectSource(
  root: string,
  cwd: string,
  input: string,
  door: RunContext["door"],
): string {
  const expanded = expandHome(input);
  const abs = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new MediaError(
      "not-found",
      `${input} is outside the project. Call ${spell({ door }, "footage_add")} with it first, then use the path it returns.`,
    );
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new MediaError(
      "not-found",
      `There's no file at ${rel.split(sep).join("/")}. Give a path inside the project, or bring the file in with ${spell({ door }, "footage_add")}.`,
    );
  }
  return rel.split(sep).join("/");
}
