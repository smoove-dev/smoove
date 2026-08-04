/**
 * droplets' fragment shader.
 *
 * A port of the reference WebGL2 rain-on-glass effect, with the same drop
 * maths: the same cell-hashed layers of running drops, the same egg-shaped
 * head with its trailing tail, the same static drizzle, and the same
 * refraction of whatever sits behind the glass.
 *
 * Four things had to change:
 *
 * 1. **Dialect.** Authored in `#version 300 es` but restricted to the subset
 *    `transpileTo100` can mechanically downgrade, because the server path
 *    (headless-gl) is WebGL1 only. See `dialect.test.ts` for the static guard
 *    and `@smoove/renderer`'s effects test for the real compile.
 * 2. **Blur.** The reference fogs the glass with `textureLod` over a mipmapped
 *    content texture. Neither the mip chain nor `textureLod` exists here, so
 *    the fog is a 13-tap golden-angle disc in premultiplied space, whose
 *    radius is a real length in device px rather than a LOD.
 * 3. **Atlas.** The reference's canvas *is* the content. Here `u_tex0` is the
 *    captured region, whose size is snapped up to a 32px bucket, so the glass
 *    is placed by `u_contentOrigin`/`u_contentSize` and everything outside the
 *    node's own box is left transparent.
 * 4. **Interaction.** The reference wipes drops away under the pointer, which
 *    it implements as a trail texture accumulated frame over frame. That is
 *    exactly the state rule 1 forbids — a seek to frame 900 could not
 *    reproduce it — so it is gone, along with the pointer it needed.
 *
 * Inputs:
 *   u_tex0          — captured node content, straight alpha, device px
 *   u_contentOrigin — the node's box origin inside that region, device px from
 *                     the region's top-left, y growing down
 *   u_contentSize   — the box size, device px
 *   u_sizeRef       — drop-size reference from the box's CSS-px size, so a 2x
 *                     render and a 1x preview get drops of the same size
 *
 * Everything is a function of `u_time` (the frame clock) with no accumulated
 * state, which is what makes the effect seekable.
 */
export const DROPLETS_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform vec2 u_resolution;
uniform float u_time;

uniform vec2 u_contentOrigin;
uniform vec2 u_contentSize;
uniform float u_sizeRef;

uniform vec3 u_tint;
uniform float u_tintStrength;
uniform float u_intensity;
uniform float u_speed;
uniform float u_scale;
uniform float u_dropWidth;
uniform float u_dropLength;
uniform float u_refraction;
uniform float u_blur;
uniform float u_vignette;
uniform float u_fallSpeed;
uniform float u_wiggle;
uniform float u_staticDrops;
uniform float u_sheen;

#define S(a, b, t) smoothstep(a, b, t)

// --- hashes --------------------------------------------------------------
// Float hashes, not integer ones: WebGL1 has neither unsigned types nor bit
// operations.

vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3(
    (p3.x + p3.y) * p3.z,
    (p3.x + p3.z) * p3.y,
    (p3.y + p3.z) * p3.x
  ));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

// Rises over 0..b, falls over b..1. The life curve of one running drop.
float Saw(float b, float t) {
  return S(0.0, b, t) * S(1.0, b, t);
}

// Distance to an egg: a round head with a drawn-out tail, which is the shape a
// drop takes as it lets go and slides.
float sdEgg(vec2 p, float ra, float rb) {
  const float k = 1.7320508;
  p.x = abs(p.x);
  float r = ra - rb;
  return ((p.y < 0.0) ? length(vec2(p.x, p.y)) - r :
          (k * (p.x + r) < p.y) ? length(vec2(p.x, p.y - k * r)) :
          length(vec2(p.x + r, p.y)) - 2.0 * r) - rb;
}

// --- drops ---------------------------------------------------------------

