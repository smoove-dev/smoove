/**
 * smoove showcase — 1080×1080, 30fps, ~48s, cut for LinkedIn.
 *
 * Seven scenes on a `TransitionSeries`, plus one always-on bed sequence that
 * owns the entire mix. Scenes are visual-only on purpose: every audio cue in
 * the piece is declared once, below, anchored to a scene *marker* rather than
 * to a frame number — so retiming a scene drags its voice-over and its SFX
 * along with it instead of silently desyncing them.
 *
 * Build order matters here. A `TransitionSeries` scene callback runs the
 * moment it is declared, so anything a scene needs (the mixer scene needs the
 * audio nodes and the ducking curve) is built first. Markers are the exception
 * — they resolve lazily, so they can be *referenced* before the scene they
 * point at exists.
 */
import { Composition, interpolate, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
import { crosswarp, linearTiming, none, slide, TransitionSeries } from "@smoove/transitions";

import { FPS, HEIGHT, MUSIC, SFX, VO, WIDTH } from "./constants.js";
import { comfortaa, mono } from "./fonts.js";
import { greeting } from "./scenes/01-greeting.js";
import { VO_AT as LOGO_VO_AT, logo } from "./scenes/02-logo.js";
import { layout } from "./scenes/03-layout.js";
import { SWISH_AT, VO_AT as VIDEO_VO_AT, video } from "./scenes/04-video.js";
import { VO_AT as CODE_VO_AT, code, TYPING } from "./scenes/05-code.js";
import { VO_AT as MIX_VO_AT, mixer, type Source } from "./scenes/06-mixer.js";
import { outro } from "./scenes/07-outro.js";

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const SCENE = {
  greeting: 120,
  logo: 165,
  layout: 148,
  video: 265,
  code: 285,
  mixer: 255,
  // The outro now types the slogan (settling ~138) before the CTA rises, so it
  // needs room for both plus a hold on the final card.
  outro: 210,
} as const;

/** A transition's frames overlap its neighbours — shared, not additive. */
const SLIDE_FRAMES = 15;
const WIPE_FRAMES = 18;
/**
 * Layout → video is not a cut but a deliberate overlap: for these frames both
 * scenes are live, the card is still on screen, and the video scene's mask
 * opens inside the card's image slot and grows out over it. `none()` applies no
 * effect of its own — it just holds both layers up, with the video scene on
 * top, which is exactly what that hand-off needs.
 */
const HANDOFF_FRAMES = 48;

const TOTAL =
  Object.values(SCENE).reduce((a, b) => a + b, 0) - SLIDE_FRAMES - WIPE_FRAMES - HANDOFF_FRAMES;

/** Where the music window opens, in composition frames into the 144s bed. */
const MUSIC_FROM = 588;

/**
 * VO lengths in frames, rounded up off the source files (with ~2 frames of
 * tail margin) so a duck never releases early or clips a word. Update these
 * whenever the VO audio is re-recorded — measured lengths are 84/87/91/121.
 */
const VO_LEN = { vo1: 86, vo2: 89, vo3: 93, vo4: 123 } as const;

const comp = new Composition({
  id: "smoove-showcase",
  fps: FPS,
  durationInFrames: TOTAL,
  width: WIDTH,
  height: HEIGHT,
});

const series = new TransitionSeries({ composition: comp });
const at = (scene: keyof typeof SCENE) => series.marker(scene);

// ---------------------------------------------------------------------------
// The mix — declared before the scenes, because the mixer scene reads it
// ---------------------------------------------------------------------------

/** Every voice-over: source, where it starts, how long it runs. */
const VOICE = [
  { src: VO.vo1, from: at("logo").start.add(LOGO_VO_AT), len: VO_LEN.vo1 },
  { src: VO.vo2, from: at("video").start.add(VIDEO_VO_AT), len: VO_LEN.vo2 },
  { src: VO.vo3, from: at("code").start.add(CODE_VO_AT), len: VO_LEN.vo3 },
  { src: VO.vo4, from: at("mixer").start.add(MIX_VO_AT), len: VO_LEN.vo4 },
] as const;

/**
 * Levels, set against the sources rather than by ear-guess. The voice-overs
 * average ~-25dBFS while the bed averages ~-15.6, so the voice is lifted above
 * unity and the SFX — which all peak within 1dB of full scale — are pulled well
 * down, otherwise a swish reads louder than the line it is under.
 */
const VOICE_GAIN = 1.6;
const DUCK = 0.6;
const DUCK_IN = 8;
const DUCK_OUT = 14;
const MUSIC_GAIN = 1;

/**
 * Music gain at an absolute frame: unity, pulled down around every voice-over,
 * with a fade at each end of the piece. A pure function of the frame, and
 * shared with the mixer scene — so the automation curve drawn on screen is
 * literally the curve being applied to the bed.
 */
/**
 * Resolved voice-over windows, memoised on first use.
 *
 * `duckAt` is called ~90 times per frame by the mixer scene (once per segment
 * of the drawn curve), and resolving a marker walks the series' placement — so
 * resolving inside the loop costs hundreds of walks a frame. The timeline is
 * fixed once the composition is built, and an HMR edit re-evaluates this
 * module, so caching after construction is safe.
 */
let voWindows: { start: number; end: number }[] | null = null;
function voiceWindows() {
  if (!voWindows) {
    voWindows = VOICE.map((cue) => {
      const start = cue.from.resolve();
      return { start, end: start + cue.len };
    });
  }
  return voWindows;
}

function duckAt(globalFrame: number): number {
  let gain = interpolate(globalFrame, [0, 20, TOTAL - 34, TOTAL - 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  for (const { start, end } of voiceWindows()) {
    gain = Math.min(
      gain,
      interpolate(globalFrame, [start - DUCK_IN, start, end, end + DUCK_OUT], [1, DUCK, DUCK, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  return gain;
}

const music = new Audio({
  src: MUSIC,
  volume: MUSIC_GAIN,
  // The bed is 144s; we take our window from 0:19.6, where the track has
  // opened up. `duckAt` fades it in over the first 20 frames.
  trim: { start: MUSIC_FROM, play: TOTAL },
  // Loudness only. The mixer scene's meters need `rmsAt`/`peakAt` and its
  // waveform needs the envelope — none of it needs bands, and dropping the
  // spectral fold takes a real chunk off the decode.
  introspect: true,
});

const voiceNodes = VOICE.map(
  (cue) => new Audio({ src: cue.src, volume: VOICE_GAIN, introspect: true }),
);

/** Introspected so the mixer scene's SFX channel meters something real. */
const duckCue = new Audio({ src: SFX.duckCue, volume: 0.22, introspect: true });

const musicSource: Source = { node: music, at: () => 0 };
const voiceSource: Source = { node: voiceNodes[3]!, at: () => VOICE[3].from.resolve() };
const sfxSource: Source = {
  node: duckCue,
  at: () => at("mixer").start.resolve() + MIX_VO_AT - 10,
};

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

series.scene({ durationInFrames: SCENE.greeting, name: "greeting" }, greeting);
series.scene({ durationInFrames: SCENE.logo, name: "logo" }, logo);
series.scene({ durationInFrames: SCENE.layout, name: "layout" }, layout);

series.transition({
  presentation: none(),
  timing: linearTiming({ durationInFrames: HANDOFF_FRAMES }),
});
series.scene({ durationInFrames: SCENE.video, name: "video" }, video);

series.transition({
  presentation: slide({ direction: "from-right" }),
  timing: linearTiming({ durationInFrames: SLIDE_FRAMES }),
});
series.scene({ durationInFrames: SCENE.code, name: "code" }, code);

// Geometric (Tier A) on purpose. The GLSL presentations render their shader
// server-side here (`src/server/resolve.ts` wires `@smoove/renderer/gl`), and
// the ripple did distort correctly — but the Tier B path captures each scene
// to a texture, and video frames do not survive that capture: both scenes'
// footage blanked to flat colour for the whole overlap. A wipe keeps the
// footage on screen through the cut. See PLAN.md.
series.transition({
  presentation: crosswarp(),
  timing: linearTiming({ durationInFrames: WIPE_FRAMES }),
});
series.scene({ durationInFrames: SCENE.mixer, name: "mixer" }, (seq) =>
  mixer(seq, { music: musicSource, voice: voiceSource, sfx: sfxSource, duckAt }),
);

series.scene({ durationInFrames: SCENE.outro, name: "outro" }, outro);

comp.add(series);

// ---------------------------------------------------------------------------
// Audio, mounted last — every window is anchored to a scene that now exists
// ---------------------------------------------------------------------------

/** The bed spans the whole piece, so its local frames *are* absolute frames. */
const bed = new Sequence({ from: 0, durationInFrames: TOTAL });
// Fonts live here so they load once and stay loaded for every scene — a `Font`
// is a Konva node, so it can only have one parent.
bed.add(comfortaa, mono);
bed.add(music);
bed.register((frame) => music.setVolume(MUSIC_GAIN * duckAt(frame)));
comp.add(bed);

VOICE.forEach((cue, i) => {
  comp.add(new Sequence({ from: cue.from, durationInFrames: cue.len }).add(voiceNodes[i]!));
});

/** SFX one-shots — the sequence window is the trim. */
const CUES = [
  {
    node: new Audio({ src: SFX.maskSwish, volume: 0.3 }),
    from: at("video").start.add(SWISH_AT[0]!),
    len: 34,
  },
  {
    node: new Audio({ src: SFX.maskSwish, volume: 0.3 }),
    from: at("video").start.add(SWISH_AT[1]!),
    len: 40,
  },
  {
    node: new Audio({ src: SFX.transitionWhoosh, volume: 0.32 }),
    from: at("code").start.add(-6),
    len: 40,
  },
  {
    node: new Audio({ src: SFX.codeTyping, volume: 0.22 }),
    from: at("code").start.add(TYPING[0]),
    len: TYPING[1] - TYPING[0],
  },
  { node: duckCue, from: at("mixer").start.add(MIX_VO_AT - 10), len: 44 },
];

for (const cue of CUES) {
  comp.add(new Sequence({ from: cue.from, durationInFrames: cue.len }).add(cue.node));
}

export default comp;
