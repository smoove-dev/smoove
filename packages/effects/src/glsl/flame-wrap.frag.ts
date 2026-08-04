/**
 * flameWrap's fragment shader.
 *
 * A port of the reference WebGL2 flame effect, kept line-for-line faithful in
 * its maths so the picture matches: same simplex noise, same turbulence warp,
 * same tongue/bite shaping of the burning outline, same spark layers, same
 * ember/char/dissolve treatment of the content.
 *
 * Three things had to change, and only these three:
 *
 * 1. **Dialect.** Authored in `#version 300 es` but restricted to the subset
 *    `transpileTo100` can mechanically downgrade, because the server path
 *    (headless-gl) is WebGL1 only. No bit operations, no integer hashing, no
 *    `round`/`trunc`, constant loop bounds only. See `dialect.test.ts` for the
 *    static guard and `@smoove/renderer`'s effects test for the real compile.
 * 2. **Atlas.** The reference renders a canvas that *is* the padded box and
 *    samples its content texture in rect-normalised uv. Here `u_tex0` is the
 *    captured region — the node's box plus per-side padding — so content is
 *    sampled at the same point expressed in region uv instead.
 * 3. **Alpha.** The reference draws into a premultiplied canvas; this pipeline
 *    hands its result to a 2D canvas as straight alpha. The composite is
 *    computed premultiplied exactly as the reference does, then divided out at
 *    the very end, with alpha raised to carry any additive glow that would
 *    otherwise clip.
 *
 * Inputs:
 *   u_tex0        — captured node content, straight alpha, device px
 *   u_rectCenter  — the node's box centre inside that region, device px,
 *                   measured from the region's bottom-left with y growing up
 *   u_rectHalf    — half the box size, device px
 *
 * Everything is a function of `u_time` (the frame clock) with no accumulated
 * state, which is what makes the effect seekable.
 */
const SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform vec2 u_resolution;
uniform float u_time;

#ifdef SHAPE_SILHOUETTE
// Signed distance field of the capture's alpha, built on the CPU once per
// content version: R the near field, G the far field.
uniform sampler2D u_tex1;
#endif

uniform vec2 u_rectCenter;
uniform vec2 u_rectHalf;
uniform float u_radius;

uniform vec3 u_color;
uniform float u_intensity;
uniform float u_height;
uniform float u_spread;
uniform float u_speed;
uniform float u_scale;
uniform float u_turbulence;
uniform float u_turbulenceScale;
uniform float u_turbulenceReach;
uniform float u_sparks;
uniform float u_sparkSize;
uniform float u_sparkDensity;
uniform float u_sparkSpeed;
uniform float u_rim;
uniform float u_melt;
uniform float u_distortion;
uniform float u_smoke;
uniform float u_ember;
uniform float u_scorch;

#define S(a, b, t) smoothstep(a, b, t)

// --- noise ---------------------------------------------------------------

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

// 2D simplex noise, in -1..1.
float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(
    0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Four octaves, in 0..1. Each is rotated to break axis alignment.
float fbm(vec2 p) {
  mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
  float v = 0.5 * snoise(p);
  p = m * p * 2.03 + vec2(11.3, 7.1);
  v += 0.27 * snoise(p);
  p = m * p * 1.97 + vec2(3.7, 19.1);
  v += 0.15 * snoise(p);
  p = m * p * 2.01 + vec2(8.3, 2.9);
  v += 0.08 * snoise(p);
  return v * 0.5 + 0.5;
}

// Two octaves, for the cheaper envelope, warp and smoke fields.
float fbm2(vec2 p) {
  float v = 0.62 * snoise(p);
  v += 0.31 * snoise(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.13 + vec2(5.2, 1.3));
  return v * 0.54 + 0.5;
}

// Iterated sine displacement: what gives the flames their curling licks rather
// than a straight upward smear.
vec2 turbulence(vec2 p, float t) {
  float freq = 12.0 * clamp(u_scale, 0.05, 1.0) * clamp(u_turbulenceScale, 0.2, 3.0);
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  for (int i = 0; i < 7; i++) {
    float phase = freq * (p * rot).y + 6.0 * t + float(i);
    p += u_turbulence * rot[0] * sin(phase) / freq;
    rot *= mat2(0.6, -0.8, 0.8, 0.6);
    freq *= 1.2;
  }
  return p;
}

vec3 hash3(vec2 p) {
  vec3 q = vec3(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3)),
    dot(p, vec2(419.2, 371.9))
  );
  return fract(sin(q) * 43758.5453);
}

