import { Composition, Sequence } from "@smoove/core";
import Konva from "konva";
import type { RibbonProps, Stripe } from "./schema.js";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const FRAMES = 150;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Sweeping color ribbons behind an animated headline + badges. Reads its
    `props` signal live; edits arrive via `comp.setProps`. */
const comp = new Composition<RibbonProps>({
  id: "ribbon",
  fps: FPS,
  durationInFrames: FRAMES,
  width: WIDTH,
  height: HEIGHT,
  props: {
    headline: "Ribbon",
    align: "center",
    accent: "#ffffff",
    showStripes: true,
    stripes: [
      { color: "#7c5cff", label: "one" },
      { color: "#2bd9c4", label: "two" },
      { color: "#ff8a3d", label: "three" },
    ],
    badges: ["motion", "konva"],
  },
});
const p = () => comp.props.get();

const backdrop = new Sequence({ from: 0, durationInFrames: FRAMES, name: "video:Backdrop" });
backdrop.add(new Konva.Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: "#000" }));
comp.add(backdrop);

// stripe pool
const MAX_STRIPES = 8;
const stripeSeq = new Sequence({ from: 0, durationInFrames: FRAMES, name: "group:Stripes" });
const bars: Konva.Rect[] = [];
for (let i = 0; i < MAX_STRIPES; i++) {
  const r = new Konva.Rect({ x: 0, y: 0, width: 0, height: 0, fill: "#7c5cff", opacity: 0.85 });
  bars.push(r);
  stripeSeq.add(r);
}
comp.add(stripeSeq);
stripeSeq.register((frame) => {
  const { showStripes = true, stripes = [] } = p();
  const list = showStripes ? stripes : [];
  const n = Math.max(0, Math.min(MAX_STRIPES, list.length));
  const t = frame / FRAMES;
  const bandH = HEIGHT / Math.max(1, n);
  bars.forEach((bar, i) => {
    const on = i < n;
    bar.visible(on);
    if (!on) return;
    const s = list[i] as Stripe | undefined;
    const e = easeOut(seg(t, i * 0.05, i * 0.05 + 0.4));
    bar.x(0);
    bar.y(i * bandH);
    bar.height(bandH - 4);
    bar.width(WIDTH * e);
    bar.fill(s?.color ?? "#7c5cff");
  });
});

// headline
const titleSeq = new Sequence({ from: 0, durationInFrames: FRAMES, name: "Title" });
const headline = new Konva.Text({
  x: 80,
  y: HEIGHT / 2 - 60,
  width: WIDTH - 160,
  align: "center",
  fontFamily: "Hanken Grotesk, system-ui, sans-serif",
  fontSize: 92,
  fontStyle: "800",
  fill: "#ffffff",
  text: "Ribbon",
  shadowColor: "#000",
  shadowBlur: 24,
  shadowOpacity: 0.4,
});
titleSeq.add(headline);
comp.add(titleSeq);
titleSeq.register((frame) => {
  const { headline: text = "Ribbon", align = "center", accent = "#ffffff" } = p();
  const t = frame / FRAMES;
  const e = easeOut(seg(t, 0.1, 0.5));
  headline.text(text);
  headline.align(align);
  headline.fill(accent);
  headline.opacity(e);
  headline.scaleX(0.9 + 0.1 * e);
  headline.scaleY(0.9 + 0.1 * e);
});

// badges
const MAX_BADGES = 6;
const badgeSeq = new Sequence({ from: 0, durationInFrames: FRAMES, name: "transition:Badges" });
const badgeGroups: Konva.Label[] = [];
for (let i = 0; i < MAX_BADGES; i++) {
  const label = new Konva.Label({ x: 0, y: HEIGHT - 90 });
  label.add(new Konva.Tag({ fill: "#1e1d25", cornerRadius: 999, stroke: "#ffffff22" }));
  label.add(
    new Konva.Text({
      text: "",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 18,
      fill: "#a4a2b2",
      padding: 10,
    }),
  );
  badgeGroups.push(label);
  badgeSeq.add(label);
}
comp.add(badgeSeq);
badgeSeq.register((frame) => {
  const { badges = [] } = p();
  const n = Math.max(0, Math.min(MAX_BADGES, badges.length));
  const t = frame / FRAMES;
  let cursorX = 80;
  badgeGroups.forEach((label, i) => {
    const on = i < n;
    label.visible(on);
    if (!on) return;
    const text = label.getText() as Konva.Text;
    text.text(`#${badges[i]}`);
    const e = easeOut(seg(t, 0.4 + i * 0.06, 0.4 + i * 0.06 + 0.3));
    label.opacity(e);
    label.x(cursorX);
    label.y(HEIGHT - 90 + (1 - e) * 12);
    cursorX += label.width() + 12;
  });
});

export default comp;
