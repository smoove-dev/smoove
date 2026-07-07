// The GL plumbing moved to @smoove/core (shared by transitions and effects).
// Re-exported here so transitions' internals and public API stay unchanged.
export {
  compileShader,
  createProgram,
  createTexture,
  type GlContext,
  VERTEX_SHADER,
  VERTEX_SHADER_100,
} from "@smoove/core";
