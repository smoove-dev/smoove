/**
 * `extract_audio`: the one media tool that writes a media file. It pulls a
 * source's audio out as its own file, for transcription or for the user. The
 * source itself is only read.
 */
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { type CommandResult, type RunContext, UsageError } from "../commands.js";
import { done } from "../run.js";
import { MediaError, mediaKey, projectSource } from "./cache.js";
import { cachedInfo, readInfo } from "./info.js";
import { clock, loadMedia, openInput, runMedia } from "./runtime.js";

export type ExtractPreset = "transcribe" | "m4a";

export interface ExtractOptions {
  preset: ExtractPreset;
  from?: number;
  to?: number;
  /** m4a only: where it goes, relative to the project. Default `<source name>.m4a`. */
  out?: string;
  /** Replace a file already at `out`. Never the source itself. */
  overwrite?: boolean;
}

const posix = (p: string) => p.split(sep).join("/");

/** Write the audio and return its path relative to `root`. */
export async function extractAudio(
  root: string,
  source: string,
  opts: ExtractOptions,
): Promise<string> {
  const info = await cachedInfo(root, source);
  if (!info.hasAudio) {
    throw new MediaError("no-audio-track", `${source} has no audio track to extract.`);
  }
  const range = opts.from !== undefined || opts.to !== undefined;
  let rel: string;
  if (opts.preset === "transcribe") {
    const suffix = range ? `-${opts.from ?? 0}-${opts.to ?? info.duration}` : "";
    rel = posix(relative(root, join(mediaKey(root, source).dir, `audio-16k${suffix}.wav`)));
  } else {
    rel = posix(opts.out ?? `${basename(source, extname(source))}.m4a`);
  }
  const abs0 = join(root, rel);
  if (rel === source) throw new UsageError("The audio can't be written over its own source file.");
  if (existsSync(abs0)) {
    // By device and inode, so another spelling of the source on a
    // case-insensitive disk still counts as the source.
    const a = statSync(abs0);
    const b = statSync(join(root, source));
    if (a.dev === b.dev && a.ino === b.ino) {
      throw new UsageError("The audio can't be written over its own source file.");
    }
    if (opts.preset === "m4a" && !opts.overwrite) {
      throw new UsageError(
        `${rel} already exists, so nothing was written. Choose another out, or pass overwrite to replace it.`,
      );
    }
  }

  const { mb } = await loadMedia();
  const abs = join(root, rel);
  const tmp = `${abs}.tmp-${process.pid}${extname(abs)}`;
  mkdirSync(join(abs, ".."), { recursive: true });
  const input = await openInput(root, source);
  try {
    const output = new mb.Output({
      format:
        opts.preset === "transcribe"
          ? new mb.WavOutputFormat()
          : new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.FilePathTarget(tmp),
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: { discard: true },
      audio:
        opts.preset === "transcribe"
          ? { codec: "pcm-s16", sampleRate: 16000, numberOfChannels: 1 }
          : { codec: "aac" },
      ...(range ? { trim: { start: opts.from ?? 0, end: opts.to ?? info.duration } } : {}),
    });
    if (!conversion.isValid) {
      throw new MediaError(
        "unsupported-codec",
        `smoove can't convert the audio in ${source}: ${conversion.discardedTracks.map((t) => t.reason).join(", ")}.`,
      );
    }
    await conversion.execute();
    renameSync(tmp, abs);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  } finally {
    input.dispose();
  }
  return rel;
}

export function runExtractAudio(
  ctx: RunContext,
  input: {
    source: string;
    preset?: ExtractPreset;
    from?: number;
    to?: number;
    out?: string;
    overwrite?: boolean;
  },
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    let out: string | undefined;
    if (input.out !== undefined) {
      const abs = isAbsolute(input.out) ? input.out : resolve(ctx.cwd, input.out);
      out = posix(relative(root, abs));
    }
    const rel = await extractAudio(root, source, {
      preset: input.preset ?? "m4a",
      from: input.from,
      to: input.to,
      out,
      overwrite: input.overwrite,
    });
    const info = await readInfo(root, rel);
    return done({ out: rel, duration: info.duration }, [
      rel,
      `Wrote ${clock(info.duration, 1)} of audio from ${source}${input.preset === "transcribe" ? " as 16 kHz mono WAV" : ""}. ${source} is unchanged.`,
    ]);
  });
}
