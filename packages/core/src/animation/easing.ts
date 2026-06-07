import BezierEasing from "bezier-easing";

type EasingFn = (t: number) => number;

const linear: EasingFn = (t) => t;

const ease: EasingFn = BezierEasing(0.42, 0, 1, 1);

const quad: EasingFn = (t) => t * t;

const cubic: EasingFn = (t) => t * t * t;

const poly =
  (n: number): EasingFn =>
  (t) =>
    t ** n;

const sin: EasingFn = (t) => 1 - Math.cos((t * Math.PI) / 2);

const circle: EasingFn = (t) => 1 - Math.sqrt(1 - t * t);

const exp: EasingFn = (t) => 2 ** (10 * (t - 1));

const elastic =
  (bounciness = 1): EasingFn =>
  (t) => {
    const p = bounciness * Math.PI;
    return 1 - Math.cos((t * Math.PI) / 2) ** 3 * Math.cos(t * p);
  };

const back =
  (s = 1.70158): EasingFn =>
  (t) =>
    t * t * ((s + 1) * t - s);

const bounce: EasingFn = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  }
  if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  }
  const t2 = t - 2.625 / 2.75;
  return 7.5625 * t2 * t2 + 0.984375;
};

const bezier = (x1: number, y1: number, x2: number, y2: number): EasingFn =>
  BezierEasing(x1, y1, x2, y2);

const step0: EasingFn = (t) => (t > 0 ? 1 : 0);
const step1: EasingFn = (t) => (t >= 1 ? 1 : 0);

// `in` is reserved — Remotion's API uses it as a method on `Easing`; identity here.
const inEasing = (easing: EasingFn): EasingFn => easing;

const out =
  (easing: EasingFn): EasingFn =>
  (t) =>
    1 - easing(1 - t);

const inOut =
  (easing: EasingFn): EasingFn =>
  (t) => {
    if (t < 0.5) return easing(t * 2) / 2;
    return 1 - easing((1 - t) * 2) / 2;
  };

export const Easing = {
  linear,
  ease,
  quad,
  cubic,
  poly,
  sin,
  circle,
  exp,
  elastic,
  back,
  bounce,
  bezier,
  step0,
  step1,
  in: inEasing,
  out,
  inOut,
};
