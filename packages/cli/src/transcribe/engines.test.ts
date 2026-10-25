import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chunkSpeech, padChunks } from "./engines.js";
import { localEngine, tokensToWords } from "./local.js";

describe("chunkSpeech", () => {
  it("packs speech into chunks under the limit", () => {
    expect(
      chunkSpeech(
        [
          { start: 0, end: 10 },
          { start: 12, end: 25 },
          { start: 27, end: 40 },
        ],
        30,
      ),
    ).toEqual([
      { start: 0, end: 25 },
      { start: 27, end: 40 },
    ]);
  });

  it("splits one long stretch evenly", () => {
    const got = chunkSpeech([{ start: 0, end: 70 }], 30);
    expect(got).toHaveLength(3);
    for (const c of got) expect(c.end - c.start).toBeCloseTo(70 / 3, 5);
    expect(got[0]?.start).toBe(0);
    expect(got[2]?.end).toBe(70);
  });

  it("cuts a long stretch at its quietest moment", () => {
    const curveDb = Array.from({ length: 40 * 4 }, (_, i) => (i === 22 * 4 ? -50 : -20));
    expect(chunkSpeech([{ start: 0, end: 40 }], 30, { curveHz: 4, curveDb })).toEqual([
      { start: 0, end: 22 },
      { start: 22, end: 40 },
    ]);
  });

  it("keeps nothing when nothing is spoken", () => {
    expect(chunkSpeech([], 30)).toEqual([]);
  });
});

describe("padChunks", () => {
  it("gives each chunk a little room, without overlapping its neighbour", () => {
    expect(
      padChunks(
        [
          { start: 1, end: 2 },
          { start: 2.2, end: 3 },
        ],
        0.3,
        3.1,
      ),
    ).toEqual([
      { start: 0.7, end: 2.1 },
      { start: 2.1, end: 3.1 },
    ]);
  });

  it("stays inside the file", () => {
    expect(padChunks([{ start: 0.1, end: 1 }], 0.3, 1.1)).toEqual([{ start: 0, end: 1.1 }]);
  });
});

describe("tokensToWords", () => {
  it("joins word pieces and offsets them by the chunk start", () => {
    const words = tokensToWords(
      {
        tokens: [" Hel", "lo", " world", "."],
        timestamps: [0.1, 0.3, 0.6, 0.9],
        durations: [0.2, 0.2, 0.3, 0.05],
      },
      60,
      62,
    );
    expect(words).toEqual([
      { text: "Hello", start: 60.1, end: 60.5 },
      { text: "world.", start: 60.6, end: 60.95 },
    ]);
  });

  it("reads the word marker some exports keep", () => {
    const words = tokensToWords({ tokens: ["▁Hi", "▁there"], timestamps: [0, 0.4] }, 0, 1);
    expect(words.map((w) => w.text)).toEqual(["Hi", "there"]);
    expect(words[0]?.end).toBe(0.4);
    expect(words[1]?.end).toBe(1);
  });
});

describe("localEngine", () => {
  it("turns away a language Parakeet doesn't cover", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smoove-cache-"));
    try {
      const why = await localEngine(dir).unavailable("he");
      expect(why).toContain("he");
      expect(why).toContain("en");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("says how to install it when it's missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smoove-cache-"));
    try {
      const why = await localEngine(dir).unavailable("en");
      expect(why).toMatch(/isn't installed/);
      expect(why).toMatch(/MB/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
