import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DISCOVERY_FILE, type DiscoveryInfo } from "../index.js";

export function discoveryPath(root: string): string {
  return join(root, DISCOVERY_FILE);
}

/** Write `.smoove/agent.json`, readable by the owner only. */
export function writeDiscovery(root: string, info: DiscoveryInfo): string {
  const file = discoveryPath(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`, { mode: 0o600 });
  // `mode` only applies when the file is created; tighten an existing one too.
  chmodSync(file, 0o600);
  return file;
}

export function readDiscovery(root: string): DiscoveryInfo | null {
  try {
    return JSON.parse(readFileSync(discoveryPath(root), "utf8")) as DiscoveryInfo;
  } catch {
    return null;
  }
}

/**
 * Remove the discovery file, but only if it is still ours: a second dev server
 * in the same root may have replaced it, and its file must survive our exit.
 * Synchronous, so it can run from a process `exit` handler.
 */
export function removeDiscovery(root: string, token: string): void {
  const current = readDiscovery(root);
  if (current && current.token !== token) return;
  try {
    rmSync(discoveryPath(root), { force: true });
  } catch {
    // Best effort.
  }
}
