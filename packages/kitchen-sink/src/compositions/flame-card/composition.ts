import { Block, Composition, interpolate, Sequence, Text } from "@smoove/core";
import { flameWrap } from "@smoove/effects";

const width = 1280;
const height = 720;
const fps = 30;
const durationInFrames = fps * 7;

const comp = new Composition({
  id: "flame-card",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Block({ x: 0, y: 0, width, height, background: "#08070a" }));

// The card is the burning node, so its own box is what the shader shades, and
// the content sitting inside it comes along in the same capture. The same effect
// as `flame-wrap`, pushed away from its defaults: a warm tint, charring, and a
// burn line that eats deeper as it holds.
const cardWidth = 640;

const card = new Block({
  x: (width - cardWidth) / 2,
  y: 180,
  width: cardWidth,
  flexDirection: "column",
  padding: 44,
  gap: 18,
  cornerRadius: 28,
  borderSize: 1,
  borderColor: "#2b2430",
  background: {
    gradient: {
      type: "linear",
      stops: [
        [0, "#1a1520"],
        [1, "#0e0b12"],
      ],
      angle: 135,
    },
  },
});

card.add(
  new Text({
    text: "EFFECTS",
    fontSize: 20,
    fill: "#c2703c",
    letterSpacing: 6,
    fontStyle: "bold",
  }),
);

card.add(
  new Text({
    text: "Set a card on fire",
    fontSize: 58,
    fontStyle: "bold",
    fill: "#f4efe8",
    width: "100%",
  }),
);

card.add(
  new Text({
    text: "flameWrap follows this card's rounded edge, and the type inside stays readable while it burns.",
    fontSize: 24,
    fill: "#8b8189",
    lineHeight: 1.5,
    width: "100%",
  }),
);

const fire = flameWrap({
  intensity: 0,
  color: [1, 0.45, 0.1],
  // Matches the card's own cornerRadius, so the burn line follows its edge.
  radius: 28,
  height: 130,
  spread: 20,
  speed: 0.28,
  turbulence: 0.55,
  turbulenceReach: 34,
  distortion: 8,
  melt: 6,
  rim: 2.6,
  sparks: 1.6,
  smoke: 1.3,
  ember: 1.8,
  scorch: 0,
});

card.effects([fire]);
main.add(card);
comp.add(main);

const ignite = 26;
const dieFrom = durationInFrames - 34;
const out = durationInFrames - 4;

main.register((frame) => {
  // Catches quickly, holds, then dies back down so the loop closes on itself.
  fire.intensity = interpolate(frame, [0, ignite, dieFrom, out], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Charring builds while it burns and stays once the flames drop away.
  fire.scorch = interpolate(frame, [ignite, dieFrom], [0, 1.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The edge eats deeper as the fire takes hold.
  fire.melt = interpolate(frame, [ignite, dieFrom], [3, 9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
});

export default comp;
