import { sequencesOf, useComposition, usePlayback } from "@smoove/studio";
import { useCallback } from "react";
import type { EditorContext } from "../types.js";

/** Snapshot the live composition + playhead for the agent's per-turn context. */
export function useEditorContext(): () => EditorContext | undefined {
  const { composition, selectedId } = useComposition();
  const { frame, fps } = usePlayback();

  return useCallback(() => {
    if (!composition) return undefined;
    return {
      compositionId: selectedId ?? "",
      frame,
      fps,
      durationInFrames: composition.durationInFrames.get(),
      sequences: sequencesOf(composition).map((s) => ({
        name: s.name() || s.id() || "sequence",
        from: s.from,
        durationInFrames: s.durationInFrames,
      })),
    };
  }, [composition, selectedId, frame, fps]);
}
