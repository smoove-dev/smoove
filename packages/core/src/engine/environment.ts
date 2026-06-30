import type Konva from "konva";

/**
 * Runtime mode the engine is operating in — mirrors Remotion's
 * `getRemotionEnvironment()`. `Video` (and any environment-aware node) branches
 * its behavior on this: realtime playback in preview, deterministic frame-by-frame
 * seeking when rendering.
 */
export type Environment = {
  /** Server / offline frame-by-frame rendering (e.g. Bun + Skia Canvas). */
  isRendering: boolean;
  /** Browser realtime playback / scrubbing. */
  isPreview: boolean;
  /** Reserved to mirror Remotion; always false for now. */
  isClientSideRendering: boolean;
};

export type EnvironmentMode = "preview" | "rendering";

const RENDERING_FLAG = "__KONVA_MOTION_RENDERING__";

type RenderingGlobal = { [RENDERING_FLAG]?: boolean };

/**
 * Resolve the environment. An explicit `override` (from `CompositionOptions.mode`)
 * always wins; otherwise we detect from a global flag — Remotion reads
 * `window.remotion_*`, we read `globalThis.__KONVA_MOTION_RENDERING__`, which a
 * server renderer sets before constructing the composition.
 */
export function detectEnvironment(override?: EnvironmentMode): Environment {
  const isRendering =
    override !== undefined
      ? override === "rendering"
      : (globalThis as RenderingGlobal)[RENDERING_FLAG] === true;
  return {
    isRendering,
    isPreview: !isRendering,
    isClientSideRendering: false,
  };
}

/** Marker the Composition stamps on its Stage; read structurally to avoid a circular import. */
type EnvCarrier = { environment?: Environment };

/**
 * The environment of the Composition attached to `stage`, mirroring Remotion's
 * `getRemotionEnvironment()`. Falls back to ambient detection if no Composition
 * is attached.
 */
export function getEnvironment(stage: Konva.Stage): Environment {
  const comp = (stage as Konva.Stage & { __SmooveComposition?: EnvCarrier })
    .__SmooveComposition;
  return comp?.environment ?? detectEnvironment();
}
