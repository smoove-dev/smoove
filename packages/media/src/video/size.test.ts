import { Block, setDefaultVideoSourceFactory, type VideoSource } from "@smoove/core";
import { beforeAll, describe, expect, it } from "vitest";
import { Video } from "./index.js";

/** A source that never loads: sizing doesn't need frames. */
function stubSource(): VideoSource {
  const noop = () => {};
  return {
    load: () => new Promise<void>(noop),
    element: null,
    naturalWidth: 0,
    naturalHeight: 0,
    duration: 0,
    currentTime: 0,
    isReady: false,
    seek: () => Promise.resolve(),
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

beforeAll(() => {
  setDefaultVideoSourceFactory(stubSource);
});

describe("Video sizing", () => {
  it("video honours width()", () => {
    const row = new Block({ width: 1280, flexDirection: "row", alignItems: "flex-start" });
    const video = new Video({ src: "clip.mp4", height: 90 });
    row.add(video);
    video.width("50%");
    expect(video.width()).toBe(640);
  });
});
