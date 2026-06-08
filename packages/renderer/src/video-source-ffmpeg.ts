import { type ChildProcess, spawn } from "node:child_process";
import type { Readable } from "node:stream";
import type { Environment, VideoSource, VideoSourceFactory } from "@konva-motion/core";
import { Canvas, ImageData } from "skia-canvas";
import { resolveFfmpegPath } from "./ffmpeg-bin.js";

type SeekMode = "precise" | "fast";

/**
 * How many frames we'll read-and-discard to reach a forward target before
 * giving up and restarting ffmpeg with a fresh `-ss` seek instead. Streaming a
 * frame is cheap (~ms); a process restart + container open + keyframe decode is
 * ~200ms — so we only restart for backward jumps or large skips (loops, reverse).
 */
const FORWARD_GAP_LIMIT = 48;

// Optional decode-resolution cap (0 = uncapped). skia-canvas retains the native
// pixels of every distinct frame ingested for the life of the process, so the
// memory cost of a video render scales with frame area × distinct frames.
// Decoding a (typically dimmed/background) clip at a smaller size cuts that cost
// proportionally. Konva upscales the smaller frame to its display box.
let DECODE_MAX_W = 0;
let DECODE_MAX_H = 0;

/** Cap the decode resolution of node video sources (0,0 = uncapped). */
export function setVideoDecodeCap(maxWidth: number, maxHeight: number): void {
  DECODE_MAX_W = Math.max(0, Math.floor(maxWidth));
  DECODE_MAX_H = Math.max(0, Math.floor(maxHeight));
}

type Probed = { width: number; height: number; duration: number; fps: number };

/** Probe a media file's video stream by parsing ffmpeg's stderr banner. */
function probe(src: string): Promise<Probed> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpegPath(), ["-hide_banner", "-i", src]);
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", () => {
      const dim = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
      const dur = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      const fpsM = err.match(/(\d+(?:\.\d+)?)\s*fps/) ?? err.match(/(\d+(?:\.\d+)?)\s*tbr/);
      if (!dim) {
        reject(new Error(`[konva-motion] could not probe video dimensions for ${src}`));
        return;
      }
      resolve({
        width: Number(dim[1]),
        height: Number(dim[2]),
        duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
        fps: fpsM ? Number(fpsM[1]) : 30,
      });
    });
  });
}

/**
 * Decoder-backed {@link VideoSource} with a **streaming** decoder. A single
 * ffmpeg process decodes the clip sequentially at a forced constant frame rate;
 * `seek()` advances by pulling/discarding frames off the pipe, and only restarts
 * the process (a `-ss` seek) on a backward jump or a large forward skip — e.g.
 * loop wrap-around or reverse playback. This avoids the one-process-per-frame
 * cost of naive seek-based extraction (roughly 10-50× faster for forward
 * renders, which is the common case). Decoded frames are blitted into an
 * offscreen skia `Canvas` that the konva skia backend draws.
 */
export class FfmpegVideoSource implements VideoSource {
  private _src = "";
  private _canvas: Canvas | null = null;
  private _width = 0;
  private _height = 0;
  private _duration = 0;
  private _outFps = 30;
  private _ready = false;
  private readonly _readyCbs = new Set<() => void>();
  private readonly _frameCbs = new Set<() => void>();

  // Streaming decoder state.
  private _proc: ChildProcess | null = null;
  private _stdout: Readable | null = null;
  /** Approx. media time of the frame currently in the canvas; NaN when no stream. */
  private _curTime = Number.NaN;
  /** Serializes overlapping seek() calls so the pipe is read by one consumer. */
  private _chain: Promise<void> = Promise.resolve();

  // Frame reassembly: ffmpeg writes arbitrary-sized chunks; we slice them into
  // fixed `width*height*4` RGBA frames. Flowing mode + pause/resume keeps memory
  // bounded (reading a frame-sized chunk via `stream.read(size)` stalls when the
  // frame is larger than the stream's highWaterMark).
  private _chunks: Buffer[] = [];
  private _bufLen = 0;
  private _ended = false;
  private _streamErr: Error | null = null;
  private _pending: { resolve: (b: Buffer | null) => void; reject: (e: Error) => void } | null =
    null;

