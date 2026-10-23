import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeWav } from "../test/media-fixtures.js";
import { apiEngine } from "./api.js";

let dir: string;
let server: Server;
let url: string;
let seen: { auth: string | undefined; body: string }[];
let reply: (req: IncomingMessage, body: string) => { status: number; json: unknown };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "smoove-api-"));
  seen = [];
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      seen.push({ auth: req.headers.authorization, body });
      const r = reply(req, body);
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  url = `http://127.0.0.1:${addr.port}/v1/audio/transcriptions`;
  reply = () => ({ status: 200, json: { words: [{ word: "hi", start: 0.1, end: 0.3 }] } });
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

const env = () => ({ SMOOVE_TRANSCRIBE_URL: url, SMOOVE_TRANSCRIBE_KEY: "sk-secret-123" });
const opts = { language: "en", signal: new AbortController().signal, progress: () => {} };

describe("the transcription API", () => {
  it("sends the audio and reads word times", async () => {
    const wav = join(dir, "a.wav");
    writeWav(wav, { seconds: 1, loud: [{ start: 0, end: 1 }] });
    const words = await apiEngine(env()).transcribe(wav, [{ start: 0, end: 1 }], opts);
    expect(words).toEqual([{ text: "hi", start: 0.1, end: 0.3 }]);
    expect(seen[0]?.auth).toBe("Bearer sk-secret-123");
    const body = seen[0]?.body ?? "";
    expect(body).toContain('name="model"');
    expect(body).toContain("whisper-1");
    expect(body).toContain("verbose_json");
    expect(body).toContain('name="timestamp_granularities[]"');
    expect(body).toContain('name="language"');
    expect(body).toContain("RIFF");
  });

  it("uses the model the user set", async () => {
    const wav = join(dir, "a.wav");
    writeWav(wav, { seconds: 1, loud: [] });
    await apiEngine({ ...env(), SMOOVE_TRANSCRIBE_MODEL: "my-model" }).transcribe(
      wav,
      [{ start: 0, end: 1 }],
      opts,
    );
    expect(seen[0]?.body).toContain("my-model");
  });

  it("offsets each chunk's words", async () => {
    const wav = join(dir, "a.wav");
    writeWav(wav, { seconds: 3, loud: [{ start: 0, end: 3 }] });
    const words = await apiEngine(env()).transcribe(
      wav,
      [
        { start: 0, end: 1 },
        { start: 1.5, end: 3 },
      ],
      opts,
    );
    expect(words.map((w) => w.start)).toEqual([0.1, 1.6]);
    expect(seen).toHaveLength(2);
  });

  it("is unavailable without both variables", async () => {
    const why = await apiEngine({ SMOOVE_TRANSCRIBE_URL: url }).unavailable(null);
    expect(why).toContain("SMOOVE_TRANSCRIBE_URL");
    expect(why).toContain("SMOOVE_TRANSCRIBE_KEY");
    expect(await apiEngine(env()).unavailable(null)).toBeNull();
  });

  it("never puts the key in an error", async () => {
    reply = (req) => ({ status: 401, json: { error: `bad key ${req.headers.authorization}` } });
    const wav = join(dir, "a.wav");
    writeWav(wav, { seconds: 1, loud: [] });
    const failed = apiEngine(env()).transcribe(wav, [{ start: 0, end: 1 }], opts);
    await expect(failed).rejects.toThrow(/401/);
    await expect(failed).rejects.not.toThrow(/sk-secret-123/);
  });
});
