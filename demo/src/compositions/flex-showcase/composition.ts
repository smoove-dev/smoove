import { Block, Composition, Easing, Flex, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";

const PALETTE = ["#ff6b6b", "#ffd166", "#06d6a0", "#4ea1ff", "#c780ff"];

const swatch = (
  color: string,
  extra: Record<string, unknown> = {},
  size: { width?: number | string; height?: number | string } = {},
) =>
  new Block({
    width: size.width as number | `${number}%` | undefined,
    height: size.height as number | `${number}%` | undefined,
    background: color,
    cornerRadius: 6,
    ...extra,
  });

const width = 1280;
const height = 720;
const duration = 240;
const comp = new Composition({
  id: "flex-showcase",
  fps: 30,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const rowH = 64;
const stackW = Math.min(620, width - 40);
const stack = new Flex({
  x: (width - stackW) / 2,
  y: 20,
  width: stackW,
  flexDirection: "column",
  gap: 14,
});

const labelText = (text: string) =>
  new Konva.Text({ text, fontSize: 12, fill: "#9ca3af", fontStyle: "bold" });

const section = (title: string, body: Block) => {
  const wrap = new Flex({ width: "100%", flexDirection: "column", gap: 6 });
  wrap.add(labelText(title));
  wrap.add(body);
  return wrap;
};

// 1. justify-content variants — row of three boxes that animate justify.
const justifyRow = new Block({
  width: "100%",
  height: rowH,
  flexDirection: "row",
  padding: 8,
  gap: 8,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 8,
});
const justifyKids = [0, 1, 2].map((i) =>
  swatch(PALETTE[i] ?? "#fff", {}, { width: 48, height: 48 }),
);
for (const k of justifyKids) justifyRow.add(k);
stack.add(section("justifyContent cycles: start → center → end → space-between", justifyRow));

// 2. align-items variants — row of three differently-sized boxes.
const alignRow = new Block({
  width: "100%",
  height: rowH + 20,
  flexDirection: "row",
  padding: 8,
  gap: 8,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 8,
});
const alignSizes = [28, 56, 40];
const alignKids = alignSizes.map((s, i) =>
  swatch(PALETTE[i + 1] ?? "#fff", {}, { width: s, height: s }),
);
for (const k of alignKids) alignRow.add(k);
stack.add(section("alignItems cycles: start → center → end → stretch", alignRow));

// 3. flex-grow distribution — three boxes share the row, weights shift.
const growRow = new Block({
  width: "100%",
  height: rowH,
  flexDirection: "row",
  padding: 8,
  gap: 8,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 8,
});
const growKids = [0, 1, 2].map((i) =>
  swatch(PALETTE[i] ?? "#fff", { flexGrow: 1, height: "100%" } as Record<string, unknown>),
);
for (const k of growKids) growRow.add(k);
stack.add(section("flexGrow weights animate independently", growRow));

// 4. gap animation — five boxes whose gap breathes.
const gapRow = new Block({
  width: "100%",
  height: rowH,
  flexDirection: "row",
  padding: 8,
  gap: 4,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 8,
});
for (let i = 0; i < 5; i++) {
  gapRow.add(swatch(PALETTE[i] ?? "#fff", { flexGrow: 1, height: "100%" }));
}
stack.add(section("gap breathes from 4 → 28", gapRow));

main.add(stack);

main.register((frame) => {
  const t = frame / duration;

  // 1. justifyContent cycles every 60 frames.
  const justifyModes = ["flex-start", "center", "flex-end", "space-between"] as const;
  justifyRow.setAttr("justifyContent", justifyModes[Math.floor(frame / 60) % 4]);

  // 2. alignItems cycles every 60 frames.
  const alignModes = ["flex-start", "center", "flex-end", "stretch"] as const;
  alignRow.setAttr("alignItems", alignModes[Math.floor(frame / 60) % 4]);

  // 3. flex-grow: each child's weight independently pulses.
  const pulse = (offset: number) =>
    interpolate(0.5 - 0.5 * Math.cos((t + offset) * Math.PI * 4), [0, 1], [1, 4], {
      easing: Easing.inOut(Easing.cubic),
    });
  growKids[0]?.setAttr("flexGrow", pulse(0));
  growKids[1]?.setAttr("flexGrow", pulse(0.33));
  growKids[2]?.setAttr("flexGrow", pulse(0.66));

  // 4. gap breathes.
  const gap = 4 + 24 * (0.5 - 0.5 * Math.cos(t * Math.PI * 4));
  gapRow.setAttr("gap", gap);
});

comp.add(main);
export default comp;
