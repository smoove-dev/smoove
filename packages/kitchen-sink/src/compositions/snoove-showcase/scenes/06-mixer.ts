/**
 * Scene 6 — the mix, as a DJ desk.
 *
 * Three channels, each with a segmented LED meter and a fader. The meters read
 * the *decoded* audio via `introspect`, not the volume we set — automation is
 * the level you ask for, introspection is the level the sound actually is,
 * which is why the voice meter drops in the gaps between words while its fader
 * stays put.
 *
 * The MUSIC fader is the one that moves: it rides `duckAt`, the same function
 * the composition uses to set the bed's gain. The fader you watch fall under
 * the voice-over is the fall being applied to the audio you hear.
 */
import { Easing, Group, interpolate, Rect, type Sequence, Text } from "@smoove/core";
import type { Audio } from "@smoove/media";
import { AMBER, BORDER, CORAL, HEIGHT, INK, MUTED, TEAL, TEXT, VIDEO, WIDTH } from "../constants.js";
import { comfortaa, mono } from "../fonts.js";
import { videoPlate } from "../components/video-plate.js";

export const VO_AT = 18;

/** An audio node plus the absolute frame its own clock starts at. */
export type Source = { node: Audio; at: () => number };

export type MixerDeps = {
  music: Source;
  voice: Source;
  sfx: Source;
  /** Music gain at an absolute frame — the real automation, ridden by the fader. */
  duckAt: (globalFrame: number) => number;
};

// -- geometry ----------------------------------------------------------------

const PAD = 90;
const BODY_W = WIDTH - PAD * 2;

const WAVE_MID = 330;
const WAVE_HALF = 58;
const WAVE_BUCKETS = 110;

/** The desk. Three strips across the lower two thirds. */
const DESK_TOP = 470;
const DESK_H = 400;
const STRIP_CX = [258, 540, 822];
const METER_W = 54;
const METER_DX = -62;
const FADER_DX = 58;
const SEGMENTS = 20;
const SEG_GAP = 3;

/** Segment colour by height up the meter — classic green → amber → red. */
function segmentColor(i: number) {
  const t = i / (SEGMENTS - 1);
  if (t > 0.88) return CORAL;
  if (t > 0.68) return AMBER;
  return TEAL;
}

