/**
 * `page_shot`: a screenshot of a web page, taken with the installed Chrome's
 * own screenshot flag and kept as a credited asset.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { MEDIA_DIR } from "@smoove/agent";
import { captureScreenshot, NoBrowserError } from "@smoove/agent/server";
import { type CommandResult, type RunContext, UsageError } from "../commands.js";
import { runMedia } from "../media/runtime.js";
import { done, fail } from "../run.js";
import { addAsset } from "./add.js";

/** `https://www.example.com/docs` as `example-com-docs`. */
export function pageName(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, "")}${u.pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function runPageShot(
  ctx: RunContext,
  input: { url: string; width?: number; height?: number; name?: string },
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new UsageError(`${input.url} isn't an address.`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fail("bad-request", `page_shot takes an http or https address, not ${url.protocol}.`);
    }
    const width = input.width ?? 1280;
    const height = input.height ?? 800;
    const work = join(root, MEDIA_DIR, "pages");
    mkdirSync(work, { recursive: true });
    // One name per call: parallel shots in one server each need their own
    // browser profile, or the second removes the first's and Chrome hands off.
    const run = `${process.pid}-${randomUUID().slice(0, 8)}`;
    const tmp = join(work, `shot-${run}.png`);
    try {
      await captureScreenshot(url.href, {
        out: tmp,
        width,
        height,
        profileDir: join(work, `profile-${run}`),
      });
    } catch (err) {
      if (err instanceof NoBrowserError) return fail("no-browser", err.message);
      return fail("media-error", err instanceof Error ? err.message : String(err));
    }
    try {
      const added = await addAsset(
        root,
        { path: tmp },
        {
          name: input.name ?? pageName(url.href),
          kind: "screenshot",
          license: "screenshot",
          page: url.href,
          source: url.href,
        },
      );
      return {
        ...done(added, [
          added.record.file,
          `A ${width} by ${height} screenshot of ${url.href}. In a composition: ${added.importLine}`,
        ]),
        images: [{ path: join(root, added.record.file), inline: true }],
      };
    } finally {
      rmSync(tmp, { force: true });
    }
  });
}
