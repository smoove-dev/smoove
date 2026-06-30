import { resolveDefaults } from "../schema/kf.js";
import type { SmooveSchema } from "../schema/types.js";
import { usePlayerSignal } from "../signals/signal-bridge.js";
import { useStudio } from "./use-studio.js";

export type PropsForm = {
  schema?: SmooveSchema;
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  setValues: (next: Record<string, unknown>) => void;
  reset: () => void;
};

/**
 * Bridge a composition's props signal to the form: reading `values` re-renders
 * on edits, writing pushes into the signal (which the studio has wired to
 * `comp.refresh()`, so the preview updates with the playhead preserved).
 */
export function usePropsForm(id: string): PropsForm {
  const store = useStudio();
  const sig = store.getPropsSignal(id);
  const values = usePlayerSignal(sig);
  const entry = store.getEntry(id);
  return {
    schema: entry?.propsSchema,
    values,
    setValue: (key, value) => sig.set({ ...sig.get(), [key]: value }),
    setValues: (next) => sig.set(next),
    reset: () => sig.set(resolveDefaults(entry?.propsSchema, entry?.defaultProps)),
  };
}
