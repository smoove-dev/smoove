import { Block, Composition, Flex, interpolate, measure, Rect, Sequence, Text } from "@smoove/core";

/**
 * Beat A lays out a row of flex tiles. Beat B — a separate sequence — opens a
 * spotlight ring from the middle tile's exact stage rect, obtained with
 * measure({ at }) even when the viewer seeks straight into beat B and beat A
 * never ran. No scaffolding sequence, no hand-copied coordinates.
 */
const width = 1280;
const height = 720;
const aLen = 90;
const bLen = 120;

const comp = new Composition({
  id: "measure-reveal",
  fps: 60,
  durationInFrames: aLen + bLen,
  width,
  height,
  loop: true,
});

const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(base);

// Beat A: a centered row of tiles.
const beatA = new Sequence({ from: 0, durationInFrames: aLen });
const row = new Flex({ x: 190, y: 260, flexDirection: "row", gap: 30 });
const tiles = ["#1f6feb", "#bb8009", "#1a7f76"].map((fill, i) => {
  const tile = new Block({ width: 280, height: 200, background: fill, cornerRadius: 18 });
  tile.add(new Text({ text: `tile ${i + 1}`, fontSize: 32, fill: "#0d1117", margin: 20 }));
  return tile;
});
for (const t of tiles) row.add(t);
beatA.add(row);
comp.add(beatA);

// Beat B: measure beat A's middle tile at its final frame, then spotlight it.
const beatB = new Sequence({ from: aLen, durationInFrames: bLen });
const ring = new Rect({ stroke: "#bc8cff", strokeWidth: 6, cornerRadius: 24 });
const label = new Text({
  x: 0,
  y: 80,
  width,
  align: "center",
  text: "measure(tile, { at: 89 }) — no scaffolding sequence",
  fontSize: 28,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fill: "#e6edf3",
});
beatB.add(ring);
beatB.add(label);
beatB.register((local) => {
  const target = tiles[1];
  if (!target) return;
  const m = measure(target, { at: aLen - 1 });
  const grow = interpolate(local, [0, 30], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  ring.setAttrs({
    x: m.x - 10 - grow,
    y: m.y - 10 - grow,
    width: m.width + 20 + grow * 2,
    height: m.height + 20 + grow * 2,
    opacity: interpolate(local, [0, 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  });
});
comp.add(beatB);

export default comp;