export function mixer(seq: Sequence, deps: MixerDeps) {
  const { music, voice, sfx, duckAt } = deps;

  // An opaque base first — a scene that never reaches alpha 1 composites
  // against whatever is behind it.
  seq.add(new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK, listening: false }));
  seq.add(videoPlate({ src: VIDEO.bgEnd, zoom: [1.08, 1.18], driftX: 0.4, opacity: 0.3 }));
  seq.add(
    // Held down hard: the meters have to out-read the character behind them.
    new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK, opacity: 0.82, listening: false }),
  );

  const kicker = new Text({
    x: PAD,
    y: 140,
    text: "MIXED ON THE TIMELINE",
    font: comfortaa.face("700"),
    fontSize: 30,
    fill: TEXT,
    letterSpacing: 4,
    wrap: "none",
    width: BODY_W,
    listening: false,
  });
  const sub = new Text({
    x: PAD,
    y: 184,
    text: "music, voice and SFX: levels you can animate",
    font: comfortaa.face("400"),
    fontSize: 25,
    fill: MUTED,
    wrap: "none",
    width: BODY_W,
    listening: false,
  });
  seq.add(kicker, sub);

  // -- waveform -------------------------------------------------------------
  // Two copies of one outline: a dim one for the whole span, and a bright one
  // inside a clip whose width tracks the playhead.
  const waveDim = new Group({ listening: false });
  const wavePlayedClip = new Group({
    listening: false,
    clip: { x: PAD, y: WAVE_MID - WAVE_HALF - 6, width: 0, height: WAVE_HALF * 2 + 12 },
  });
  const wavePlayed = new Group({ listening: false });
  wavePlayedClip.add(wavePlayed);
  seq.add(waveDim, wavePlayedClip);

  const bucketW = BODY_W / WAVE_BUCKETS;
  const waveBars = Array.from({ length: WAVE_BUCKETS }, (_, i) => {
    const box = {
      x: PAD + i * bucketW + bucketW * 0.2,
      y: WAVE_MID,
      width: bucketW * 0.6,
      height: 2,
      cornerRadius: 2,
      listening: false,
    };
    const dim = new Rect({ ...box, fill: "#ffffff1f" });
    const lit = new Rect({ ...box, fill: TEAL });
    waveDim.add(dim);
    wavePlayed.add(lit);
    return { dim, lit };
  });
  /** The outline is static; it only has to be built once the decode lands. */
  let waveDrawn = false;

  const playhead = new Rect({
    x: PAD,
    y: WAVE_MID - WAVE_HALF - 10,
    width: 2,
    height: WAVE_HALF * 2 + 20,
    fill: AMBER,
    listening: false,
  });
  seq.add(playhead);

  // -- channel strips -------------------------------------------------------
  const CHANNELS = [
    { name: "MUSIC", color: TEAL, src: music, automated: true },
    { name: "VOICE", color: CORAL, src: voice, automated: false },
    { name: "SFX", color: AMBER, src: sfx, automated: false },
  ];

  const segH = (DESK_H - (SEGMENTS - 1) * SEG_GAP) / SEGMENTS;

  const strips = CHANNELS.map((ch, i) => {
    const cx = STRIP_CX[i]!;
    const meterX = cx + METER_DX - METER_W / 2;
    const faderX = cx + FADER_DX;

    // Meter housing.
    seq.add(
      new Rect({
        x: meterX - 7,
        y: DESK_TOP - 7,
        width: METER_W + 14,
        height: DESK_H + 14,
        cornerRadius: 10,
        fill: "#ffffff08",
        stroke: BORDER,
        strokeWidth: 1,
        listening: false,
      }),
    );

    // Segments, bottom-up.
    const segs = Array.from({ length: SEGMENTS }, (_, s) => {
      const seg = new Rect({
        x: meterX,
        y: DESK_TOP + DESK_H - (s + 1) * segH - s * SEG_GAP,
        width: METER_W,
        height: segH,
        cornerRadius: 3,
        fill: segmentColor(s),
        opacity: 0.09,
        listening: false,
      });
      seq.add(seg);
      return seg;
    });

    // Fader track, then the cap that slides along it.
    seq.add(
      new Rect({
        x: faderX - 3,
        y: DESK_TOP,
        width: 6,
        height: DESK_H,
        cornerRadius: 3,
        fill: "#ffffff14",
        stroke: BORDER,
        strokeWidth: 1,
        listening: false,
      }),
    );
    // Ticks down the side of the track, so the cap's travel is legible.
    for (let t = 0; t <= 10; t++) {
      seq.add(
        new Rect({
          x: faderX + 8,
          y: DESK_TOP + (DESK_H / 10) * t,
          width: t % 5 === 0 ? 14 : 8,
          height: 2,
          fill: "#ffffff22",
          listening: false,
        }),
      );
    }
    const cap = new Rect({
      x: faderX - 27,
      y: DESK_TOP,
      width: 54,
      height: 26,
      offsetY: 13,
      cornerRadius: 6,
      fill: "#e6edf3",
      listening: false,
    });
    const capLine = new Rect({
      x: faderX - 19,
      y: DESK_TOP,
      width: 38,
      height: 3,
      offsetY: 1.5,
      cornerRadius: 2,
      fill: ch.color,
      listening: false,
    });
    seq.add(cap, capLine);

    seq.add(
      new Text({
        x: cx - 110,
        y: DESK_TOP + DESK_H + 30,
        text: ch.name,
        font: mono.face("700"),
        fontSize: 23,
        fill: ch.color,
        align: "center",
        wrap: "none",
        width: 220,
        listening: false,
      }),
    );

    // Only the automated channel advertises itself as such.
    const autoBadge = ch.automated
      ? new Text({
          x: cx - 110,
          y: DESK_TOP + DESK_H + 62,
          text: "AUTOMATED",
          font: mono.face("400"),
          fontSize: 16,
          fill: `${AMBER}dd`,
          align: "center",
          wrap: "none",
          width: 220,
          listening: false,
        })
      : null;
    if (autoBadge) seq.add(autoBadge);

    return { ...ch, segs, cap, capLine, autoBadge };
  });

  seq.register((frame, { globalFrame, durationInFrames: total }) => {
    const intro = interpolate(frame, [0, 18], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    kicker.opacity(intro);
    sub.opacity(intro);

    const progress = frame / Math.max(1, total - 1);
    /** Absolute frame this scene opened — derived, never cached. */
    const sceneAt = globalFrame - frame;

    // -- waveform. Built once, when the envelope has finished decoding; an
    //    all-zero read means it is still in flight.
    if (!waveDrawn) {
      const from = sceneAt - music.at();
      const wf = music.node.waveform(from, from + total, WAVE_BUCKETS);
      if (!wf.max.every((v) => v === 0)) {
        waveDrawn = true;
        waveBars.forEach(({ dim, lit }, i) => {
          const span = Math.abs(wf.max[i] ?? 0) + Math.abs(wf.min[i] ?? 0);
          const h = Math.max(3, span * WAVE_HALF);
          for (const bar of [dim, lit]) {
            bar.height(h);
            bar.y(WAVE_MID - h / 2);
          }
        });
      }
    }
    wavePlayedClip.clipWidth(BODY_W * progress);
    playhead.x(PAD + BODY_W * progress);
    playhead.opacity(intro);

    for (const strip of strips) {
      const local = globalFrame - strip.src.at();
      const rms = strip.src.node.rmsAt(local, { normalized: true });
      const peak = strip.src.node.peakAt(local, { holdFrames: 14, normalized: true });

      // Perceptual, not linear: a linear meter sits near the floor most of the
      // time and reads as broken rather than as quiet.
      const level = Math.pow(Math.min(1, rms), 0.55) * intro;
      const holdSeg = Math.round(Math.pow(Math.min(1, peak), 0.55) * intro * (SEGMENTS - 1));
      const lit = level * SEGMENTS;

      strip.segs.forEach((seg, s) => {
        // Partial lighting on the topmost segment keeps the meter smooth
        // instead of stepping a whole segment at a time.
        const on = Math.max(0, Math.min(1, lit - s));
        const isHold = s === holdSeg && peak > 0.02;
        seg.opacity(isHold ? 1 : 0.09 + 0.86 * on);
      });

      // The fader: automated on MUSIC, parked at unity elsewhere.
      const gain = strip.automated ? duckAt(globalFrame) : 1;
      const y = DESK_TOP + DESK_H * (1 - gain);
      strip.cap.y(y);
      strip.capLine.y(y);
      strip.cap.opacity(intro);
      strip.capLine.opacity(intro);
      if (strip.autoBadge) {
        // Blinks while it is actually pulling the level down.
        const ducking = gain < 0.95;
        strip.autoBadge.opacity(intro * (ducking ? 0.55 + 0.45 * Math.sin(frame / 3) : 0.3));
      }
    }
  });
}
