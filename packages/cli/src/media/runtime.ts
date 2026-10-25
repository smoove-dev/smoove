/**
 * The media libraries, loaded on first use so the rest of the command line
 * stays quick to start, and one front door for every media command: find the
 * project, run, and turn a {@link MediaError} into the command's error answer.
 */
import { join } from "node:path";
import type { CommandResult, RunContext } from "../commands.js";
import { findProject } from "../project.js";
import { fail } from "../run.js";
import { MediaError } from "./cache.js";

type Libraries = {
  mb: typeof import("mediabunny");
  skia: typeof import("skia-canvas");
  media: typeof import("@smoove/media");
};

let loading: Promise<Libraries> | null = null;

/** Mediabunny plugged into FFmpeg through node-av, skia-canvas, and @smoove/media. */
export function loadMedia(): Promise<Libraries> {
  loading ??= (async () => {
    try {
      const [mb, server, skia, media] = await Promise.all([
        import("mediabunny"),
        import("@mediabunny/server"),
        import("skia-canvas"),
        import("@smoove/media"),
      ]);
      server.registerMediabunnyServer();
      return { mb, skia, media };
    } catch (err) {
      loading = null;
      throw new MediaError(
        "media-error",
        `The media tools need mediabunny, @mediabunny/server and skia-canvas, which didn't load: ${err instanceof Error ? err.message : String(err)}. Reinstall @smoove/cli.`,
      );
    }
  })();
  return loading;
}

/** A Mediabunny input over a project-relative source. Dispose it when done. */
export async function openInput(root: string, source: string) {
  const { mb } = await loadMedia();
  return new mb.Input({
    formats: mb.ALL_FORMATS,
    source: new mb.FilePathSource(join(root, source)),
  });
}

/** Run a media command in its project, answering a media failure with its code. */
export async function runMedia(
  ctx: RunContext,
  body: (root: string) => Promise<CommandResult>,
): Promise<CommandResult> {
  const root = findProject(ctx.cwd);
  if (!root) return fail("no-project", "There's no smoove project here or above.");
  try {
    return await body(root);
  } catch (err) {
    if (err instanceof MediaError) return fail(err.code, err.message);
    throw err;
  }
}

/** Seconds as m:ss, or h:mm:ss past an hour. */
export function clock(seconds: number, decimals = 0): string {
  // Round to the shown precision first, so 59.96 reads 1:00.0, never 0:60.0.
  const unit = 10 ** decimals;
  const s = decimals > 0 ? Math.round(Math.max(0, seconds) * unit) / unit : Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const sec =
    decimals > 0
      ? rest.toFixed(decimals).padStart(3 + decimals, "0")
      : String(Math.floor(rest)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
