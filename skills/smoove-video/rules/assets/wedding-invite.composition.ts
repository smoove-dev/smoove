// Wedding invitation / save the date, vertical, for WhatsApp and Stories.
//
// Brief
// 1. Who watches: the couple's guests, on a phone, sent in a chat.
// 2. Takeaway: Ana and Leo are getting married on 12 September 2026 in Lisbon,
//    and you're invited.
// 3. Length: from the words. Every scene holds long enough to read (sceneFrames).
// 4. Where: WhatsApp and Instagram Stories, 1080 by 1920.
// 5. Must-haves: the couple's photo (couple.jpg, 918 by 878, square), names,
//    date, schedule, RSVP.
// 6. Feel: romantic, calm, garden. Theme "garden".
//
// Rhythm: quiet open, the names, the photo, the date, the day, reply, rest.
//
// Everything the couple told you lives in `invite`. Everything that decides the
// look lives in the theme. The scenes below read only those two, so a new couple
// is a new `invite`, and a new style is a new theme.

import {
  Arc,
  Circle,
  Clip,
  Composition,
  createCpuCanvas,
  Easing,
  Ellipse,
  Flex,
  Group,
  Image,
  interpolate,
  Line,
  plan,
  Rect,
  RegularPolygon,
  random,
  Sequence,
  Text,
} from "@smoove/core";
import Allura from "@smoove/google-fonts/allura";
import CormorantGaramond from "@smoove/google-fonts/cormorant-garamond";
import GreatVibes from "@smoove/google-fonts/great-vibes";
import Parisienne from "@smoove/google-fonts/parisienne";
import PinyonScript from "@smoove/google-fonts/pinyon-script";
import couplePhoto from "./photos/couple.jpg";

export const width = 1080;
export const height = 1920;
export const fps = 30;
const u = Math.min(width, height) / 1080;

/* ------------------------------------------------------------------ content */

// Only what the couple gave you. A field left out is a line left out, never a
// placeholder: an invitation with a made-up address is worse than none.
export const invite = {
  kind: "invitation" as "invitation" | "save-the-date",
  names: ["Ana", "Leo"] as const,
  initials: "A & L",
  hosts: "Together with their families",
  invitation: "invite you to celebrate their wedding",
  date: { weekday: "Saturday", day: "12", month: "September", year: "2026", time: "4 PM" },
  city: "Lisbon, Portugal",
  schedule: [
    {
      time: "4:00 PM",
      title: "Ceremony",
      place: "Igreja de São Roque",
      address: "Largo Trindade Coelho",
    },
    {
      time: "6:30 PM",
      title: "Dinner & dancing",
      place: "Palácio Chiado",
      address: "Rua do Alecrim 70",
    },
  ],
  rsvp: { by: "1 August", contact: "ana.and.leo@example.com" },
  dressCode: "Garden formal",
  closing: "We can't wait to celebrate with you",
  // Size from `npx smoove agent media_info`, never guessed: the hero is laid out
  // at the photo's own shape.
  photo: { src: couplePhoto, width: 918, height: 878 },
};

/* -------------------------------------------------------------------- theme */

