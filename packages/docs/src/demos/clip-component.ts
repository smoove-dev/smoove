import {
  Circle,
  Clip,
  type ClipOptions,
  Composition,
  Easing,
  interpolate,
  Rect,
  Sequence,
  Text,
} from "@smoove/core";

/**
 * One component, mounted three times. `beacon()` returns a Clip, so each copy
 * carries its own animation. Geometry is authored in a 100-unit box and scaled
 * by `size`, and timing is read in seconds from `info.time`, so every copy
 * plays the same motion at a different scale and a different offset.
 */
const width = 1280;
const height = 720;
const fps = 30;

const comp = new Composition({
  id: "clip-component",
  fps,
  durationInFrames: fps * 6,
  width,
  height,
  loop: true,
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The authored box. Every number below is in units of this square. */
const VIEW = 100;
const CYCLE = 2; // seconds per pulse

type BeaconProps = Omit<ClipOptions, "scaleX" | "scaleY"> & {
  /** Edge of the square the beacon is drawn in, in px. */
  size: number;
  /** Seconds of clip-local time before the first pulse. */
  delay?: number;
  color?: string;
};

/** A pulsing beacon. Drop the returned clip into any sequence or clip. */
function beacon(props: BeaconProps): Clip {
  const { size, delay = 0, color = "#80ffdb", ...clipOpts } = props;
  const clip = new Clip({ ...clipOpts, scaleX: size / VIEW, scaleY: size / VIEW });

  const ring = new Circle({
    x: VIEW / 2,
    y: VIEW / 2,
    radius: VIEW / 2 - 4,
    stroke: color,
    strokeWidth: 3,
    opacity: 0,
  });
  const core = new Circle({ x: VIEW / 2, y: VIEW / 2, radius: 14, fill: color });
  clip.add(ring);
  clip.add(core);

  clip.register((_frame, info) => {
    const t = (info.time - delay + CYCLE) % CYCLE;

    // The ring expands outward and fades as it goes.
    const grow = interpolate(t, [0, CYCLE * 0.8], [0.25, 1], {
      easing: Easing.out(Easing.cubic),
      ...clamp,
    });
    ring.scaleX(grow);
    ring.scaleY(grow);
    ring.opacity(interpolate(t, [0, CYCLE * 0.1, CYCLE * 0.8], [0, 0.9, 0], clamp));

    // The core beats once per cycle.
    const beat = interpolate(t, [0, 0.12, 0.5], [1, 1.35, 1], {
      easing: Easing.out(Easing.quad),
      ...clamp,
    });
    core.scaleX(beat);
    core.scaleY(beat);
  });

  return clip;
}

const scene = new Sequence();
scene.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(scene);

const copies = [
  { size: 260, delay: 0, x: 150, color: "#4cc9f0" },
  { size: 160, delay: 0.35, x: 545, color: "#b5179e" },
  { size: 100, delay: 0.7, x: 870, color: "#80ffdb" },
];

for (const copy of copies) {
  scene.add(
    beacon({
      size: copy.size,
      delay: copy.delay,
      color: copy.color,
      x: copy.x,
      y: 260 - copy.size / 2 + 130,
    }),
  );
  scene.add(
    new Text({
      x: copy.x - 60,
      y: 470,
      width: copy.size + 120,
      align: "center",
      text: `size ${copy.size} · delay ${copy.delay}s`,
      fontSize: 18,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fill: "#8b949e",
    }),
  );
}

export default comp;
