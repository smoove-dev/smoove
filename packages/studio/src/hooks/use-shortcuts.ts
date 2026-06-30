import { useEffect } from "react";
import { useStudio } from "./use-studio.js";

/**
 * Global keyboard shortcuts. The studio owns them (the `<smoove-player>` is mounted
 * with `no-keyboard`): space play/pause, ←/→ step, f fullscreen, l loop,
 * i/o set loop in/out at the playhead. Ignored while typing in a field.
 */
export function useShortcuts(): void {
  const store = useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const api = store.player.get();
      if (!api) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          api.toggle();
          break;
        case "ArrowRight":
          e.preventDefault();
          api.stepBy(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          api.stepBy(-1);
          break;
        case "f":
        case "F":
          api.toggleFullscreen();
          break;
        case "l":
        case "L":
          api.toggleLoop();
          break;
        case "i":
        case "I":
          store.setRegionIn(api.getCurrentFrame());
          break;
        case "o":
        case "O":
          store.setRegionOut(api.getCurrentFrame());
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
}
