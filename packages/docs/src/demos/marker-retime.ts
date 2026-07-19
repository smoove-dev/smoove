import { Composition, interpolate, Rect, Sequence, Series, Text } from "@smoove/core";

/**
 * Two rows built by the same function; only the intro length differs. Each row
 * draws its timeline as a track, and a cue ring is anchored to
 * series.marker("code"). The cue code never changes between rows: the beat
 * moved, so the cue moved. Track geometry comes from marker.resolve(), the
 * one-time escape hatch for reading a frame number during setup.
 */
const width = 1280;
const height = 720;
const fps = 60;

const codeLen = 120;
const outroLen = 90;
const shortIntro = 60;
const longIntro = 120;
// Both rows share one clock; the comp spans the longer row.
const duration = longIntro + codeLen + outroLen;

const title = "Inter, system-ui, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const trackX = 100;
const trackW = width - 200;
const pxPerFrame = trackW / duration; // one scale for both rows, so the shift is visible

const comp = new Composition({
  id: "marker-retime",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
base.add(
  new Text({
    x: 0,
    y: 64,
    width,
    align: "center",
    text: 'cue: series.marker("code").start',
    fontSize: 30,
    fontFamily: mono,
    fill: "#e6edf3",
  }),
);
comp.add(base);

const segmentFills: Record<string, string> = {
  intro: "#1f6feb",
  code: "#bb8009",
  outro: "#1a7f76",
};

function buildRow(introLen: number, y: number, label: string): void {
  const series = new Series({ from: 0 });
  series
    .add({ durationInFrames: introLen, name: "intro" }, () => {})
    .add({ durationInFrames: codeLen, name: "code" }, () => {})
    .add({ durationInFrames: outroLen, name: "outro" }, () => {});

  const row = new Sequence();

  row.add(
    new Text({
      x: trackX,
      y: y - 46,
      text: label,
      fontSize: 26,
      fontFamily: title,
      fill: "#7d8590",
    }),
  );

  // Draw one segment per named scene, sized from the marker's resolved window.
  for (const name of ["intro", "code", "outro"]) {
    const m = series.marker(name);
    const start = m.start.resolve();
    const end = m.end.resolve();
    row.add(
      new Rect({
        x: trackX + start * pxPerFrame,
        y,
        width: (end - start) * pxPerFrame - 4,
        height: 56,
        cornerRadius: 8,
        fill: segmentFills[name],
      }),
    );
  }

  // Playhead sweeping the shared clock.
  const playhead = new Rect({ x: trackX, y: y - 12, width: 3, height: 80, fill: "#e6edf3" });
  row.add(playhead);
  row.register((frame) => {
    playhead.x(trackX + frame * pxPerFrame);
  });

  comp.add(row);

  // The cue: a ring anchored to the beat itself. Same code in both rows.
  const cueMarker = series.marker("code").start;
  const cueX = trackX + cueMarker.resolve() * pxPerFrame;
  const cueSeq = new Sequence({ from: cueMarker, durationInFrames: 40 });
  // Offset puts the origin at the ring's center, so scale() grows it in place.
  const ring = new Rect({
    x: cueX,
    y: y + 28,
    offsetX: 34,
    offsetY: 34,
    width: 68,
    height: 68,
    cornerRadius: 34,
    stroke: "#bc8cff",
    strokeWidth: 5,
  });
  cueSeq.add(ring);
  cueSeq.register((local) => {
    const t = interpolate(local, [0, 39], [0, 1]);
    ring.opacity(1 - t);
    const s = 1 + t * 0.9;
    ring.scale({ x: s, y: s });
  });
  comp.add(cueSeq);
}

buildRow(shortIntro, 220, "intro: 60 frames");
buildRow(longIntro, 470, "intro: 120 frames (retimed; the cue followed)");

export default comp;
