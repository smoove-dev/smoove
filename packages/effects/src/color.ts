/** Parse `#rgb`, `#rrggbb`, or `#rrggbbaa` into 0–255 channels (alpha 0–255). */
export function parseHexColor(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (h.length === 6) h += "ff";
  if (h.length !== 8 || /[^0-9a-fA-F]/.test(h)) {
    throw new Error(`[smoove] invalid hex color: ${hex}`);
  }
  const n = Number.parseInt(h, 16);
  return { r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255, a: n & 255 };
}

/** Hex color → straight-alpha vec4 in 0–1, for shader uniforms. */
export function parseColorVec4(hex: string): [number, number, number, number] {
  const { r, g, b, a } = parseHexColor(hex);
  return [r / 255, g / 255, b / 255, a / 255];
}
