/**
 * `assets/credits.json`: every file an agent brought into the project, where
 * it came from and under what licence, so it can be reused and credited.
 */
import { join } from "node:path";
import { type AssetRecord, CREDITS_FILE } from "@smoove/agent";
import type { CommandResult, RunContext } from "../commands.js";
import { writeAtomic } from "../media/cache.js";
import { runMedia } from "../media/runtime.js";
import { readJsonFile } from "../project.js";
import { done } from "../run.js";

export function readCredits(root: string): AssetRecord[] {
  return readJsonFile<AssetRecord[]>(join(root, CREDITS_FILE)) ?? [];
}

/** Add a record, replacing one for the same file. */
export function addCredit(root: string, record: AssetRecord): void {
  const list = readCredits(root).filter((r) => r.file !== record.file);
  list.push(record);
  writeAtomic(join(root, CREDITS_FILE), `${JSON.stringify(list, null, 2)}\n`);
}

export function runAssets(ctx: RunContext): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const list = readCredits(root);
    if (list.length === 0)
      return done([], [`No assets yet. ${CREDITS_FILE} is written by asset_add and page_shot.`]);
    return done(
      list,
      list.map(
        (r) =>
          `${r.file}: ${r.kind}, ${r.license ?? "licence unknown"}${r.author ? `, by ${r.author}` : ""}${r.title ? `, "${r.title}"` : ""}. From ${r.page ?? r.source}.`,
      ),
    );
  });
}