// One layer of running drops: a head sliding down its column, the wet trail it
// leaves, and the beads that trail breaks into. Returns (drops, trail).
//
// Every term is a closed-form function of t. Nothing is integrated, so any
// frame is reachable cold.
vec2 DropLayer(vec2 uv, float t) {
  vec2 UV = uv;
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;

  vec2 id = floor(uv * grid);
  float gridFall = N(id.x) / 3.0 + 0.5;
  uv.y += t * gridFall / a.y;
  id = floor(uv * grid);
  uv.y += N(id.x);

  id = floor(uv * grid);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);

  float x = n.x - 0.5;
  float lambda = UV.y * 20.0;
  float wiggle = sin(lambda + sin(lambda));
  x += wiggle * (0.5 - abs(x)) * (n.z - 0.5) * u_wiggle;
  x *= 0.6;

  float slowStart = 0.85;
  float ti = fract(t * (gridFall + 0.1) + n.z);
  float y = (Saw(slowStart, ti) - 0.5) * 0.9 + 0.5;
  vec2 p = vec2(x, y);

  float dropShape = (ti > slowStart)
    ? -sin(6.2831853 * ti / (1.0 - slowStart)) * 0.5 - 0.5
    : 0.0;
  float d = sdEgg((st - p) * a.yx / vec2(u_dropWidth, u_dropLength), 0.0, dropShape);
  float diameter = N(id.x + id.y) / 7.0 + 0.2;
  float mainDrop = S(diameter / 1.5, 0.0, d);

  float r2 = S(1.0, y, st.y);
  float r = sqrt(r2);
  float cd = abs(st.x - x);
  float thickness = diameter * 0.95 * u_dropWidth;
  float trail = S(thickness * r, 0.0, cd);
  float trailFront = S(-0.02, 0.02, st.y - y);
  trail *= r2 * trailFront * 0.5;

  y = UV.y;
  float trail2 = S((thickness - 0.15) * r, 0.0, cd);
  trail2 *= trailFront * n.z;
  float rndX = N(id.x) / 1.5 + 0.5;
  float rndY = N(st.y) / 40.0 + 0.05;
  y = fract(y * 11.0 * rndX) + (st.y - 0.5);
  float dd = length(st - vec2(x, y));
  float droplets = S(trail2 + rndY, 0.0, dd);

  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

// The fine drizzle that never runs: one bead per cell, fading in and out on its
// own hashed phase.
float StaticDrops(vec2 uv, float t) {
  uv *= 40.0;

  vec2 id = floor(uv);
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - 0.5) * 0.6;
  uv = fract(uv) - 0.5;

  float d = length(uv - p);
  float drop = S(0.3 * clamp(u_dropWidth, 0.4, 1.4), 0.0, d);

  float fade = Saw(0.1, fract(t + n.y));
  float weight = fract(n.x * 27.0);
  return drop * fade * weight;
}

// Drizzle plus two running layers at different scales. Returns (drops, trail).
vec2 Drops(vec2 uv, float t, float tFall, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer(uv, tFall) * l1;
  vec2 m2 = DropLayer(uv * 1.85, tFall) * l2;

  float c = s + m1.x + m2.x;
  c = S(0.3, 1.0, c);

  return vec2(c, m1.y + m2.y);
}

// --- content -------------------------------------------------------------

// Sample the node behind the glass at a point in its own box, optionally
// defocused. Taps are a golden-angle disc, weighted premultiplied so a blur
// crossing the content's alpha edge does not drag its colour outward, and held
// inside the box so the bucket margin around it stays out of the average.
vec4 sampleContent(vec2 local, float radiusPx) {
  vec2 res = max(u_resolution, vec2(1.0));
  // Half a texel inside the box on every side. Sampling the boundary itself
  // would have LINEAR blend the last content texel with the first transparent
  // one, which reads as a translucent hairline around the whole node and as a
  // dark bite wherever a drop refracts across the edge.
  vec2 halfTexel = vec2(0.5) / res;
  vec2 lo = u_contentOrigin / res + halfTexel;
  vec2 hi = (u_contentOrigin + u_contentSize) / res - halfTexel;
  vec2 uv = clamp((u_contentOrigin + clamp(local, vec2(0.0), vec2(1.0)) * u_contentSize) / res, lo, hi);

  vec4 c0 = texture(u_tex0, uv);
  if (radiusPx < 0.5) return c0;

  vec2 texelStep = vec2(radiusPx) / res;
  vec4 acc = vec4(c0.rgb * c0.a, c0.a);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ang = fi * 2.39996323;
    float rad = sqrt((fi + 0.5) / 12.0);
    vec2 tap = clamp(uv + vec2(cos(ang), sin(ang)) * rad * texelStep, lo, hi);
    vec4 s = texture(u_tex0, tap);
    acc += vec4(s.rgb * s.a, s.a);
  }
  return vec4(acc.rgb / max(acc.a, 0.0001), acc.a / 13.0);
}

