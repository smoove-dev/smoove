import { Block, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { flameWrap } from "@smoove/effects";

const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 6;

const comp = new Composition({ id: "flame-wrap", fps, durationInFrames, width, height });

const main = new Sequence();

// A near-black backdrop: fire reads as light, so it needs darkness to sit in.
main.add(new Block({ x: 0, y: 0, width, height, background: "#08070a" }));

// The burning node is a card and the fire wraps its rounded box. Keep that box
// tight around the content: the capture region is the node's bounding box plus
// padding, so a full-stage node would have the shader shading the whole frame
// every frame.
const cardWidth = 620;

const card = new Block({
  x: (width - cardWidth) / 2,
  y: 210,
  width: cardWidth,
  flexDirection: "column",
  padding: 48,
  gap: 20,
  cornerRadius: 40,
  background: "#0f1117",
});

card.add(
  new Text({
    text: "FLAMEWRAP",
    fontSize: 20,
    fill: "#5a8bff",
    letterSpacing: 8,
    fontStyle: "bold",
  }),
);

card.add(
  new Text({
    text: "Set anything on fire",
    fontSize: 56,
    fontStyle: "bold",
    fill: "#f2f4f8",
    width: "100%",
  }),
);

card.add(
  new Text({
    text: "The flames wrap the node's rounded box, eat into its edge, and light what survives.",
    fontSize: 23,
    fill: "#7c8496",
    lineHeight: 1.5,
    width: "100%",
  }),
);

// Everything default except the ignition and the corner radius, which has to
// match the card's own so the burn line follows its edge.
const fire = flameWrap({ intensity: 0, radius: 40 });

card.effects([fire]);
main.add(card);
comp.add(main);

main.register((frame) => {
  // Catches quickly, holds, then dies back down so the loop closes on itself.
  fire.intensity = interpolate(
    frame,
    [0, 24, durationInFrames - 30, durationInFrames - 6],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
});

export default comp;
