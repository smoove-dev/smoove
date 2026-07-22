import { Circle, Clip, type ClipOptions, Easing, interpolate, Line } from "@smoove/core";

// ---------------------------------------------------------------------------
// smooveMark — the smoove logo icon as a shareable component: a plain
// function that builds a `Clip`, registers an updater on it, and returns it.
// No classes, no engine hooks — drop the returned clip into any sequence (or
// another clip) and it animates itself with its own local clock.
//
// Portability rules baked in, so the mark plays the same everywhere:
// - Geometry is authored in a 100-unit square and scaled by `size` — pixel-
//   identical proportions at any size.
// - Timing is authored in SECONDS via `info.time` — same motion at any fps.
// - The updater is a pure function of the clip-local frame — scrubbing and
//   headless rendering stay deterministic.
// ---------------------------------------------------------------------------

export type SmooveMarkProps = Omit<ClipOptions, "scaleX" | "scaleY"> & {
  /** Edge of the square the mark is drawn in, in px. Anchored at its top-left. */
  size: number;
  /** Seconds of clip-local time before the intro starts. Default 0. */
  delay?: number;
  /** Replay period in seconds — the intro restarts every `loop` seconds. Off by default. */
  loop?: number;
  /** Dot color. Default the brand yellow. */
  accent?: string;
  /** Bar gradient endpoints. Defaults to the brand coral -> teal. */
  gradientFrom?: string;
  gradientTo?: string;
  /**
   * Render the mark as a punch-out: every shape erases what is painted below
   * it on the same layer (`destination-out`), so the animated mark becomes a
   * hole revealing the sequence stacked underneath. Colors are ignored —
   * only the shapes' alpha matters (the blink still reads as a flicker).
   */
  punchOut?: boolean;
};

/** Authored square. Everything below is in units of this box. */
const VIEW = 100;

// Geometry — the proven ident mark, recentred into the 100-unit square.
const MID_Y = 50;
const BARS = [
  { x: 31.5, half: 22 },
  { x: 43.5, half: 16 },
  { x: 55.5, half: 10 },
  { x: 67.5, half: 4 },
];
const BAR_STROKE = 9;
const GRADIENT_X = [31.5, 75.5] as const; // first bar -> just past the last
const DOT_HOME = 80.5;
const DOT_LEFT = 19.5;
const DOT_RADIUS = 3.5;

// Timing, in seconds (the original 30fps frame marks / 30).
const T = {
  pop: [0, 0.133],
  blink: [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  glide: [0.567, 0.8], // dot drifts home -> left
  sweep: [0.8, 1.367], // ...and sweeps back, pulling each bar in as it passes
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** One playable copy of the mark. Mount the returned clip anywhere. */
export function smooveMark(props: SmooveMarkProps): Clip {
  const {
    size,
    delay = 0,
    loop,
    accent = "#FFC23C",
    gradientFrom = "#FF5640",
    gradientTo = "#15CDA8",
    punchOut = false,
    ...clipOpts
  } = props;
  const k = size / VIEW;
  const clip = new Clip({ ...clipOpts, scaleX: k, scaleY: k });
  const composite = punchOut ? { globalCompositeOperation: "destination-out" as const } : {};

  const gradient = {
    strokeLinearGradientStartPoint: { x: GRADIENT_X[0], y: MID_Y },
    strokeLinearGradientEndPoint: { x: GRADIENT_X[1], y: MID_Y },
    strokeLinearGradientColorStops: [0, gradientFrom, 1, gradientTo],
  };
  
  const bars = BARS.map(({ x, half }) => {
    const node = new Line({
      points: [x, MID_Y, x, MID_Y],
      strokeWidth: BAR_STROKE,
      lineCap: "round",
      opacity: 0,
      ...gradient,
      ...composite,
    });
    clip.add(node);
    return { node, x, half };
  });

  const dot = new Circle({
    x: DOT_HOME,
    y: MID_Y,
    radius: DOT_RADIUS,
    fill: accent,
    scaleX: 0,
    scaleY: 0,
    ...composite,
  });
  clip.add(dot);

  clip.register((_frame, info) => {
    let t = info.time - delay;
    if (loop !== undefined && t >= 0) t %= loop;

    // The dot pops in and blinks...
    const pop = interpolate(t, [...T.pop], [0, 1], {
      easing: Easing.out(Easing.back(2)),
      ...clamp,
    });
    dot.scaleX(pop);
    dot.scaleY(pop);
    dot.opacity(interpolate(t, [...T.blink], [1, 0.1, 1, 0.1, 1, 0.1, 1], clamp));

    // ...glides left, then sweeps right, pulling each bar in as it passes.
    const dotX =
      t < T.glide[1]
        ? interpolate(t, [...T.glide], [DOT_HOME, DOT_LEFT], {
            easing: Easing.inOut(Easing.cubic),
            ...clamp,
          })
        : interpolate(t, [...T.sweep], [DOT_LEFT, DOT_HOME], {
            easing: Easing.inOut(Easing.sin),
            ...clamp,
          });
    dot.x(dotX);

    for (const bar of bars) {
      const raw = t < T.sweep[0] ? 0 : interpolate(dotX, [bar.x - 2, bar.x + 9], [0, 1], clamp);
      const pull = Easing.inOut(Easing.elastic(1.8))(raw);
      bar.node.opacity(Math.min(1, raw * 3));
      bar.node.points([bar.x, MID_Y - bar.half * pull, bar.x, MID_Y + bar.half * pull]);
      bar.node.x((1 - pull) * 5);
    }
  });

  return clip;
}
