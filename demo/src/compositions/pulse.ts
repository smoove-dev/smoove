import { Composition, type ReadonlySignal, Sequence } from "@konva-motion/core";
import Konva from "konva";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const FRAMES = 120;

export type PulseProps = {
  title: string;
  accent: string;
  count: number;
  size: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A row of pulsing circles + a title — reads its props signal live. */
export function pulse(props: ReadonlySignal<Record<string, unknown>>): Composition {
  const p = () => props.get() as Partial<PulseProps>;
  const comp = new Composition({
    id: "pulse",
    fps: FPS,
    durationInFrames: FRAMES,
    width: WIDTH,
    height: HEIGHT,
  });

  // backdrop
  const backdrop = new Sequence({ from: 0, durationInFrames: FRAMES, name: "video:Backdrop" });
  backdrop.add(new Konva.Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: "#0c0c12" }));
  comp.add(backdrop);

  // pulsing circles (a fixed pool, shown up to `count`)
  const MAX = 12;
  const pulseSeq = new Sequence({ from: 0, durationInFrames: FRAMES, name: "Pulse" });
  const circles: Konva.Circle[] = [];
  for (let i = 0; i < MAX; i++) {
    const c = new Konva.Circle({ x: WIDTH / 2, y: HEIGHT / 2, radius: 40, fill: "#7c5cff" });
    circles.push(c);
    pulseSeq.add(c);
  }
  comp.add(pulseSeq);
  pulseSeq.register((frame) => {
    const { accent = "#7c5cff", count = 6, size = 60 } = p();
    const n = Math.max(1, Math.min(MAX, Math.round(count)));
    const t = frame / FRAMES;
    const margin = 180;
    circles.forEach((c, i) => {
      const on = i < n;
      c.visible(on);
      if (!on) return;
      const x = lerp(margin, WIDTH - margin, n === 1 ? 0.5 : i / (n - 1));
      const phase = i * 0.5 + t * Math.PI * 4;
      const r = size * (0.55 + 0.45 * Math.sin(phase));
      c.x(x);
      c.y(HEIGHT / 2);
      c.radius(Math.max(4, r));
      c.fill(accent);
      c.opacity(0.5 + 0.5 * (0.5 + 0.5 * Math.sin(phase)));
    });
  });

  // title
  const titleSeq = new Sequence({ from: 0, durationInFrames: FRAMES, name: "Title" });
  const title = new Konva.Text({
    x: 0,
    y: 90,
    width: WIDTH,
    align: "center",
    fontFamily: "Hanken Grotesk, system-ui, sans-serif",
    fontSize: 64,
    fontStyle: "800",
    fill: "#eceaf2",
    text: "Pulse",
  });
  titleSeq.add(title);
  comp.add(titleSeq);
  titleSeq.register((frame) => {
    const { title: text = "Pulse" } = p();
    title.text(text);
    const e = Math.min(1, frame / 20);
    title.opacity(e);
    title.y(lerp(70, 90, e));
  });

  return comp;
}