// --- silhouette ----------------------------------------------------------

// Signed distance to the rounded box the fire wraps: negative inside.
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

#ifdef SHAPE_SILHOUETTE
const float NEAR_RANGE = 16.0;
const float FAR_RANGE = 256.0;

// Signed distance to the node's own alpha edge: the near channel while it still
// has precision, the far one past its range.
float sdfAt(vec2 uv) {
  vec4 s = texture(u_tex1, uv);
  float near = (s.r - 0.5) * 2.0 * NEAR_RANGE;
  float far = (s.g - 0.5) * 2.0 * FAR_RANGE;
  return mix(near, far, step(NEAR_RANGE - 1.0, abs(near)));
}

// Outward normal of the silhouette in the shader's y-up frame, by central
// differences. This is what replaces the box's top edge: fire climbs where the
// surface faces up and only glows where it faces sideways, per glyph.
vec2 sdfNormal(vec2 uv) {
  vec2 e = 2.0 / max(u_resolution, vec2(1.0));
  float dx = sdfAt(uv + vec2(e.x, 0.0)) - sdfAt(uv - vec2(e.x, 0.0));
  float dy = sdfAt(uv + vec2(0.0, e.y)) - sdfAt(uv - vec2(0.0, e.y));
  // uv.y grows downward, so the y difference flips into the y-up frame. The
  // epsilon keeps normalize away from a zero vector on flat plateaus.
  return normalize(vec2(dx, -dy) + vec2(1e-6));
}
#endif