void main() {
  // The captured region is the node's box snapped up to a 32px bucket, so the
  // glass is the box and anything past it is left alone.
  vec2 frag = v_uv * u_resolution;
  vec2 local = (frag - u_contentOrigin) / max(u_contentSize, vec2(1.0));
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) {
    fragColor = vec4(0.0);
    return;
  }

  // Drop maths works in a y-up, aspect-corrected space so drops stay round and
  // fall downward.
  vec2 uv = vec2(local.x, 1.0 - local.y);
  float aspect = u_contentSize.x / max(u_contentSize.y, 1.0);
  float t = u_time * u_speed * 0.2;
  float dropScale = max(u_sizeRef * u_scale, 0.01);
  vec2 duv = (uv - 0.5) * vec2(aspect, 1.0) * dropScale;

  float rain = clamp(u_intensity, 0.0, 1.25);
  float drizzle = S(-0.5, 1.0, rain) * 2.0 * u_staticDrops;
  float layer1 = S(0.25, 0.75, rain);
  float layer2 = S(0.0, 0.5, rain);
  float tFall = t * u_fallSpeed;

  vec2 c = Drops(duv, t, tFall, drizzle, layer1, layer2);

  // The surface normal of the water, as the gradient of its coverage.
  vec2 e = vec2(0.001, 0.0);
  float cx = Drops(duv + e, t, tFall, drizzle, layer1, layer2).x;
  float cy = Drops(duv + e.yx, t, tFall, drizzle, layer1, layer2).x;
  vec2 normal = vec2(cx - c.x, cy - c.x);

  // Refract in the aspect-corrected space, then back into the box, so the
  // displacement is the same length horizontally and vertically.
  vec2 refracted = uv + normal * u_refraction / vec2(max(aspect, 0.001), 1.0);
  vec2 rLocal = vec2(refracted.x, 1.0 - refracted.y);

  // Fogged glass: the water is in focus, the glass around it is not, and a wet
  // trail has wiped part of the fog away.
  float fog = u_blur * mix(0.7, 1.0, rain);
  float back = fog * (1.0 - clamp(c.y * 2.0, 0.0, 1.0));
  float radius = mix(back, 0.0, S(0.1, 0.2, c.x));

  vec4 content = sampleContent(rLocal, radius);
  float tint = clamp(u_tintStrength, 0.0, 1.0);
  vec3 col = mix(content.rgb, u_tint, tint * 0.35);

  // Sheen: refraction alone is invisible over flat colour, so the water also
  // catches a light. This is what keeps drops readable on a solid card.
  if (u_sheen > 0.001) {
    float mask = S(0.02, 0.14, c.x);
    vec3 n3 = normalize(vec3(normal * 42.0, 1.0));
    vec3 lightDir = normalize(vec3(-0.35, 0.75, 0.55));
    float spec = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n3), lightDir), 0.0), 34.0);
    float rim = clamp(length(normal) * 26.0, 0.0, 1.0) * mask;
    col += mix(vec3(1.0), u_tint, tint) * (spec * 0.9 + rim * 0.12) * u_sheen;
  }

  vec2 vg = local - 0.5;
  col *= 1.0 - dot(vg, vg) * clamp(u_vignette, 0.0, 1.0) * 2.0;

  // Straight alpha, gated on the node's own: the glass is the node, so it never
  // paints outside what the node already covered.
  fragColor = vec4(clamp(col, 0.0, 1.0), content.a);
}
`;
