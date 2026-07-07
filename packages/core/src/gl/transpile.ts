/**
 * Mechanically downgrade a GLSL ES 3.00 (`#version 300 es`) fragment shader —
 * the form every Tier B presentation is authored in — to GLSL ES 1.00, so it
 * can run on a WebGL 1 context (e.g. `headless-gl` during server rendering,
 * which has no WebGL2). The presentations follow a single, regular pattern:
 *
 * - `#version 300 es`     → removed (1.00 has no version directive)
 * - `out vec4 <name>;`    → removed; writes to `<name>` become `gl_FragColor`
 * - `in <type> <name>;`   → `varying <type> <name>;`
 * - `texture(s, uv)`      → `texture2D(s, uv)`
 * - derivatives (`fwidth`/`dFdx`/`dFdy`) → `#extension GL_OES_standard_derivatives`
 *   prepended (the context must also enable the extension — the runner does)
 *
 * Paired with {@link VERTEX_SHADER_100}. Kept deliberately string-based (no real
 * GLSL parse) — it only needs to cover the shapes in `presentations/`.
 */
export function transpileTo100(fragment: string): string {
  // Capture the fragment-output name so its writes can be rewired to gl_FragColor.
  const outMatch = fragment.match(/\bout\s+vec4\s+(\w+)\s*;/);
  const outName = outMatch?.[1];
  let src = fragment
    .replace(/#version\s+300\s+es[^\n]*\n/, "")
    .replace(/\bout\s+vec4\s+\w+\s*;\s*/g, "")
    .replace(/\bin\s+(vec[234]|float|int)\b/g, "varying $1")
    .replace(/\btexture\s*\(/g, "texture2D(");
  if (outName) {
    src = src.replace(new RegExp(`\\b${outName}\\b`, "g"), "gl_FragColor");
  }
  if (/\b(fwidth|dFdx|dFdy)\s*\(/.test(src)) {
    src = `#extension GL_OES_standard_derivatives : enable\n${src}`;
  }
  return src;
}
