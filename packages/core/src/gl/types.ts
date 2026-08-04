/**
 * Uniforms a fragment pass uploads each frame, keyed by GLSL uniform name.
 * A `number` → `uniform1f`; a `number[]` of length 2/3/4 →
 * `uniform2f`/`uniform3f`/`uniform4f`.
 */
export type GlUniforms = Record<string, number | number[]>;
