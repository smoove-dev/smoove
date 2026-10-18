import { Composition, Group, Sequence, type VideoSource } from "@smoove/core";
import { describe, expect, it, vi } from "vitest";
import type { AudioDriver } from "../audio/audio-driver.js";
import { Video } from "./index.js";

const FPS = 30;

/** A ready source that records every seek, so a test can see what was decoded. */
function recordingSource(): VideoSource & { seeks: number[] } {
  const noop = () => {};
  const seeks: number[] = [];
  return {
    seeks,
    load: () => Promise.resolve(),
    element: null,
    naturalWidth: 1920,
    naturalHeight: 1080,
    duration: 60,
    currentTime: 0,
    isReady: true,
    seek: (t: number) => {
      seeks.push(t);
      return Promise.resolve();
    },
    play: () => Promise.resolve(),
    pause: noop,
    setMuted: noop,
    setVolume: noop,
    setPlaybackRate: noop,
    onReady: () => noop,
    onFrame: () => noop,
    destroy: noop,
  };
}

let n = 0;
function setup(mode: "preview" | "rendering") {
  n += 1;
  const comp = new Composition({
    id: `video-vis-${n}`,
    fps: FPS,
    durationInFrames: 60,
    width: 320,
    height: 180,
    mode,
  });
  const seq = new Sequence();
  comp.add(seq);
  const source = recordingSource();
  const holder = new Group();
  seq.add(holder);
  const video = new Video({
    src: "talk.mp4",
    width: 320,
    height: 180,
    sourceFactory: () => source,
  });
  holder.add(video);
  return { comp, video, holder, source };
}

/** Swap in a spy audio driver after the first tick has built the real ones. */
function spyAudio(video: Video): ReturnType<typeof vi.fn> {
  const tick = vi.fn();
  const spy: AudioDriver = { tick, deactivate: () => {}, dispose: () => {} };
  (video as unknown as { _audioDriver: AudioDriver | null })._audioDriver = spy;
  return tick;
}

describe("Video visibility: picture follows visibility, sound does not", () => {
  it("doesn't decode while the video is hidden", () => {
    const { comp, video, source } = setup("preview");
    comp.setFrame(1);
    expect(source.seeks).toHaveLength(1);

    video.visible(false);
    comp.setFrame(2);
    comp.setFrame(3);
    expect(source.seeks).toHaveLength(1);
  });

  it("doesn't decode while an ancestor group is hidden", () => {
    const { comp, holder, source } = setup("preview");
    holder.visible(false);
    comp.setFrame(1);
    comp.setFrame(2);
    expect(source.seeks).toHaveLength(0);
  });

  it("keeps the sound ticking while the picture is hidden (preview)", () => {
    const { comp, video } = setup("preview");
    comp.setFrame(1);
    const audioTick = spyAudio(video);

    video.visible(false);
    comp.setFrame(2);
    comp.setFrame(3);
    expect(audioTick.mock.calls.map((c) => c[0])).toEqual([2, 3]);
  });

  it("seeks straight to the current frame when shown again", () => {
    const { comp, video, source } = setup("preview");
    comp.setFrame(1);
    video.visible(false);
    for (let f = 2; f < 10; f++) comp.setFrame(f);

    video.visible(true);
    comp.setFrame(10);
    expect(source.seeks).toEqual([1 / FPS, 10 / FPS]);
  });

  it("records the soundtrack of a hidden video in a server render", () => {
    const { comp, video, source } = setup("rendering");
    video.visible(false);
    for (let f = 0; f < 5; f++) comp.setFrame(f);

    expect(source.seeks).toHaveLength(0);
    expect(comp.getAudioAssets().map((a) => a.frame)).toEqual([0, 1, 2, 3, 4]);
  });

  it("gates the re-shown frame on its own seek in a server render", async () => {
    const { comp, video, source } = setup("rendering");
    comp.setFrame(0);
    video.visible(false);
    for (let f = 1; f < 8; f++) comp.setFrame(f);

    video.visible(true);
    const delay = vi.spyOn(comp, "delayRender");
    comp.setFrame(8);
    expect(delay).toHaveBeenCalledTimes(1);
    await comp.whenReady();
    expect(source.seeks).toEqual([0, 8 / FPS]);
  });
});
