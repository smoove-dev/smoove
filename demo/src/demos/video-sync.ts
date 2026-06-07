import { Composition, Sequence, Video } from "@konva-motion/core";
import Konva from "konva";
import clip1Url from "../files/sync-test-1.mp4";
import clip2Url from "../files/sync-test-2.mp4";
import type { DemoDef } from "./types.js";

// Each clip is capped to its first 10s (300 frames @30fps) via `trimAfter`.
const PHASE = 300;
const TOTAL = PHASE * 3; // top plays, then bottom plays, then both together.

const NAME_1 = "sync-test-1.mp4";
const NAME_2 = "sync-test-2.mp4";

const PLAYING = "#3fb950";
const PAUSED = "#7d8590";

export const videoSyncDemo: DemoDef = {
  id: "video-sync",
  name: "Video — playback sync",
  build() {
    // Design canvas is a square 1080×1080 "motion video"; the player letterboxes
    // it into whatever space it's given (the render target stays 1080²).
    const SIDE = 1080;
    const comp = new Composition({
      id: "video-sync",
      fps: 30,
      durationInFrames: TOTAL,
      width: SIDE,
      height: SIDE,
    });

    // Region geometry — two stacked halves, each a label line above a video box.
    const labelH = Math.round(SIDE * 0.075);
    const topLabelY = Math.round(SIDE * 0.02);
    const topVideoY = topLabelY + labelH;
    const videoH = Math.round(SIDE * 0.4);
    const bottomLabelY = Math.round(SIDE * 0.52);
    const bottomVideoY = bottomLabelY + labelH;

    const videoBox = (y: number) => ({
      x: 0,
      y,
      width: SIDE,
      height: videoH,
      objectFit: "contain" as const, // preserve each clip's native aspect ratio
      muted: false,
      trimAfter: PHASE,
    });

    // ---- Base layer: background + the two persistent labels. Always visible. ----
    const base = new Sequence({ from: 0, durationInFrames: TOTAL });
    base.add(new Konva.Rect({ x: 0, y: 0, width: SIDE, height: SIDE, fill: "#0d1117" }));

    const mkName = (text: string, y: number) =>
      new Konva.Text({
        x: 28,
        y,
        text,
        fontSize: 30,
        fontStyle: "600",
        fontFamily: "Inter, sans-serif",
        fill: "#e6edf3",
      });
    const mkStatus = (y: number) =>
      new Konva.Text({
        x: 0,
        y,
        width: SIDE - 28,
        align: "right",
        text: "",
        fontSize: 30,
        fontStyle: "600",
        fontFamily: "Inter, sans-serif",
        fill: PAUSED,
      });

    const topName = mkName(NAME_1, topLabelY);
    const topStatus = mkStatus(topLabelY);
    const bottomName = mkName(NAME_2, bottomLabelY);
    const bottomStatus = mkStatus(bottomLabelY);
    base.add(topName, topStatus, bottomName, bottomStatus);
    comp.add(base);

    const render = (frame: number, playing: boolean) => {
      const topActive = frame < PHASE || frame >= 2 * PHASE; // phases A and C
      const bottomActive = frame >= PHASE; // phases B and C
      const topPlaying = topActive && playing;
      const bottomPlaying = bottomActive && playing;
      topStatus.text(topPlaying ? "playing" : "pause");
      topStatus.fill(topPlaying ? PLAYING : PAUSED);
      bottomStatus.text(bottomPlaying ? "playing" : "pause");
      bottomStatus.fill(bottomPlaying ? PLAYING : PAUSED);
    };
    base.register((frame) => render(frame, comp.isPlaying.get()));
    // Refresh the labels when play/pause toggles without a frame change.
    comp.isPlaying.subscribe((playing) => {
      render(comp.frame.get(), playing);
      base.batchDraw();
    });

    // ---- Phase A: top video plays to its end. ----
    const seqTop = new Sequence({ from: 0, durationInFrames: PHASE });
    seqTop.add(new Video({ src: clip1Url, ...videoBox(topVideoY) }));
    comp.add(seqTop);

    // ---- Phase B: bottom video plays to its end. ----
    const seqBottom = new Sequence({ from: PHASE, durationInFrames: PHASE });
    seqBottom.add(new Video({ src: clip2Url, ...videoBox(bottomVideoY) }));
    comp.add(seqBottom);

    // ---- Phase C: both play simultaneously from the start. ----
    const seqBoth = new Sequence({ from: 2 * PHASE, durationInFrames: PHASE });
    seqBoth.add(new Video({ src: clip1Url, ...videoBox(topVideoY) }));
    seqBoth.add(new Video({ src: clip2Url, ...videoBox(bottomVideoY) }));
    comp.add(seqBoth);

    return comp;
  },
};
