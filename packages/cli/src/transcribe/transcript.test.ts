import type { TranscriptWord } from "@smoove/agent";
import { describe, expect, it } from "vitest";
import { parseTranscriptFile, phrases, toSrt, toText } from "./transcript.js";

const w = (text: string, start: number, end: number): TranscriptWord => ({ text, start, end });

describe("parseTranscriptFile", () => {
  it("reads Whisper JSON words exactly", () => {
    const body = JSON.stringify({ segments: [{ words: [{ word: " Hi", start: 0.5, end: 0.8 }] }] });
    expect(parseTranscriptFile("talk.json", body)).toEqual({
      words: [w("Hi", 0.5, 0.8)],
      language: null,
      estimatedTimes: false,
    });
  });

  it("reads a top-level words list and its language", () => {
    const body = JSON.stringify({ language: "en", words: [{ word: "Hello", start: 1, end: 1.4 }] });
    expect(parseTranscriptFile("talk.json", body)).toMatchObject({
      words: [w("Hello", 1, 1.4)],
      language: "en",
    });
  });

  it("reads a flat word array", () => {
    const body = JSON.stringify([
      { text: "one", start: 0, end: 0.3 },
      { text: "two", start: 0.3, end: 0.7 },
    ]);
    expect(parseTranscriptFile("words.json", body).words).toEqual([
      w("one", 0, 0.3),
      w("two", 0.3, 0.7),
    ]);
  });

  it("reads its own transcript files", () => {
    const body = JSON.stringify({
      source: "footage/talk.mp4",
      duration: 3,
      language: "en",
      engine: "local",
      words: [w("again", 1, 1.5)],
    });
    expect(parseTranscriptFile("talk.json", body)).toEqual({
      words: [w("again", 1, 1.5)],
      language: "en",
      estimatedTimes: false,
    });
  });

  it("spreads SRT cue times across words and says so", () => {
    const body = "1\n00:00:01,000 --> 00:00:03,000\nab abcd\n";
    const got = parseTranscriptFile("talk.srt", body);
    expect(got.estimatedTimes).toBe(true);
    expect(got.words.map((x) => x.text)).toEqual(["ab", "abcd"]);
    expect(got.words[0]?.start).toBe(1);
    expect(got.words[1]?.end).toBe(3);
    expect(got.words[0]?.end).toBeCloseTo(1 + 2 * (2 / 6), 2);
    expect(got.words[1]?.start).toBeCloseTo(got.words[0]?.end as number, 5);
  });

  it("reads VTT", () => {
    const body =
      "WEBVTT\n\nNOTE made by hand\n\nintro\n00:01.000 --> 00:02.500 align:start\n<v Rotem>Hello there</v>\n";
    const got = parseTranscriptFile("talk.vtt", body);
    expect(got.words.map((x) => x.text)).toEqual(["Hello", "there"]);
    expect(got.words[0]?.start).toBe(1);
    expect(got.words[1]?.end).toBe(2.5);
  });

  it("refuses a file it can't read", () => {
    expect(() => parseTranscriptFile("talk.json", '{"nothing": true}')).toThrow(/no words/);
  });
});

describe("phrases", () => {
  it("ends a phrase after punctuation", () => {
    const got = phrases([w("Yes.", 0, 0.3), w("No", 0.4, 0.6)]);
    expect(got).toEqual([
      { start: 0, end: 0.3, text: "Yes." },
      { start: 0.4, end: 0.6, text: "No" },
    ]);
  });

  it("ends a phrase at a pause", () => {
    const got = phrases([w("one", 0, 0.3), w("two", 1.0, 1.3)]);
    expect(got.map((p) => p.text)).toEqual(["one", "two"]);
  });

  it("ends a phrase at twelve words", () => {
    const words = Array.from({ length: 13 }, (_, i) => w(`w${i}`, i * 0.2, i * 0.2 + 0.15));
    const got = phrases(words);
    expect(got).toHaveLength(2);
    expect(got[0]?.text.split(" ")).toHaveLength(12);
  });
});

describe("toText and toSrt", () => {
  it("writes a line per phrase with its timecode", () => {
    const text = toText([
      w("So", 192.4, 192.6),
      w("compound", 192.7, 193.2),
      w("interest.", 193.3, 193.9),
      w("Is", 195.9, 196.1),
      w("slow.", 196.2, 196.6),
    ]);
    expect(text).toBe("[03:12.4] So compound interest.\n[03:15.9] Is slow.\n");
  });

  it("shows hours past the first hour", () => {
    expect(toText([w("late", 3725.25, 3726)])).toBe("[1:02:05.3] late\n");
  });

  it("writes numbered subtitle cues", () => {
    expect(toSrt([w("Hi.", 1, 1.5), w("Bye", 3, 3.25)])).toBe(
      "1\n00:00:01,000 --> 00:00:01,500\nHi.\n\n2\n00:00:03,000 --> 00:00:03,250\nBye\n",
    );
  });
});
