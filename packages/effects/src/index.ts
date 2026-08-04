export { type Blur, type BlurOptions, type BlurType, blur } from "./blur.js";
export { type ChromaKey, type ChromaKeyOptions, chromaKey } from "./chroma-key.js";
export { type Droplets, type DropletsOptions, droplets } from "./droplets.js";
export {
  type FlameWrap,
  type FlameWrapOptions,
  type FlameWrapShape,
  flameWrap,
} from "./flame-wrap.js";
// Exported for cross-package testing: @smoove/renderer compiles these through the
// headless-gl (WebGL1) platform to prove the server path before a render.
export { BLUR_LENS_FRAG } from "./glsl/blur-lens.frag.js";
export { CHROMA_KEY_FRAG } from "./glsl/chroma-key.frag.js";
export { DROPLETS_FRAG } from "./glsl/droplets.frag.js";
export { FLAME_WRAP_FRAG, FLAME_WRAP_SILHOUETTE_FRAG } from "./glsl/flame-wrap.frag.js";
