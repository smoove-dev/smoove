import { createContext } from "react";
import type { StudioStore } from "../../store/store.js";

export const StudioContext = createContext<StudioStore | null>(null);
