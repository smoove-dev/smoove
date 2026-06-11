import { useEffect, useState } from "react";
import { useSignalValue } from "../signals/signal-bridge.js";
import { useStudio } from "./use-studio.js";

/** Measure realtime fps by counting how often the player's frame advances. */
export function useRealFps(): number {
  const store = useStudio();
  const player = useSignalValue(store.player);
  const [real, setReal] = useState(0);
  useEffect(() => {
    if (!player) return;
    let count = 0;
    const unsub = player.state.frame.subscribe(() => {
      count++;
    });
    const id = setInterval(() => {
      setReal(count * 2);
      count = 0;
    }, 500);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [player]);
  return real;
}