// A wedding theme: a palette, a script face for names and headings (the serif
// for everything that has to be read is Cormorant Garamond in all of them), the
// colors the backdrop washes are painted with, and what drifts in front. Ink,
// muted and accent all pass 4.5 to 1 on bg; check again after changing a color.
const themes = {
  garden: {
    palette: {
      bg: "#f5f0e6",
      surface: "#ece4d4",
      ink: "#26332a",
      muted: "#55614f",
      accent: "#6e5524",
      washA: "#b8c6a3",
      washB: "#e6cfc2",
      glow: "#fffaf0",
    },
    script: () => new PinyonScript(),
    particles: "petals" as const,
  },
  evening: {
    palette: {
      bg: "#122019",
      surface: "#1a2c23",
      ink: "#f2e9d6",
      muted: "#bdb39e",
      accent: "#d6ad62",
      washA: "#2e5242",
      washB: "#6e5226",
      glow: "#ffe3ad",
    },
    script: () => new GreatVibes(),
    particles: "bokeh" as const,
  },
  coastal: {
    palette: {
      bg: "#f3f0e8",
      surface: "#e6e6df",
      ink: "#1d3349",
      muted: "#4a5f73",
      accent: "#1f5560",
      washA: "#a9cfd3",
      washB: "#e9d8bf",
      glow: "#fbfaf5",
    },
    script: () => new GreatVibes(),
    particles: "petals" as const,
  },
  blush: {
    palette: {
      bg: "#f8eee8",
      surface: "#f0ddd4",
      ink: "#46282c",
      muted: "#74545a",
      accent: "#7e3f34",
      washA: "#efc4bb",
      washB: "#ead9c3",
      glow: "#fff7f2",
    },
    script: () => new Parisienne(),
    particles: "petals" as const,
  },
  // Ink on paper, no color of its own: the photo brings it.
  paper: {
    palette: {
      bg: "#f2efe9",
      surface: "#e7e2d9",
      ink: "#2f2e2c",
      muted: "#5f5c57",
      accent: "#2f2e2c",
      washA: "#dcd6cb",
      washB: "#e9e4dc",
      glow: "#fbf9f5",
    },
    script: () => new Allura(),
    particles: "none" as const,
  },
};
type Theme = (typeof themes)[keyof typeof themes];
const theme = themes.garden as Theme;
export const palette = theme.palette;

export const script = theme.script();
export const serif = new CormorantGaramond({
  weights: ["500", "600"],
  styles: ["normal", "italic"],
});
const caps = serif.face("600");
const body = serif.face("500");
const italic = serif.face("500-italic");

/* ------------------------------------------------------------------- timing */

// A scene is a reveal, then a hold long enough to read every word on it twice
// over: 2 seconds to find the text, plus 4 words a second. Ten words hold for
// 4.5 seconds; thirty for 9.5. Past about thirty words, split the scene.
const REVEAL = Math.round(1.6 * fps);
const WASH = 14; // frames each side of a cut that the light wash covers
const words = (...lines: string[]) => lines.join(" ").split(/\s+/).filter(Boolean).length;
const sceneFrames = (...lines: string[]) =>
  REVEAL + Math.round(fps * (2 + words(...lines) / 4)) + WASH;

const d = invite.date;
const isInvite = invite.kind === "invitation";
const scenes = {
  open: { durationInFrames: Math.round(3.5 * fps) },
  names: {
    durationInFrames: sceneFrames(invite.hosts, ...invite.names, invite.invitation),
  },
  photo: { durationInFrames: sceneFrames("Save the date") + fps },
  date: { durationInFrames: sceneFrames(d.month, d.weekday, d.day, d.time, d.year, invite.city) },
  ...(isInvite
    ? {
        day: {
          durationInFrames: sceneFrames(
            ...invite.schedule.flatMap((e) => [e.time, e.title, e.place, e.address]),
          ),
        },
        reply: {
          durationInFrames: sceneFrames(
            "Kindly reply by",
            invite.rsvp.by,
            invite.rsvp.contact,
            "Dress code",
            invite.dressCode,
          ),
        },
      }
    : {}),
  close: {
    durationInFrames:
      sceneFrames(
        invite.closing,
        ...invite.names,
        invite.city,
        isInvite ? "" : "Invitation to follow",
      ) + fps,
  },
};
export const beats = plan(scenes);
type Beat = NonNullable<(typeof beats)[keyof typeof beats]>;

const comp = new Composition({
  id: "wedding-invite",
  fps,
  width,
  height,
  durationInFrames: beats.close.end,
  plan: beats,
});

