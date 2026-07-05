export type GlContext = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * Full-screen quad. `u_flipY = 1` flips V so screen-top samples texture-top —
 * used only for the final pass into the visible framebuffer; intermediate FBO
 * passes use `u_flipY = 0` to keep source orientation (avoids odd/even
 * double-flip in ping-pong chains).
 */
export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
uniform float u_flipY;
out vec2 v_uv;
void main() {
	float y = mix(a_pos.y * 0.5 + 0.5, 0.5 - a_pos.y * 0.5, u_flipY);
	v_uv = vec2(a_pos.x * 0.5 + 0.5, y);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const VERTEX_SHADER_100 = `attribute vec2 a_pos;
uniform float u_flipY;
varying vec2 v_uv;
void main() {
	float y = mix(a_pos.y * 0.5 + 0.5, 0.5 - a_pos.y * 0.5, u_flipY);
	v_uv = vec2(a_pos.x * 0.5 + 0.5, y);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export function compileShader(gl: GlContext, source: string, type: number): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("effects: failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`effects: failed to compile shader: ${log}`);
  }
  return shader;
}

export function createProgram(gl: GlContext, fragment: string, vertex: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("effects: failed to create WebGL program");
  const vs = compileShader(gl, vertex, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragment, gl.FRAGMENT_SHADER);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`effects: failed to link program: ${log}`);
  }
  return program;
}

export function createTexture(gl: GlContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("effects: failed to create texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