  // Reused per-frame buffers — allocated once in load(). A fresh `ImageData`
  // per frame allocates a native skia buffer that V8's GC can't see, which
  // balloons RSS and collapses throughput over a long render. We reassemble each
  // frame into `_frameBuf`, copy it into the pixel array backing a single
  // reused `ImageData`, and `putImageData` that.
  private _frameBuf: Buffer | null = null;
  private _pixels: Uint8ClampedArray | null = null;
  private _imageData: ImageData | null = null;

  get element(): CanvasImageSource | null {
    return this._canvas as unknown as CanvasImageSource | null;
  }
  get naturalWidth(): number {
    return this._width;
  }
  get naturalHeight(): number {
    return this._height;
  }
  get duration(): number {
    return this._duration;
  }
  get currentTime(): number {
    return Number.isNaN(this._curTime) ? 0 : this._curTime;
  }
  get isReady(): boolean {
    return this._ready;
  }

  private get _frameSize(): number {
    return this._width * this._height * 4;
  }

  async load(src: string): Promise<void> {
    this._src = src;
    const { width, height, duration, fps } = await probe(src);
    let dw = width;
    let dh = height;
    if (DECODE_MAX_W > 0 && DECODE_MAX_H > 0 && (width > DECODE_MAX_W || height > DECODE_MAX_H)) {
      const scale = Math.min(DECODE_MAX_W / width, DECODE_MAX_H / height);
      dw = Math.max(2, Math.round((width * scale) / 2) * 2);
      dh = Math.max(2, Math.round((height * scale) / 2) * 2);
    }
    this._width = dw;
    this._height = dh;
    this._duration = duration;
    this._outFps = fps > 0 ? fps : 30;
    this._canvas = new Canvas(dw, dh);
    const size = dw * dh * 4;
    this._frameBuf = Buffer.allocUnsafe(size);
    this._pixels = new Uint8ClampedArray(size);
    this._imageData = new ImageData(this._pixels, dw, dh);
    this._ready = true;
    for (const cb of this._readyCbs) cb();
  }

  seek(timeSeconds: number, _mode: SeekMode = "precise"): Promise<void> {
    const run = () => this._doSeek(timeSeconds);
    // Run after whatever is in flight (success or failure), and never let a
    // rejected step poison the chain for the next seek.
    const p = this._chain.then(run, run);
    this._chain = p.then(
      () => {},
      () => {},
    );
    return p;
  }

  private async _doSeek(timeSeconds: number): Promise<void> {
    if (!this._canvas) return;
    const t = Math.max(0, this._duration > 0 ? Math.min(this._duration, timeSeconds) : timeSeconds);
    const framesAhead = Number.isNaN(this._curTime)
      ? Number.POSITIVE_INFINITY
      : Math.round((t - this._curTime) * this._outFps);

    // Already showing this frame.
    if (this._proc && this._stdout && framesAhead === 0) return;

    // First frame, a backward jump, or a big forward skip → fresh seek.
    if (!this._proc || !this._stdout || framesAhead < 0 || framesAhead > FORWARD_GAP_LIMIT) {
      await this._restart(t);
      return;
    }

    // Stream forward: the last of `framesAhead` frames is the target.
    let buf: Buffer | null = null;
    for (let i = 0; i < framesAhead; i++) {
      const f = await this._readFrame();
      if (!f) {
        // Unexpected EOF (clip ended early) — fall back to a precise reseek.
        await this._restart(t);
        return;
      }
      buf = f;
    }
    if (buf) this._paint(buf);
    this._curTime = t;
  }

