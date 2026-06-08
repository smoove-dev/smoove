import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

let override: string | null = null;

/** Set a process-wide default ffmpeg binary path. */
export function setFfmpegPath(path: string): void {
  override = path;
}

/** Resolve the ffmpeg binary: explicit option → process default → installer. */
export function resolveFfmpegPath(opt?: string): string {
  return opt ?? override ?? ffmpegInstaller.path;
}
