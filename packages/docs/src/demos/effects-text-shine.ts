import { Composition, Rect, Sequence, Text } from "@smoove/core";
import {
  type Effect,
  HolographicEffect,
  NeonEffect,
  PulseGlowEffect,
  ShineEffect,
  SparkleEffect,
} from "@smoove/effects";

/**
 * The five text-shine filters side by side. Every one runs on the composition
 * clock with zero register() wiring — sweep, flicker, twinkle, drift and
 * pulse are all built into the effects themselves.
 */
const width = 1280;
const height = 720;
const fps = 30;
const duration = fps * 6;

const comp = new Composition({
  id: "effects-text-shine",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence();
scene.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const line = (y: number, text: string, fill: string, effects: Effect[]) =>
  scene.add(
    new Text({
      x: 0,
      y,
      width,
      text,
      fontSize: 84,
      fontStyle: "bold",
      align: "center",
      letterSpacing: 6,
      fill,
      effects,
    }),
  );

line(48, "shine", "#d4a017", [new ShineEffect({ color: "#fff3c4", period: 3 })]);
line(178, "neon", "#0e7490", [new NeonEffect({ color: "#22d3ee", radius: 26, flicker: 0.5 })]);
line(308, "sparkle", "#e9e2f2", [new SparkleEffect({ density: 16, size: 4 })]);
line(438, "holographic", "#cfd6e6", [new HolographicEffect({ intensity: 0.8 })]);
line(568, "pulse glow", "#ff5148", [
  new PulseGlowEffect({ color: "#ff2015", radius: 28, period: 2 }),
]);

comp.add(scene);

export default comp;