  /** Kill any running decoder and start a new one seeked to `t`, drawing frame 1. */
  private async _restart(t: number): Promise<void> {
    this._stopProc();
    const proc = spawn(
      resolveFfmpegPath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(t),
        "-i",
        this._src,
        "-an",
        "-vf",
        `fps=${this._outFps},scale=${this._width}:${this._height}`,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    this._proc = proc;
    this._attachStream(proc.stdout as Readable);
    proc.stderr?.resume(); // drain so ffmpeg never blocks on a full stderr pipe
    proc.once("error", () => {
      this._streamErr = this._streamErr ?? new Error("[konva-motion] ffmpeg process error");
      this._satisfy();
    });

    const first = await this._readFrame();
    if (!first) {
      // Nothing decoded (t at/past the clip end) — freeze on the last drawn
      // frame. Mark position as `t` (not NaN) so repeated clamped seeks to the
      // tail are no-ops (framesAhead === 0) instead of re-spawning ffmpeg every
      // frame.
      this._curTime = t;
      return;
    }
    this._paint(first);
    this._curTime = t;
  }

  /** Flowing-mode reader: accumulate chunks, satisfy pending reads, backpressure. */
  private _attachStream(stream: Readable): void {
    this._stdout = stream;
    this._chunks = [];
    this._bufLen = 0;
    this._ended = false;
    this._streamErr = null;
    this._pending = null;
    stream.on("data", (chunk: Buffer) => {
      this._chunks.push(chunk);
      this._bufLen += chunk.length;
      this._satisfy();
      // Cap in-memory buffering at ~6 frames; resumed once a frame is consumed.
      if (this._bufLen > 6 * this._frameSize) stream.pause();
    });
    stream.once("end", () => {
      this._ended = true;
      this._satisfy();
    });
    stream.once("error", (e: Error) => {
      this._streamErr = e;
      this._satisfy();
    });
  }

  /** Resolve a waiting `_readFrame` if a full frame (or EOF/error) is available. */
  private _satisfy(): void {
    const p = this._pending;
    if (!p) return;
    if (this._streamErr) {
      this._pending = null;
      p.reject(this._streamErr);
      return;
    }
    const frame = this._take(this._frameSize);
    if (frame) {
      this._pending = null;
      if (this._stdout?.isPaused() && this._bufLen < 2 * this._frameSize) this._stdout.resume();
      p.resolve(frame);
      return;
    }
    if (this._ended) {
      this._pending = null;
      p.resolve(null);
    }
  }

  /** Slice `size` bytes off the front of the chunk queue into the reused buffer. */
  private _take(size: number): Buffer | null {
    if (this._bufLen < size || !this._frameBuf) return null;
    const out = this._frameBuf;
    let off = 0;
    while (off < size) {
      const c = this._chunks[0] as Buffer;
      const need = size - off;
      if (c.length <= need) {
        c.copy(out, off);
        off += c.length;
        this._chunks.shift();
      } else {
        c.copy(out, off, 0, need);
        this._chunks[0] = c.subarray(need);
        off += need;
      }
    }
    this._bufLen -= size;
    return out;
  }

  /** Pull exactly one frame off the decoder pipe (null on EOF). */
  private _readFrame(): Promise<Buffer | null> {
    if (!this._stdout) return Promise.resolve(null);
    if (this._stdout.isPaused() && this._bufLen <= 6 * this._frameSize) this._stdout.resume();
    return new Promise<Buffer | null>((resolve, reject) => {
      this._pending = { resolve, reject };
      this._satisfy();
    });
  }

  /** Blit an RGBA frame into the offscreen canvas and notify listeners. */
  private _paint(raw: Buffer): void {
    const canvas = this._canvas;
    const pixels = this._pixels;
    const img = this._imageData;
    if (!canvas || !pixels || !img) return;
    const need = this._frameSize;
    if (raw.length < need) return;
    // Copy decoded bytes into the reused ImageData's pixel array, then blit.
    pixels.set(raw.subarray(0, need));
    canvas.getContext("2d").putImageData(img, 0, 0);
    for (const cb of this._frameCbs) cb();
  }

  private _stopProc(): void {
    if (this._stdout) {
      this._stdout.removeAllListeners();
      this._stdout = null;
    }
    if (this._proc) {
      this._proc.removeAllListeners();
      this._proc.stderr?.removeAllListeners();
      try {
        this._proc.kill("SIGKILL");
      } catch {
        // already gone
      }
      this._proc = null;
    }
    if (this._pending) {
      const p = this._pending;
      this._pending = null;
      p.resolve(null);
    }
    this._chunks = [];
    this._bufLen = 0;
    this._ended = false;
    this._streamErr = null;
  }

  async play(): Promise<void> {}
  pause(): void {}
  setMuted(): void {}
  setVolume(): void {}
  setPlaybackRate(): void {}

  onReady(cb: () => void): () => void {
    this._readyCbs.add(cb);
    return () => this._readyCbs.delete(cb);
  }
  onFrame(cb: () => void): () => void {
    this._frameCbs.add(cb);
    return () => this._frameCbs.delete(cb);
  }
  destroy(): void {
    this._stopProc();
    this._readyCbs.clear();
    this._frameCbs.clear();
    this._canvas = null;
  }
}

export const nodeVideoSourceFactory: VideoSourceFactory = (_env: Environment) =>
  new FfmpegVideoSource();
