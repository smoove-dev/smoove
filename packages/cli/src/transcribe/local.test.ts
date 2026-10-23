import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localEngine } from "./local.js";
import { RUNTIME, runtimeDir } from "./models.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "smoove-local-"));
  // A stand-in sherpa-onnx-node: every chunk decodes to one word.
  const pkg = join(runtimeDir(dir), "node_modules", RUNTIME.package);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: RUNTIME.package, main: "index.js" }),
  );
  writeFileSync(
    join(pkg, "index.js"),
    `exports.readWave = () => ({ sampleRate: 16000, samples: new Float32Array(16000 * 3) });
exports.OfflineRecognizer = class {
  createStream() { return { acceptWaveform() {} }; }
  decode() {}
  getResult() { return { tokens: [" hi"], timestamps: [0.1], durations: [0.2] }; }
};`,
  );
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const chunks = [
  { start: 0, end: 1 },
  { start: 1, end: 2 },
  { start: 2, end: 3 },
];

describe("local transcription", () => {
  it("lets other work run between chunks", async () => {
    const order: string[] = [];
    const running = localEngine(dir).transcribe("unused.wav", chunks, {
      language: "en",
      signal: new AbortController().signal,
      progress: () => order.push("chunk"),
    });
    setImmediate(() => order.push("other"));
    const words = await running;
    expect(words.map((w) => w.start)).toEqual([0.1, 1.1, 2.1]);
    // With a loop that never yields, "other" runs only after the last chunk.
    expect(order).toContain("other");
    expect(order.indexOf("other")).toBeLessThan(order.lastIndexOf("chunk"));
  });

  it("stops when asked between chunks", async () => {
    const stop = new AbortController();
    const running = localEngine(dir).transcribe("unused.wav", chunks, {
      language: "en",
      signal: stop.signal,
      progress: () => {},
    });
    setImmediate(() => stop.abort());
    await expect(running).rejects.toThrow(/stopped/);
  });
});
