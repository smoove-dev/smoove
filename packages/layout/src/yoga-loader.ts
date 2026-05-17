import { type Yoga, loadYoga } from "yoga-layout/load";

let yogaPromise: Promise<void> | null = null;
let yogaSync: Yoga | null = null;

export function initYoga(): Promise<void> {
  if (!yogaPromise) {
    yogaPromise = loadYoga().then((y) => {
      yogaSync = y;
    });
  }
  return yogaPromise;
}

export function getYoga(): Yoga {
  if (!yogaSync) {
    throw new Error("@konva-motion/layout: call `await initYoga()` before computeLayout()");
  }
  return yogaSync;
}
