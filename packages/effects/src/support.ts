import Konva from "konva";

let supported: boolean | undefined;

/**
 * Whether the canvas backend implements `ctx.filter` (native CSS filters).
 * True in Chromium/Firefox and on skia-canvas; false where unsupported
 * (blur falls back to a CPU pass there).
 */
export function supportsCtxFilter(): boolean {
  if (supported !== undefined) return supported;
  try {
    const canvas = Konva.Util.createCanvasElement();
    const ctx = canvas.getContext("2d");
    supported = !!ctx && typeof (ctx as { filter?: unknown }).filter === "string";
  } catch {
    supported = false;
  }
  return supported;
}

/** Test/embedder override; pass `undefined` to re-probe. */
export function setCtxFilterSupport(v: boolean | undefined): void {
  supported = v;
}
