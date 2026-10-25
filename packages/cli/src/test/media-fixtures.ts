/**
 * Small media files made in the test itself, so the media tools have real
 * WAVs and MP4s to read without fixtures checked into the repo.
 */
import { writeFileSync } from "node:fs";
import type { TimeRange } from "@smoove/agent";

const inside = (t: number, ranges: TimeRange[]) => ranges.some((r) => t >= r.start && t < r.end);

/** A 16-bit mono WAV: a 440 Hz tone inside each `loud` range, digital silence elsewhere. */
export function writeWav(
  path: string,
  opts: { seconds: number; sampleRate?: number; loud: TimeRange[]; amplitude?: number },
): void {
  const rate = opts.sampleRate ?? 16000;
  const n = Math.round(opts.seconds * rate);
  const amp = opts.amplitude ?? 0.5;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = inside(t, opts.loud) ? amp * Math.sin(2 * Math.PI * 440 * t) : 0;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

export interface Mp4Options {
  seconds: number;
  fps: number;
  width: number;
  height: number;
  /** The frame at time `t`: one color, or a function of the pixel. */
  color(t: number, x: number, y: number): [number, number, number];
  /** 48 kHz stereo: a 440 Hz tone inside each `loud` range. */
  audio?: { loud: TimeRange[] };
  rotation?: 0 | 90 | 180 | 270;
  /** Seconds between keyframes. */
  keyframeEvery?: number;
}

/** An H.264 MP4 encoded through Mediabunny, the same path the renderer takes. */
export async function writeMp4(path: string, opts: Mp4Options): Promise<void> {
  const mb = await import("mediabunny");
  const { registerMediabunnyServer } = await import("@mediabunny/server");
  registerMediabunnyServer();

  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new mb.FilePathTarget(path),
  });
  const video = new mb.VideoSampleSource({
    codec: "avc",
    bitrate: 1e6,
    keyFrameInterval: opts.keyframeEvery ?? 1,
  });
  output.addVideoTrack(video, { frameRate: opts.fps, rotation: opts.rotation ?? 0 });
  const audio = opts.audio ? new mb.AudioSampleSource({ codec: "aac", bitrate: 128e3 }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const frames = Math.round(opts.seconds * opts.fps);
  const rgba = new Uint8Array(opts.width * opts.height * 4);
  for (let f = 0; f < frames; f++) {
    const t = f / opts.fps;
    for (let y = 0; y < opts.height; y++) {
      for (let x = 0; x < opts.width; x++) {
        const [r, g, b] = opts.color(t, x, y);
        const i = (y * opts.width + x) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
    const sample = new mb.VideoSample(rgba, {
      format: "RGBA",
      codedWidth: opts.width,
      codedHeight: opts.height,
      timestamp: t,
      duration: 1 / opts.fps,
    });
    await video.add(sample);
    sample.close();
  }

  if (audio && opts.audio) {
    const rate = 48000;
    const chunk = 4800;
    const total = Math.round(opts.seconds * rate);
    for (let start = 0; start < total; start += chunk) {
      const n = Math.min(chunk, total - start);
      const data = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const t = (start + i) / rate;
        const v = inside(t, opts.audio.loud) ? 0.5 * Math.sin(2 * Math.PI * 440 * t) : 0;
        data[i * 2] = v;
        data[i * 2 + 1] = v;
      }
      const sample = new mb.AudioSample({
        data,
        format: "f32",
        numberOfChannels: 2,
        sampleRate: rate,
        timestamp: start / rate,
      });
      await audio.add(sample);
      sample.close();
    }
  }
  await output.finalize();
}

/** A solid color for {@link Mp4Options.color}. */
export const solid = (rgb: [number, number, number]) => (): [number, number, number] => rgb;

/**
 * A JPEG photo stored `width` by `height`, with an EXIF orientation tag the
 * way phones save a picture taken sideways (6 means "turn 90 degrees
 * clockwise to show it"), so it displays `height` by `width`.
 */
export async function writeJpeg(
  path: string,
  opts: { width: number; height: number; orientation?: number },
): Promise<void> {
  const { Canvas } = await import("skia-canvas");
  const canvas = new Canvas(opts.width, opts.height);
  const g = canvas.getContext("2d");
  g.fillStyle = "#c83232";
  g.fillRect(0, 0, opts.width, opts.height);
  const jpeg = await canvas.toBuffer("jpeg");
  if (!opts.orientation) {
    writeFileSync(path, jpeg);
    return;
  }
  // A big-endian TIFF block with one IFD entry: Orientation (0x0112), SHORT.
  const tiff = Buffer.from([
    0x4d,
    0x4d,
    0,
    0x2a,
    0,
    0,
    0,
    8,
    0,
    1,
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    opts.orientation,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const size = body.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, size >> 8, size & 0xff]), body]);
  writeFileSync(path, Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]));
}
