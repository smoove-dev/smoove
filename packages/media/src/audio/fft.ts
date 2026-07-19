/**
 * Minimal iterative radix-2 Cooley-Tukey FFT, in place over parallel
 * real/imaginary arrays. Length must be a power of two. ~50 lines beats a
 * dependency: this runs once per analysis window at envelope-build time, never
 * per painted frame.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] as number;
      re[i] = re[j] as number;
      re[j] = tr;
      const ti = im[i] as number;
      im[i] = im[j] as number;
      im[j] = ti;
    }
  }
  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k] as number;
        const ai = im[i + k] as number;
        const xr = re[i + k + half] as number;
        const xi = im[i + k + half] as number;
        const br = xr * cr - xi * ci;
        const bi = xr * ci + xi * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + half] = ar - br;
        im[i + k + half] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Smallest power of two ≥ `n`. */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
