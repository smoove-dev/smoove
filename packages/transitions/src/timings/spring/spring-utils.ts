// TODO: promote to @konva-motion/core (a general-purpose spring() solver).
// Self-contained physics spring, ported from Remotion's packages/core/src/spring.
// Analytic solution to the damped harmonic oscillator — pure & deterministic.

export type SpringConfig = {
  damping: number;
  mass: number;
  stiffness: number;
  overshootClamping: boolean;
};

export const defaultSpringConfig: SpringConfig = {
  damping: 10,
  mass: 1,
  stiffness: 100,
  overshootClamping: false,
};

type AdvanceArgs = {
  fromValue: number;
  toValue: number;
  velocity: number;
  config: SpringConfig;
  timestamp: number; // ms since the spring started
};

type AdvanceResult = { position: number; velocity: number };

export function springCalculation({
  fps,
  frame,
  config = {},
  from = 0,
  to = 1,
}: {
  fps: number;
  frame: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
}): AdvanceResult {
  const cfg: SpringConfig = { ...defaultSpringConfig, ...config };
  if (cfg.damping <= 0) {
    throw new Error(`springTiming: config.damping must be > 0 (got ${cfg.damping})`);
  }
  if (cfg.mass <= 0) {
    throw new Error(`springTiming: config.mass must be > 0 (got ${cfg.mass})`);
  }
  if (cfg.stiffness <= 0) {
    throw new Error(`springTiming: config.stiffness must be > 0 (got ${cfg.stiffness})`);
  }

  let value = from;
  let velocity = 0;
  const frameClamped = Math.max(0, frame);
  const wholeFrames = Math.floor(frameClamped);

  for (let f = 0; f <= wholeFrames; f++) {
    const isLast = f === wholeFrames;
    const proportion = isLast ? frameClamped - wholeFrames : 1;
    if (f === 0 && proportion === 0) continue;
    const timestamp = (proportion / fps) * 1000;
    const result = advance({ fromValue: value, toValue: to, velocity, config: cfg, timestamp });
    value = result.position;
    velocity = result.velocity;
  }

  return { position: value, velocity };
}

function advance({ fromValue, toValue, velocity, config, timestamp }: AdvanceArgs): AdvanceResult {
  const { damping: c, mass: m, stiffness: k } = config;
  const t = Math.min(timestamp, 64) / 1000;

  const v0 = -velocity;
  const x0 = toValue - fromValue;

  const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio
  const omega0 = Math.sqrt(k / m); // undamped angular frequency
  const omega1 = omega0 * Math.sqrt(1.0 - zeta * zeta); // damped angular frequency

  if (zeta < 1) {
    // Under-damped.
    const envelope = Math.exp(-zeta * omega0 * t);
    const position =
      toValue -
      envelope *
        (((v0 + zeta * omega0 * x0) / omega1) * Math.sin(omega1 * t) + x0 * Math.cos(omega1 * t));
    const velocityResult =
      zeta *
        omega0 *
        envelope *
        ((Math.sin(omega1 * t) * (v0 + zeta * omega0 * x0)) / omega1 + x0 * Math.cos(omega1 * t)) -
      envelope *
        (Math.cos(omega1 * t) * (v0 + zeta * omega0 * x0) - omega1 * x0 * Math.sin(omega1 * t));
    return { position, velocity: velocityResult };
  }

  // Critically damped.
  const envelope = Math.exp(-omega0 * t);
  const position = toValue - envelope * (x0 + (v0 + omega0 * x0) * t);
  const velocityResult = envelope * (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);
  return { position, velocity: velocityResult };
}
