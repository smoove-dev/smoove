import { Clip, Composition, Rect, Sequence, Text } from "@smoove/core";

// ---------------------------------------------------------------------------
// Nested timelines, visualized. Each lane is a real Clip; the dim outline is
// its *planned* window (drawn statically from clip.from/durationInFrames, so
// marker-anchored lanes move if you retime their source), and the bright fill
// + local clock are children of the clip itself — they exist only while that
// timeline is active, and the clock counts the clip's own local frames.
//
// What each lane demonstrates:
//   A  — plain window: from/durationInFrames.
//   B  — anchored: from = A.marker().end, so retiming A moves B.
//   C  — an until: window that contains two nested clips.
//   C.1 — nested: its `from` is C-local; its clock starts when C.1 opens.
//   C.2 — nested and over-long: planned past C's end, so the parent closing
//         cuts it off mid-count (the hatched tail is never reached).
// ---------------------------------------------------------------------------

const width = 1280;
const height = 720;
const fps = 30;
const DUR = fps * 8; // 240 frames

const comp = new Composition({
  id: "clip-timelines",
  fps,
  durationInFrames: DUR,
  width,
  height,
  loop: true,
});

const INK = "#0d1117";
const TRACK = "#1c2333";
const MUTED = "#8b949e";
const TEXT = "#e6edf3";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const TRACK_X = 250;
const TRACK_W = 960;
const ROW_H = 86;
const ROW0_Y = 176;
const fToX = (f: number): number => TRACK_X + (f / DUR) * TRACK_W;

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: INK }));
comp.add(main);

// -- the timeline tree -------------------------------------------------------
const laneA = new Clip({ from: 30, durationInFrames: 75 }); //   [30, 105)
const laneB = new Clip({ from: laneA.marker().end, durationInFrames: 60 }); // [105, 165)
const laneC = new Clip({ from: 60, until: 210 }); //             [60, 210)
const laneC1 = new Clip({ from: 15, durationInFrames: 45 }); //  C-local — abs [75, 120)
const laneC2 = new Clip({ from: 75, durationInFrames: 90 }); //  C-local — abs [135, 225) planned,
laneC.add(laneC1); //                                            but C closes at 210: cut short.
laneC.add(laneC2);
main.add(laneA);
main.add(laneB);
main.add(laneC);

// -- header + second ruler ---------------------------------------------------
main.add(
  new Text({ x: TRACK_X, y: 60, text: "nested timelines", fontSize: 34, fill: TEXT }),
);
const headerClock = new Text({
  x: TRACK_X + 640,
  y: 66,
  width: 320,
  align: "right",
  text: "",
  fontSize: 22,
  fontFamily: MONO,
  fill: MUTED,
});
main.add(headerClock);

for (let s = 0; s <= 8; s++) {
  const x = fToX(s * fps);
  main.add(new Rect({ x, y: 140, width: 1, height: 16, fill: TRACK }));
  main.add(
    new Text({
      x: x - 20,
      y: 118,
      width: 40,
      align: "center",
      text: `${s}s`,
      fontSize: 15,
      fontFamily: MONO,
      fill: MUTED,
    }),
  );
}

// -- lanes -------------------------------------------------------------------
type Lane = {
  clip: Clip;
  label: string;
  detail: string;
  color: string;
  absFrom: number; // window start in composition frames, for drawing
  indent: number;
  plannedOverflow?: number; // frames planned past the parent's close
};

// C.2 plans 90 frames but its parent closes at 210: that tail is unreachable.
const C2_OVERFLOW = laneC.from + laneC2.from + laneC2.durationInFrames - 210;

// Window starts are read off the clips themselves (laneB's resolves through
// A's marker; the nested lanes add C's start), so the drawing follows retimes.
const lanes: Lane[] = [
  { clip: laneA, label: "A", detail: "from 30 · 75f", color: "#FF5640", absFrom: laneA.from, indent: 0 },
  { clip: laneB, label: "B", detail: "from A.end · 60f", color: "#FFC23C", absFrom: laneB.from, indent: 0 },
  { clip: laneC, label: "C", detail: "from 60 · until 210", color: "#15CDA8", absFrom: laneC.from, indent: 0 },
  { clip: laneC1, label: "C.1", detail: "C-local 15 · 45f", color: "#7C5CFF", absFrom: laneC.from + laneC1.from, indent: 1 },
  { clip: laneC2, label: "C.2", detail: "C-local 75 · 90f — cut by C", color: "#4ea1ff", absFrom: laneC.from + laneC2.from, indent: 1, plannedOverflow: C2_OVERFLOW },
];

lanes.forEach((lane, i) => {
  const rowY = ROW0_Y + i * ROW_H;
  const barY = rowY + 14;
  const barH = 40;
  const dur = lane.clip.durationInFrames;
  const x0 = fToX(lane.absFrom);
  const w = (dur / DUR) * TRACK_W;

  // Static plan art, in the sequence: label, base track, planned window.
  main.add(
    new Text({
      x: 40 + lane.indent * 28,
      y: rowY + 14,
      text: lane.label,
      fontSize: 24,
      fontFamily: MONO,
      fill: TEXT,
    }),
  );
  main.add(
    new Text({
      x: 40 + lane.indent * 28,
      y: rowY + 44,
      text: lane.detail,
      fontSize: 13,
      fontFamily: MONO,
      fill: MUTED,
    }),
  );
  main.add(
    new Rect({ x: TRACK_X, y: rowY + 32, width: TRACK_W, height: 4, cornerRadius: 2, fill: TRACK }),
  );
  main.add(
    new Rect({
      x: x0,
      y: barY,
      width: w,
      height: barH,
      cornerRadius: 8,
      stroke: lane.color,
      strokeWidth: 1.5,
      opacity: 0.45,
    }),
  );
  // The tail a nested clip planned past its parent's close — never reached.
  if (lane.plannedOverflow) {
    const cutX = fToX(lane.absFrom + dur - lane.plannedOverflow);
    main.add(
      new Rect({
        x: cutX,
        y: barY,
        width: fToX(lane.absFrom + dur) - cutX,
        height: barH,
        cornerRadius: 8,
        stroke: lane.color,
        strokeWidth: 1.5,
        dash: [4, 5],
        opacity: 0.3,
      }),
    );
  }

  // Live art, inside the clip: exists only while this timeline is active.
  const fill = new Rect({
    x: x0,
    y: barY,
    width: 0,
    height: barH,
    cornerRadius: 8,
    fill: lane.color,
    opacity: 0.28,
  });
  const clock = new Text({
    x: x0 + 10,
    y: barY + 11,
    width: 170,
    wrap: "none",
    text: "",
    fontSize: 16,
    fontFamily: MONO,
    fill: TEXT,
  });
  lane.clip.add(fill);
  lane.clip.add(clock);
  lane.clip.register((frame, info) => {
    fill.width((frame / info.durationInFrames) * w);
    clock.setText(`${frame}f · ${info.time.toFixed(2)}s`);
  });
});

// -- playhead ----------------------------------------------------------------
const playhead = new Rect({
  x: TRACK_X,
  y: 150,
  width: 2,
  height: ROW0_Y + lanes.length * ROW_H - 140,
  fill: TEXT,
  opacity: 0.7,
});
main.add(playhead);
main.register((frame, info) => {
  playhead.x(fToX(frame));
  headerClock.setText(`frame ${String(frame).padStart(3, "0")} · ${info.time.toFixed(2)}s`);
});

export default comp;
