import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DISCOVERY_FILE, type DiscoveryInfo } from "@smoove/agent";

/** What `smoove start` records about the dev server it launched. */
export interface DevRecord {
  /** The process group leader (the package manager running the dev script). */
  pid: number;
  startedAt: string;
  command: string;
}

export const DEV_FILE = ".smoove/dev.json";
export const DEV_LOG = ".smoove/dev.log";

/** Walk up from `from` to the first folder for which `test` is true. */
export function findUp(from: string, test: (dir: string) => boolean): string | null {
  let dir = from;
  for (;;) {
    if (test(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** The nearest folder with a `package.json` that has a `dev` script. */
export function findPackageRoot(from: string): string | null {
  return findUp(from, (dir) => {
    const file = join(dir, "package.json");
    if (!existsSync(file)) return false;
    try {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts?: Record<string, string> };
      return typeof pkg.scripts?.dev === "string";
    } catch {
      return false;
    }
  });
}

/**
 * The project the command runs in: the nearest folder with a discovery file,
 * else the nearest package with a `dev` script.
 */
export function findProject(from: string): string | null {
  return findUp(from, (dir) => existsSync(join(dir, DISCOVERY_FILE))) ?? findPackageRoot(from);
}

export function readJsonFile<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function readDiscoveryFile(root: string): DiscoveryInfo | null {
  return readJsonFile<DiscoveryInfo>(join(root, DISCOVERY_FILE));
}

export function readDevRecord(root: string): DevRecord | null {
  return readJsonFile<DevRecord>(join(root, DEV_FILE));
}

/** Is a process with this id running (and ours to signal)? */
export function alive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The running server's discovery info, or null if there's none or it's stale. */
export function liveServer(root: string): DiscoveryInfo | null {
  const info = readDiscoveryFile(root);
  return info && alive(info.pid) ? info : null;
}

/** The package manager the project uses, judged by the nearest lockfile. */
export function packageManager(root: string): "pnpm" | "yarn" | "bun" | "npm" {
  const found = findUp(root, (dir) =>
    ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json"].some((f) =>
      existsSync(join(dir, f)),
    ),
  );
  if (!found) return "npm";
  if (existsSync(join(found, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(found, "yarn.lock"))) return "yarn";
  if (existsSync(join(found, "bun.lockb")) || existsSync(join(found, "bun.lock"))) return "bun";
  return "npm";
}