const ease = Easing.out(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** 0 to 1 between two local frames, eased. */
const ramp = (f: number, from: number, frames: number) =>
  interpolate(f, [from, from + frames], [0, 1], { easing: ease, ...clamp });

/* ----------------------------------------------------------------- backdrop */

// Never a flat color: paper, with large soft washes of color drifting across
// it, and a gentle vignette that keeps the eye in the middle.
const backdrop = new Sequence();
backdrop.add(script, serif);
backdrop.add(new Rect({ x: 0, y: 0, width, height, fill: palette.bg }));

const washes = [
  { color: palette.washA, x: 0.1, y: 0.12, r: 820, speed: 0.11, phase: 0 },
  { color: palette.washB, x: 0.95, y: 0.55, r: 760, speed: 0.09, phase: 2 },
  { color: palette.washA, x: 0.2, y: 1.0, r: 900, speed: 0.07, phase: 4 },
].map((w) => {
  const blob = new Circle({
    x: w.x * width,
    y: w.y * height,
    radius: w.r * u,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: w.r * u,
    fillRadialGradientColorStops: [0, `${w.color}b0`, 0.55, `${w.color}55`, 1, `${w.color}00`],
  });
  backdrop.add(blob);
  return { blob, ...w };
});
backdrop.add(
  new Rect({
    x: 0,
    y: 0,
    width,
    height,
    fillRadialGradientStartPoint: { x: width / 2, y: height / 2 },
    fillRadialGradientEndPoint: { x: width / 2, y: height / 2 },
    fillRadialGradientStartRadius: height * 0.3,
    fillRadialGradientEndRadius: height * 0.75,
    fillRadialGradientColorStops: [0, `${palette.ink}00`, 1, `${palette.ink}26`],
  }),
);
backdrop.register((_f, { time }) => {
  for (const w of washes) {
    w.blob.x(w.x * width + Math.sin(time * w.speed * 2 * Math.PI + w.phase) * 90 * u);
    w.blob.y(w.y * height + Math.cos(time * w.speed * 2 * Math.PI + w.phase) * 70 * u);
  }
});
comp.add(backdrop);

/* --------------------------------------------------------------- components */

// Measures a line's ink, so a reveal sweeps the glyphs and not the empty box
// around them. Made on first use: no canvas exists while the module loads.
let meter: CanvasRenderingContext2D | null = null;
function inkWidth(text: Text) {
  meter ??= createCpuCanvas(1, 1).getContext("2d");
  if (!meter) return text.width();
  meter.font = `${text.fontSize()}px "${script.family}"`;
  return Math.min(text.width(), meter.measureText(text.getText()).width);
}

/** A script line that writes itself on from left to right, like a pen. */
function writeOn(text: Text, f: number, start: number, frames = Math.round(1.1 * fps)) {
  const p = interpolate(f, [start, start + frames], [0, 1], {
    easing: Easing.inOut(Easing.quad),
    ...clamp,
  });
  text.opacity(p > 0 ? 1 : 0);
  if (p >= 1) {
    text.clipFunc(undefined as unknown as () => void);
    return;
  }
  // Centered text: the ink sits in the middle of the box. Swashes reach past the
  // ink, so the mask gets a margin all round.
  const ink = inkWidth(text);
  const left = (text.width() - ink) / 2;
  const pad = text.fontSize() * 0.6;
  text.clipFunc((ctx) => ctx.rect(left - pad, -pad, (ink + pad * 2) * p, text.height() + pad * 2));
}

/** A detail line that rises a little as it fades in. */
function rise(node: Group | Text | Flex, f: number, start: number) {
  const p = ramp(f, start, 18);
  node.opacity(p);
  node.scaleX(0.97 + 0.03 * p);
  node.scaleY(0.97 + 0.03 * p);
}

// Every line gets an explicit width and centres itself in it: a width-less line
// measures against the fallback face before the webfont lands.
const LINE = width * 0.88;
const scriptText = (text: string, size: number, name: string, fill = palette.ink) =>
  new Text({
    name,
    text,
    font: script,
    fontSize: size * u,
    fill,
    width: LINE,
    align: "center",
    ellipsis: false,
    wrap: "none",
  });
const capsText = (
  text: string,
  size: number,
  name: string,
  fill = palette.muted,
  box: { width: number; align: "left" | "center" | "right" } = { width: LINE, align: "center" },
) =>
  new Text({
    name,
    text: text.toUpperCase(),
    font: caps,
    fontSize: size * u,
    letterSpacing: size * u * 0.28,
    fill,
    ...box,
    ellipsis: false,
    wrap: "none",
  });
const bodyText = (text: string, size: number, name: string, face = body, fill = palette.ink) =>
  new Text({
    name,
    text,
    font: face,
    fontSize: size * u,
    fill,
    align: "center",
    width: LINE,
    lineHeight: 1.25,
    ellipsis: false,
  });

/**
 * A thin gold rule, drawn on with a dash so its points (and its size in a
 * layout) never change. `fromEnd` draws it from its right end.
 */
function rule(length: number, fromEnd = false) {
  const len = length * u;
  return new Line({
    points: fromEnd ? [len, 0, 0, 0] : [0, 0, len, 0],
    stroke: palette.accent,
    strokeWidth: 2 * u,
    dash: [len, len],
    dashOffset: len,
  });
}
function drawRule(line: Line, f: number, start: number) {
  const len = line.dash()[0] ?? 0;
  line.dashOffset(len * (1 - ramp(f, start, 22)));
}

/** A small diamond between two short rules that grow out of it. */
function ornament(name: string) {
  const row = new Flex({ name, flexDirection: "row", alignItems: "center", gap: 18 * u });
  const left = rule(70, true);
  const right = rule(70);
  row.add(left);
  row.add(new RegularPolygon({ sides: 4, radius: 7 * u, fill: palette.accent }));
  row.add(right);
  return { row, left, right };
}

/**
 * One scene: a clip spanning its beat, whose content fades out under the light
 * wash at its end, plus a centered column for the content.
 */
function scene(beat: Beat, column: { top: number; bottom: number; gap: number }) {
  const clip = new Clip({ span: beat });
  const col = new Flex({
    x: 0,
    y: column.top * u,
    width,
    height: height - (column.top + column.bottom) * u,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: column.gap * u,
  });
  clip.add(col);
  clip.register((f, { durationInFrames }) => {
    clip.opacity(interpolate(f, [durationInFrames - WASH, durationInFrames - 2], [1, 0], clamp));
  });
  return { clip, col };
}

const stage = new Sequence({ name: "stage" });
comp.add(stage);
// The light wash lifts at the start of every scene, so reveals begin under it.
const IN = WASH;

/* ------------------------------------------------------------- scene: open */
{
  const clip = new Clip({ span: beats.open });
  stage.add(clip);
  // A monogram ring that draws itself, the initials written inside it. Placed
  // by hand: the arcs grow from nothing, which a layout would chase.
  const R = 180 * u;
  const cx = width / 2;
  const cy = 820 * u;
  const ring = new Arc({
    x: cx,
    y: cy,
    innerRadius: R - 3 * u,
    outerRadius: R,
    angle: 0,
    rotation: -90,
    fill: palette.accent,
  });
  const inner = new Arc({
    x: cx,
    y: cy,
    innerRadius: R - 17 * u,
    outerRadius: R - 16 * u,
    angle: 0,
    rotation: 90,
    fill: palette.accent,
  });
  const initials = new Text({
    name: "initials",
    text: invite.initials,
    font: script,
    fontSize: 112 * u,
    fill: palette.ink,
    // Wider than the ring: a script's swashes may reach past it.
    x: cx - R * 1.5,
    y: cy - 112 * u * 0.62,
    width: R * 3,
    align: "center",
    ellipsis: false,
    wrap: "none",
  });
  const dateLine = capsText(`${d.day} · ${d.month} · ${d.year}`, 30, "open-date");
  const dateRow = new Flex({ x: 0, y: cy + R + 70 * u, width, justifyContent: "center" });
  dateRow.add(dateLine);
  clip.add(ring, inner, initials, dateRow);
  clip.register((f, { durationInFrames }) => {
    ring.angle(360 * ramp(f, 0, 40));
    inner.angle(360 * ramp(f, 8, 40));
    writeOn(initials, f, 18, 34);
    rise(dateLine, f, 46);
    clip.opacity(interpolate(f, [durationInFrames - WASH, durationInFrames - 2], [1, 0], clamp));
  });
}

/* ------------------------------------------------------------ scene: names */
{
  const { clip, col } = scene(beats.names, { top: 260, bottom: 420, gap: 18 });
  const hosts = capsText(invite.hosts, 30, "hosts");
  const first = scriptText(invite.names[0], 230, "name");
  const amp = scriptText("&", 120, "amp", palette.accent);
  const second = scriptText(invite.names[1], 230, "name");
  const line = bodyText(invite.invitation, 52, "invitation", italic);
  const orn = ornament("names-ornament");
  col.add(hosts);
  col.add(first);
  col.add(amp);
  col.add(second);
  col.add(orn.row);
  col.add(line);
  stage.add(clip);
  clip.register((f) => {
    rise(hosts, f, IN);
    writeOn(first, f, IN + 12);
    rise(amp, f, IN + 40);
    writeOn(second, f, IN + 46);
    drawRule(orn.left, f, IN + 70);
    drawRule(orn.right, f, IN + 70);
    rise(line, f, IN + 80);
  });
}

/* ------------------------------------------------------------ scene: photo */
{
  const clip = new Clip({ span: beats.photo });
  stage.add(clip);
  // The hero is the photo at its own shape, full width: a landscape photo keeps
  // all of itself, a square fills the top, and a tall one is cropped only once
  // it would pass two thirds of the frame, keeping the top where faces are.
  const ratio = invite.photo.width / invite.photo.height;
  const heroH = Math.min(width / ratio, height * 0.66);
  // A wide photo is a band, not a header: it sits lower, with a curved top edge
  // too, so it reads as a window into the paper.
  const top = heroH < height * 0.45 ? Math.round(height * 0.3 - heroH / 2) : 0;
  const bottom = top + heroH;
  // The edges are soft curves with a gold line along them, not straight cuts
  // and not a fade: a fade into flat paper shows a seam over the washes.
  const dip = 70 * u;
  const curveY = (base: number, sign: number, t: number) =>
    base - sign * dip + sign * 4 * dip * t * (1 - t);
  const frame = new Group({
    clipFunc: (ctx) => {
      if (top > 0) {
        ctx.moveTo(0, curveY(top, -1, 0));
        ctx.quadraticCurveTo(width / 2, top - dip, width, curveY(top, -1, 1));
      } else {
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
      }
      ctx.lineTo(width, curveY(bottom, 1, 1));
      ctx.quadraticCurveTo(width / 2, bottom + dip, 0, curveY(bottom, 1, 0));
      ctx.closePath();
    },
  });
  const photo = new Image({
    name: "hero",
    src: invite.photo.src,
    width,
    height: heroH,
    objectFit: "cover",
    objectPosition: ratio < width / heroH ? "top" : "center",
    offsetX: width / 2,
    offsetY: heroH / 2,
    x: width / 2,
    y: top + heroH / 2,
  });
  frame.add(photo);
  clip.add(frame);
  /** A gold line along one curved edge, set off from it by a little. */
  const goldCurve = (base: number, sign: number) => {
    const points: number[] = [];
    for (let i = 0; i <= 40; i++)
      points.push((width * i) / 40, curveY(base, sign, i / 40) + sign * 16 * u);
    let length = 0;
    for (let i = 2; i < points.length; i += 2) {
      length += Math.hypot(
        (points[i] ?? 0) - (points[i - 2] ?? 0),
        (points[i + 1] ?? 0) - (points[i - 1] ?? 0),
      );
    }
    const line = new Line({
      points,
      stroke: palette.accent,
      strokeWidth: 2 * u,
      dash: [length, length],
      dashOffset: length,
    });
    clip.add(line);
    return { line, length };
  };
  const golds = [goldCurve(bottom, 1), ...(top > 0 ? [goldCurve(top, -1)] : [])];
  const title = scriptText("Save the date", 150, "save-the-date");
  const sub = capsText(`${d.day} · ${d.month} · ${d.year}`, 34, "photo-date", palette.accent);
  const col = new Flex({
    x: 0,
    y: bottom + 20 * u,
    width,
    height: Math.min(560 * u, height - bottom - 360 * u),
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 34 * u,
  });
  col.add(title);
  col.add(sub);
  clip.add(col);
  clip.register((f, { durationInFrames }) => {
    // A slow push across the whole beat, so the still breathes.
    const push = interpolate(f, [0, durationInFrames], [1.0, 1.06], clamp);
    photo.scaleX(push);
    photo.scaleY(push);
    frame.opacity(ramp(f, 0, IN + 6));
    for (const g of golds) g.line.dashOffset(g.length * (1 - ramp(f, IN, 40)));
    writeOn(title, f, IN + 18);
    rise(sub, f, IN + 52);
    clip.opacity(interpolate(f, [durationInFrames - WASH, durationInFrames - 2], [1, 0], clamp));
  });
}

/* ------------------------------------------------------------- scene: date */
{
  const { clip, col } = scene(beats.date, { top: 300, bottom: 440, gap: 30 });
  const month = capsText(d.month, 48, "month", palette.ink);
  // A nested row needs its own width, and so do the lines in it.
  const row = new Flex({
    width: LINE,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18 * u,
  });
  // Wide enough for WEDNESDAY, the longest weekday.
  const side = 290 * u;
  const weekday = capsText(d.weekday, 28, "weekday", palette.ink, { width: side, align: "right" });
  const time = capsText(d.time, 28, "time", palette.ink, { width: side, align: "left" });
  const day = new Text({
    name: "day",
    text: d.day,
    font: serif.face("500"),
    fontSize: 250 * u,
    fill: palette.ink,
    letterSpacing: -6 * u,
    width: 290 * u,
    align: "center",
    ellipsis: false,
    wrap: "none",
  });
  const barL = new Rect({ width: 2 * u, height: 130 * u, fill: palette.accent });
  const barR = new Rect({ width: 2 * u, height: 130 * u, fill: palette.accent });
  row.add(weekday, barL, day, barR, time);
  const year = capsText(d.year, 38, "year", palette.accent);
  const orn = ornament("date-ornament");
  const city = scriptText(invite.city, 100, "city");
  col.add(month);
  col.add(row);
  col.add(year);
  col.add(orn.row);
  col.add(city);
  stage.add(clip);
  clip.register((f) => {
    rise(month, f, IN);
    const p = ramp(f, IN + 8, 26);
    day.opacity(p);
    day.scaleX(0.9 + 0.1 * p);
    day.scaleY(0.9 + 0.1 * p);
    barL.scaleY(ramp(f, IN + 20, 20));
    barR.scaleY(ramp(f, IN + 20, 20));
    rise(weekday, f, IN + 28);
    rise(time, f, IN + 34);
    rise(year, f, IN + 44);
    drawRule(orn.left, f, IN + 54);
    drawRule(orn.right, f, IN + 54);
    writeOn(city, f, IN + 64);
  });
}

/* -------------------------------------------------------------- scene: day */
if (beats.day) {
  const { clip, col } = scene(beats.day, { top: 260, bottom: 420, gap: 64 });
  const heading = scriptText("The day", 160, "day-heading");
  col.add(heading);
  const events = invite.schedule.map((e, i) => {
    const block = new Flex({
      name: "event",
      flexDirection: "column",
      alignItems: "center",
      gap: 10 * u,
    });
    block.add(capsText(e.time, 32, "event-time", palette.accent));
    block.add(bodyText(e.title, 74, "event-title", caps));
    block.add(bodyText(e.place, 50, "event-place", italic));
    block.add(bodyText(e.address, 38, "event-address", body, palette.muted));
    col.add(block);
    if (i < invite.schedule.length - 1) {
      const orn = ornament("event-ornament");
      col.add(orn.row);
      return { block, orn };
    }
    return { block, orn: null };
  });
  stage.add(clip);
  clip.register((f) => {
    writeOn(heading, f, IN);
    events.forEach(({ block, orn }, i) => {
      rise(block, f, IN + 34 + i * 30);
      if (orn) {
        drawRule(orn.left, f, IN + 50 + i * 30);
        drawRule(orn.right, f, IN + 50 + i * 30);
      }
    });
  });
}

/* ------------------------------------------------------------ scene: reply */
if (beats.reply) {
  const { clip, col } = scene(beats.reply, { top: 300, bottom: 440, gap: 30 });
  const heading = scriptText("Kindly reply", 160, "reply-heading");
  const by = capsText(`by ${invite.rsvp.by}`, 36, "reply-by", palette.accent);
  const contact = bodyText(invite.rsvp.contact, 52, "reply-contact");
  const orn = ornament("reply-ornament");
  const dressLabel = capsText("Dress code", 30, "dress-label");
  const dress = bodyText(invite.dressCode, 60, "dress", italic);
  col.add(heading);
  col.add(by);
  col.add(contact);
  col.add(orn.row);
  col.add(dressLabel);
  col.add(dress);
  stage.add(clip);
  clip.register((f) => {
    writeOn(heading, f, IN);
    rise(by, f, IN + 34);
    rise(contact, f, IN + 42);
    drawRule(orn.left, f, IN + 56);
    drawRule(orn.right, f, IN + 56);
    rise(dressLabel, f, IN + 66);
    rise(dress, f, IN + 72);
  });
}

/* ------------------------------------------------------------ scene: close */
{
  const clip = new Clip({ span: beats.close });
  stage.add(clip);
  // The photo again, set into an arch: cover keeps its shape inside any frame.
  const archW = 560 * u;
  const archH = 720 * u;
  const archX = (width - archW) / 2;
  const archY = 230 * u;
  const arch = new Group({
    clipFunc: (ctx) => {
      const r = archW / 2;
      ctx.moveTo(archX, archY + archH);
      ctx.lineTo(archX, archY + r);
      ctx.arc(archX + r, archY + r, r, Math.PI, 0);
      ctx.lineTo(archX + archW, archY + archH);
      ctx.closePath();
    },
  });
  const photo = new Image({
    name: "arch-photo",
    src: invite.photo.src,
    width: archW,
    height: archH,
    objectFit: "cover",
    objectPosition: "center",
    offsetX: archW / 2,
    offsetY: archH / 2,
    x: archX + archW / 2,
    y: archY + archH / 2,
  });
  arch.add(photo);
  clip.add(arch);
  // A gold outline a little outside the arch, drawn on.
  const outline = new Line({
    points: (() => {
      const pts: number[] = [];
      const gap = 18 * u;
      const r = archW / 2 + gap;
      const cx = archX + archW / 2;
      const cy = archY + archW / 2;
      pts.push(archX - gap, archY + archH + gap, archX - gap, cy);
      for (let a = 180; a <= 360; a += 6) {
        const t = (a * Math.PI) / 180;
        pts.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
      }
      pts.push(archX + archW + gap, archY + archH + gap);
      return pts;
    })(),
    stroke: palette.accent,
    strokeWidth: 2 * u,
    lineCap: "round",
    lineJoin: "round",
  });
  const outlineLength = 2 * (archH - archW / 2 + 18 * u) + Math.PI * (archW / 2 + 18 * u);
  outline.dash([outlineLength, outlineLength]);
  clip.add(outline);
  const col = new Flex({
    x: 0,
    y: archY + archH + 40 * u,
    width,
    height: 520 * u,
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 26 * u,
  });
  const closing = bodyText(invite.closing, 64, "closing", italic);
  const names = capsText(
    `${invite.names[0]} & ${invite.names[1]}`,
    42,
    "closing-names",
    palette.ink,
  );
  const where = capsText(
    `${d.day}.${String(monthIndex(d.month)).padStart(2, "0")}.${d.year} · ${invite.city.split(",")[0]}`,
    28,
    "closing-date",
  );
  col.add(closing);
  col.add(names);
  col.add(where);
  // A save the date promises the full invitation; say so last.
  const follow = isInvite ? null : capsText("Invitation to follow", 28, "follow", palette.accent);
  if (follow) col.add(follow);
  clip.add(col);
  clip.register((f, { durationInFrames }) => {
    arch.opacity(ramp(f, IN - 4, 30));
    const push = interpolate(f, [0, durationInFrames], [1.04, 1.0], clamp);
    photo.scaleX(push);
    photo.scaleY(push);
    outline.dashOffset(outlineLength * (1 - ramp(f, IN + 6, 50)));
    rise(closing, f, IN + 30);
    rise(names, f, IN + 46);
    rise(where, f, IN + 54);
    if (follow) rise(follow, f, IN + 64);
  });
}

function monthIndex(name: string) {
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  return months.indexOf(name.toLowerCase()) + 1;
}

/* ----------------------------------------------------------------- foreground */

// What drifts in front: petals for a garden, warm bokeh for an evening. Seeded,
// so every frame is a function of the frame.
const front = new Sequence();
comp.add(front);
const r = random("wedding-front");
const motes = Array.from({ length: theme.particles === "none" ? 0 : 26 }, (_, i) => {
  const size = r.range(0.6, 1.4);
  const node =
    theme.particles === "petals"
      ? new Ellipse({
          radiusX: 11 * u * size,
          radiusY: 6 * u * size,
          fill: i % 3 === 0 ? `${palette.washB}` : `${palette.washA}`,
          opacity: 0.75,
        })
      : new Circle({
          radius: 34 * u * size,
          fillRadialGradientStartPoint: { x: 0, y: 0 },
          fillRadialGradientEndPoint: { x: 0, y: 0 },
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: 34 * u * size,
          fillRadialGradientColorStops: [
            0,
            `${palette.glow}55`,
            0.6,
            `${palette.glow}22`,
            1,
            `${palette.glow}00`,
          ],
        });
  front.add(node);
  return {
    node,
    x: r.range(0, width),
    y: r.range(0, height),
    fall: r.range(18, 40) * u * (theme.particles === "petals" ? 1 : -0.5),
    sway: r.range(20, 60) * u,
    spin: r.range(-40, 40),
    phase: r.range(0, Math.PI * 2),
  };
});

// The light wash: a warm bloom that peaks on each cut, so scenes change behind
// light instead of a hard cut, the way the invites shot on film do.
const bloom = new Rect({
  x: 0,
  y: 0,
  width,
  height,
  fillRadialGradientStartPoint: { x: width * 0.5, y: height * 0.4 },
  fillRadialGradientEndPoint: { x: width * 0.5, y: height * 0.4 },
  fillRadialGradientStartRadius: 0,
  fillRadialGradientEndRadius: height * 0.8,
  fillRadialGradientColorStops: [
    0,
    palette.glow,
    0.6,
    `${palette.glow}e6`,
    1,
    `${palette.washB}cc`,
  ],
  opacity: 0,
});
front.add(bloom);
const cuts = Object.values(beats)
  .slice(1)
  .map((b) => b.start);

front.register((f, { time }) => {
  for (const m of motes) {
    const span = height + 200 * u;
    const y = ((((m.y + m.fall * time) % span) + span) % span) - 100 * u;
    m.node.x(m.x + Math.sin(time * 0.8 + m.phase) * m.sway);
    m.node.y(y);
    m.node.rotation(m.spin * time);
  }
  // Fade the bloom in and out around every cut, and in at the very start.
  let peak = interpolate(f, [0, WASH], [1, 0], clamp);
  for (const c of cuts) {
    const at = c.resolve();
    peak = Math.max(
      peak,
      interpolate(f, [at - WASH, at, at + WASH], [0, 1, 0], {
        easing: Easing.inOut(Easing.sin),
        ...clamp,
      }),
    );
  }
  bloom.opacity(peak * 0.94);
});

export default comp;