void main() {
  // The reference accumulates speed into its clock; here the clock is the frame
  // clock and speed scales it, which is the same thing and stays seekable.
  float t = u_time * u_speed;

  // Region px with y growing upward, matching the reference frame of reference:
  // v_uv is y-down so screen-top samples texture-top.
  vec2 frag = vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution;
  vec2 rel = frag - u_rectCenter;
  float unit = max(u_height, 24.0);
  float corner = min(u_radius, min(u_rectHalf.x, u_rectHalf.y));
  float spreadPx = max(u_spread, 8.0);
  float detail = clamp(u_scale, 0.05, 1.0);

  // The outline the fire wraps, and how far above its burning face this pixel
  // is. Both shapes feed the same flame maths from here on.
#ifdef SHAPE_SILHOUETTE
  float d0 = sdfAt(v_uv);
  float above = d0;
#else
  float d0 = sdRoundRect(rel, u_rectHalf, corner);
  float above = rel.y - u_rectHalf.y;
#endif

  float px = rel.x / unit;
  float py = rel.y / unit;

  // Tongues: a slow envelope along the top edge, sheared sideways as it rises,
  // so flames gather into licks instead of an even band.
  float yA = max(above, 0.0) / unit;
  float sway = snoise(vec2(px * 1.1, t * 0.5)) * 0.55
    + snoise(vec2(px * 2.4, t * 0.9 + 41.0)) * 0.25;
  float sx = px + yA * sway;
  float env = fbm2(vec2(sx * 1.6 * detail + 3.7, t * 0.55 - yA * 0.4));
  float env2 = fbm2(vec2(sx * 3.6 * detail, t * 0.85 + 17.0 - yA * 0.6));
  float tongue = clamp(
    0.75 * S(0.3, 0.9, env) + 0.5 * S(0.4, 0.95, env2),
    0.0,
    1.0
  );

  // The burning front: how far the fire has eaten into the outline. Along the
  // top it bites per tongue, around the sides and bottom it bites evenly.
  float meltPx = max(u_melt, 1.0);
  float biteTop = (3.0 + meltPx * 1.4) * (0.35 + 0.65 * tongue)
    + 2.0 * snoise(vec2(px * 5.0 * detail, t * 1.1 + 5.0));
  float frontTop = above + biteTop;

  float perim = fbm2(rel * (1.9 / unit) * detail + vec2(0.0, t * 0.4) + 31.0);
  float biteSB = 3.0 + meltPx * (0.25 + 0.75 * perim);
  float frontSB = d0 + biteSB;

  // wTop blends the two: 1 over an upward-facing edge, 0 elsewhere. It is what
  // makes the fire climb off the top but only glow at the sides. The box reads
  // it off its own geometry; a silhouette reads it off the outward normal, so
  // every glyph gets its own top.
#ifdef SHAPE_SILHOUETTE
  float up = clamp(sdfNormal(v_uv).y, 0.0, 1.0);
  float wTop = S(-0.62 * unit, -0.1 * unit, above) * S(0.2, 0.8, up * up);
#else
  float wTop = S(-0.62 * unit, -0.1 * unit, above)
    * S(10.0, -30.0, abs(rel.x) - (u_rectHalf.x - corner));
#endif
  float front = mix(frontSB, frontTop, wTop);

  float reach = mix(
    spreadPx * 0.9,
    unit * (0.2 + 0.45 * tongue),
    wTop
  );
  float q = front / reach;

  // --- flame body --------------------------------------------------------
  vec2 np = vec2(px * 2.3, py * 1.25 - t * 1.85) * detail;
  np = turbulence(np, t);
  float n = fbm(np);

  float win = S(-0.08, 0.02, q);
  float root = exp(-abs(q) * 5.0);
  float ridge = 1.0 - abs(2.0 * n - 1.0);
  float flameH = mix(1.0, 0.5 + 0.6 * tongue, wTop);
  float g = max(q, 0.0) / flameH;
  float shred = fbm2(np * 1.9 + 63.0);
  g *= 1.0 + 0.7 * (shred - 0.5) * S(0.2, 0.8, g);
  float dens = n * 0.95 + ridge * 0.45 - 0.18
    + (1.0 - min(g, 1.0)) * 0.3
    - g * (0.9 + 0.25 * n);
  dens = clamp(dens * 2.4, 0.0, 1.0) * win;
  dens *= mix(1.0 - S(0.32, 1.05, q), 1.0 - S(0.9, 1.2, g), wTop);
  float body = dens * dens * (3.0 - 2.0 * dens);
  float emis = clamp(u_intensity, 0.0, 2.0);
  float e = body * (0.55 + 0.75 * root) * (0.45 + 0.55 * n)
    + win * root * (0.1 + 0.4 * n);
  e *= mix(0.45, 1.0, wTop) * max(emis, 0.001);

  vec3 hot = mix(u_color, vec3(1.0), 0.35);
  vec3 deep = mix(u_color, u_color * u_color, 0.5) * 0.9;
  float ramp = 1.0 - exp(-e * 2.4);
  vec3 fireCol = mix(deep, u_color, S(0.0, 0.55, ramp));
  float core = ramp * (0.45 + 0.55 * exp(-g * 2.2)) * (0.5 + 0.5 * n);
  fireCol = mix(fireCol, hot, S(0.7, 1.05, core));
  fireCol *= 0.8 + 0.4 * ramp;
  float fireA = clamp(1.0 - exp(-e * 3.4), 0.0, 1.0);

  // --- halo --------------------------------------------------------------
  float halo = exp(-max(front, 0.0) / (spreadPx * 1.2)) * S(0.0, 3.0, front)
    * (0.5 + 0.5 * n) * 0.3 * clamp(u_rim, 0.0, 2.0) * mix(1.0, 0.45, wTop);
  vec3 glow = u_color * halo * clamp(u_intensity, 0.0, 2.0);

  // --- sparks ------------------------------------------------------------
  // Two layers of cell-hashed points whose lives are closed-form in time, so
  // any frame is reachable cold.
  if (u_sparks > 0.001) {
    float sSpeed = max(u_sparkSpeed, 0.05);
    float sCells = 5.0 * clamp(u_sparkDensity, 0.3, 2.5);
    float sSize = clamp(u_sparkSize, 0.2, 3.0);
    float gate = S(-0.05, 0.1, q) * (1.0 - S(1.3, 2.2, q)) * wTop;
    float spark = 0.0;
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float speed = 1.5 * sSpeed * (0.75 + 0.5 * fl);
      vec2 ps = vec2(px, py - t * speed);
      ps.x += 0.08 * snoise(vec2(py * 0.9 + fl * 5.0, t * 0.5));
      float cells = sCells * (1.0 + 0.6 * fl);
      vec2 cl = floor(ps * cells) + fl * 19.0;
      vec2 fr = fract(ps * cells);
      vec3 rnd = hash3(cl);
      vec3 rnd2 = hash3(cl + 7.3);
      float on = step(rnd2.x, 0.42);
      float life = fract(rnd.z + t * sSpeed * (0.3 + 0.5 * rnd2.x));
      vec2 ppos = vec2(0.5) + 0.56 * (rnd.xy - 0.5);
      ppos.x += 0.14 * sin(t * (0.7 + rnd.z * 2.8) + rnd.y * 6.2832)
        + 0.1 * snoise(vec2(t * 0.6 + rnd.x * 9.0, cl.y * 0.7))
        + (life - 0.5) * 0.5 * (rnd2.y - 0.5);
      ppos.y += (life - 0.5) * 0.3 * rnd2.y;
      float tw = S(0.02, 0.2, life) * S(1.0, 0.55, life);
      tw *= 0.75 + 0.25 * sin(t * (6.0 + rnd2.z * 9.0) + rnd.x * 6.2832);
      vec2 pd = (fr - ppos) / cells * unit;
      pd.y *= 0.55 + 0.3 * rnd2.z;
      float dp = length(pd);
      float r = (0.004 + 0.014 * rnd.y * rnd.y) * unit * sSize
        * mix(1.15, 0.55, life);
      float bmask = S(0.5, 0.32, max(abs(fr.x - 0.5), abs(fr.y - 0.5)));
      float sbody = exp(-dp * dp / (r * r));
      float sbloom = exp(-dp * dp / (r * r * 6.0)) * 0.3;
      spark += (sbody + sbloom) * tw * tw * on * bmask * (1.0 - 0.35 * fl);
    }
    spark *= gate * u_sparks;
    fireCol += mix(u_color, vec3(1.0), 0.55) * spark * 1.6;
    fireA = clamp(fireA + spark * 0.85, 0.0, 1.0);
  }

  // Everything the effect adds is windowed to zero at the capture boundary. The
  // region is finite, so a term that has not decayed by the last texel would be
  // sliced off and the padded box would become a visible rectangle.
  vec2 edgePx = min(frag, u_resolution - frag);
  float fadeW = max(24.0, spreadPx * 0.75);
  float fade = S(0.0, fadeW, edgePx.x) * S(0.0, fadeW, edgePx.y);
  fireA *= fade;
  glow *= fade;
  halo *= fade;

  // --- smoke -------------------------------------------------------------
  float wisp = S(0.45, 0.9, fbm2(np * 0.55 + vec2(0.0, 17.0)));
  float smoke = S(1.55, 1.05, g) * S(0.85, 1.15, g)
    * (1.0 - body) * wTop
    * wisp * 0.055 * clamp(u_smoke, 0.0, 2.0) * fade;
  vec3 smokeCol = mix(vec3(0.5), u_color, 0.5);

  // --- content -----------------------------------------------------------
  // Heat shimmer, confined to a band around the burning edge so the middle of a
  // card stays legible.
  float heatBand = exp(-abs(front) / max(u_turbulenceReach, 4.0));
  vec2 wob = vec2(
    snoise(np * 1.7 + 9.0),
    snoise(np * 1.7 + 27.0)
  );
  vec2 disp = wob * min(u_distortion, 32.0) * heatBand;

