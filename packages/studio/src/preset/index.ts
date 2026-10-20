/** @smoove/studio/preset: run, build and detach the studio app that ships in this package. Node only. */
export {
  DEFAULT_PORT,
  isDetached,
  listFiles,
  PRESET_DIR,
  PresetError,
  syncPresetApp,
  templateDir,
} from "./app.js";
export { APP_DIR, type DetachPlan, detach, planDetach } from "./detach.js";
export { buildPreset, servePreset, startPreset } from "./run.js";
export { testPreset } from "./test.js";
