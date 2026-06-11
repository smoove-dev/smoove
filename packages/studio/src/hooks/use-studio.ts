import { useContext } from "react";
import { StudioContext } from "../components/studio/studio-context.js";
import type { StudioStore } from "../store/store.js";

/** Read the central studio store. Must be used inside `<Studio>`. */
export function useStudio(): StudioStore {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio() must be used inside <Studio>");
  return ctx;
}
