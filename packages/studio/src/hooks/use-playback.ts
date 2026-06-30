import type { ReadonlySignal } from "@smoove/core";
import { usePlayerSignal, useSignalValue } from "../signals/signal-bridge.js";
import { useStudio } from "./use-studio.js";

const numSig = (v: number): ReadonlySignal<number> => ({ get: () => v, subscribe: () => () => {} });
const boolSig = (v: boolean): ReadonlySignal<boolean> => ({
  get: () => v,
  subscribe: () => () => {},
});
const ZERO = numSig(0);
const ONE = numSig(1);
const FALSE = boolSig(false);
const VOL = numSig(1);

/** All live playback values, sourced from the mounted player's signals. */
export function usePlayback() {
  const store = useStudio();
  const player = useSignalValue(store.player);
  const frame = usePlayerSignal(player?.state.frame ?? ZERO);
  const total = usePlayerSignal(player?.state.duration ?? ONE);
  const playing = usePlayerSignal(player?.state.playing ?? FALSE);
  const loop = usePlayerSignal(player?.state.loop ?? FALSE);
  const volume = usePlayerSignal(player?.state.volume ?? VOL);
  const muted = usePlayerSignal(player?.state.muted ?? FALSE);
  const fullscreen = usePlayerSignal(player?.state.fullscreen ?? FALSE);
  const fps = player?.fps || 30;
  return {
    player,
    frame,
    total,
    playing,
    loop,
    volume,
    muted,
    fullscreen,
    fps,
    durSec: total / fps,
    timeSec: frame / fps,
  };
}