#ifdef SHAPE_SILHOUETTE
  // The node's own alpha already masks it, so there is no box to stay inside.
  float inRect = 1.0;
  vec2 sUv = clamp(
    v_uv + vec2(disp.x, -disp.y) / max(u_resolution, vec2(1.0)),
    vec2(0.0),
    vec2(1.0)
  );
  vec4 content = texture(u_tex0, sUv);
#else
  vec2 cUv = (rel + u_rectHalf) / (2.0 * u_rectHalf);
  float inRect = step(abs(cUv.x - 0.5), 0.5) * step(abs(cUv.y - 0.5), 0.5);
  // Same sample point as the reference, addressed in the captured region rather
  // than a rect-sized texture. Held just inside the box so the shimmer cannot
  // drag transparent padding into the content.
  vec2 relD = clamp(rel + disp, -u_rectHalf * 0.996, u_rectHalf * 0.996);
  vec2 sUv = (relD + u_rectCenter) / max(u_resolution, vec2(1.0));
  vec4 content = texture(u_tex0, vec2(sUv.x, 1.0 - sUv.y));
#endif

  float burn = clamp(u_intensity, 0.0, 1.0);
  float depth = max(-front, 0.0);

  // Char: a patchy dark band on the surviving content, inside the burn line.
  float charPatch = 0.5 + 0.5 * fbm2(rel * (2.6 / unit) * detail + 57.0);
  float charW = mix(4.0, 6.0 + meltPx * 1.6, wTop) * charPatch;
  float charT = (1.0 - S(charW, charW * 2.4, depth));
  content.rgb = mix(
    content.rgb,
    content.rgb * vec3(0.22, 0.19, 0.17),
    clamp(charT * 0.85 * burn * clamp(u_scorch, 0.0, 2.0), 0.0, 1.0)
  );

  // Ember: the glowing line right at the burnt edge, with a whiter core.
  float emberW = mix(2.5, 5.5, wTop);
  float emberN = 0.3 + 0.7 * fbm2(np * 2.2 + 73.0);
  float emberK = clamp(u_ember, 0.0, 2.0);
  float ember = exp(-depth / emberW) * emberN * emberK;
  float whiteHot = exp(-depth / (emberW * 0.4)) * emberN * emberN * emberK;
  content.rgb = mix(content.rgb, u_color * 1.2, clamp(ember, 0.0, 1.0) * burn);
  content.rgb = mix(
    content.rgb,
    mix(u_color, vec3(1.0), 0.3) * 1.2,
    clamp(whiteHot, 0.0, 1.0) * burn
  );

  // Dissolve: the content is gone past the burning front, unevenly.
  float dn = fbm2(rel * (3.2 / unit) * detail + vec2(0.0, t * 0.5) + 91.0);
  float dw = mix(2.0, 5.0, wTop);
  float dissolve = S(-dw, dw, front + (dn - 0.5) * dw * 2.5);
  float cA = content.a * (1.0 - dissolve) * inRect;
  float smk = smoke * (1.0 - cA);
  float baseA = min(cA + smk, 1.0);
  vec3 base = content.rgb * cA + smokeCol * smk;

  // --- composite ---------------------------------------------------------
  // Premultiplied, exactly as the reference composites it.
  vec3 col = fireCol * fireA + base * (1.0 - fireA) + glow;
  float alpha = clamp(fireA + baseA * (1.0 - fireA) + halo * 0.5, 0.0, 1.0);

  // Back to straight alpha for a 2D canvas. The additive glow can carry more
  // colour than its own alpha would allow, so alpha rises to hold it rather
  // than letting the divide clip the halo to half brightness.
  float peak = min(max(max(col.r, col.g), col.b), 1.0);
  float outA = clamp(max(alpha, peak), 0.0, 1.0);
  fragColor = vec4(col / max(outA, 0.0001), outA);
}
`;

/**
 * The default shape: fire wraps the node's rounded box (`radius`), which is what
 * the reference does and what a card wants.
 */
export const FLAME_WRAP_FRAG = SOURCE;

/**
 * The silhouette variant: the same fire, but the outline comes from a distance
 * field of the node's own alpha instead of an analytic box, so a burning Text
 * burns letter by letter. Costs one more texture and a field rebuild whenever
 * the node's pixels change.
 */
export const FLAME_WRAP_SILHOUETTE_FRAG = SOURCE.replace(
  "#version 300 es\n",
  "#version 300 es\n#define SHAPE_SILHOUETTE 1\n",
);
