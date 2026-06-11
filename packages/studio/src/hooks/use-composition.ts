import { useSignalValue } from "../signals/signal-bridge.js";
import type { LoadStatus } from "../store/store.js";
import { useStudio } from "./use-studio.js";

/** Read the active composition + its load status from the store. */
export function useComposition() {
  const store = useStudio();
  const composition = useSignalValue(store.composition);
  const selectedId = useSignalValue(store.selectedId);
  const status: LoadStatus = useSignalValue(store.loadStatus)[selectedId] ?? "idle";
  const error = useSignalValue(store.loadError);
  const entry = store.getEntry(selectedId);
  return { composition, selectedId, status, error, entry };
}
