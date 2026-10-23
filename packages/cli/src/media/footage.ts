/**
 * `footage_add`: bring a recording into the project so the studio can serve
 * it. The file is copied whole, never trimmed, and the original is never
 * moved or changed. `footage/` stays out of git.
 */
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { FOOTAGE_DIR } from "@smoove/agent";
import type { CommandResult, RunContext } from "../commands.js";
import { done } from "../run.js";
import { expandHome, MediaError } from "./cache.js";
import { describeInfo, readInfo } from "./info.js";
import { runMedia } from "./runtime.js";

/** Make sure `.gitignore` ignores `footage/`, keeping what's there. */
function ignoreFootage(root: string): void {
  const file = join(root, ".gitignore");
  const body = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = body.split("\n").map((l) => l.trim());
  if (lines.some((l) => l === `${FOOTAGE_DIR}/` || l === FOOTAGE_DIR || l === `/${FOOTAGE_DIR}/`))
    return;
  const sepLine = body === "" || body.endsWith("\n") ? "" : "\n";
  writeFileSync(file, `${body}${sepLine}${FOOTAGE_DIR}/\n`);
}

/** True when two files hold the same bytes. Reads until the first difference. */
function sameBytes(a: string, b: string): boolean {
  if (statSync(a).size !== statSync(b).size) return false;
  const fa = openSync(a, "r");
  const fb = openSync(b, "r");
  try {
    const ba = Buffer.alloc(1 << 20);
    const bb = Buffer.alloc(1 << 20);
    for (;;) {
      const na = readSync(fa, ba, 0, ba.length, null);
      const nb = readSync(fb, bb, 0, bb.length, null);
      if (na !== nb || !ba.subarray(0, na).equals(bb.subarray(0, nb))) return false;
      if (na === 0) return true;
    }
  } finally {
    closeSync(fa);
    closeSync(fb);
  }
}

/** `footage/<name>`, or `<stem>-2<ext>` and on when a different file has the name. */
function destination(root: string, name: string, from: string): { rel: string; exists: boolean } {
  const ext = extname(name);
  const stem = basename(name, ext);
  for (let n = 1; ; n++) {
    const rel = `${FOOTAGE_DIR}/${n === 1 ? name : `${stem}-${n}${ext}`}`;
    const abs = join(root, rel);
    if (!existsSync(abs)) return { rel, exists: false };
    if (sameBytes(abs, from)) return { rel, exists: true };
  }
}

export function runFootageAdd(ctx: RunContext, input: { path: string }): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const path = expandHome(input.path);
    const abs = isAbsolute(path) ? path : resolve(ctx.cwd, path);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      throw new MediaError("not-found", `There's no file at ${input.path}.`);
    }
    const inside = relative(root, abs);
    if (!inside.startsWith("..") && !isAbsolute(inside)) {
      const source = inside.split(sep).join("/");
      const info = await readInfo(root, source);
      return done({ source, copied: false }, [
        `${source} is already in the project, so it stays where it is.`,
        ...describeInfo(info),
      ]);
    }

    const { rel, exists } = destination(root, basename(abs), abs);
    if (!exists) {
      mkdirSync(join(root, FOOTAGE_DIR), { recursive: true });
      copyFileSync(abs, join(root, rel), constants.COPYFILE_EXCL);
    }
    let info: Awaited<ReturnType<typeof readInfo>>;
    try {
      info = await readInfo(root, rel);
    } catch (err) {
      if (!exists) rmSync(join(root, rel), { force: true });
      throw err;
    }
    ignoreFootage(root);
    return done({ source: rel, copied: !exists }, [
      exists
        ? `${rel} is already here, so nothing was copied.`
        : `Copied the whole file to ${rel}. The original is unchanged.`,
      ...describeInfo(info),
      `Use ${rel} with the other media tools.`,
    ]);
  });
}
