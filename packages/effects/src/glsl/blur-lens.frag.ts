/**
 * blur's optical-defocus fragment shader.
 *
 * A Gaussian kernel falls off, so a bright specular gets dimmer as it spreads
 * and the picture reads as frosted glass. A real lens defocuses through a flat
 * aperture disc, so a specular keeps its brightness and only grows — that is
 * the bokeh ball, and it is the whole reason this pass exists next to a
 * one-line CSS blur.
 *
 * Two things get it there:
 *
 * 1. **A disc, not a bell.** 96 taps on a golden-angle spiral,
 *    `r = sqrt((i + 0.5) / 96)`, which distributes them evenly by area rather
 *    than by radius. The count is a compile-time constant because GLSL ES 1.00
 *    only allows constant loop bounds, and headless-gl on the server is
 *    WebGL1.
 * 2. **A highlight knee.** Bright taps are weighted up before the average, so
 *    a small specular dominates the disc it spreads into and stays bright
 *    instead of averaging away. `u_bloom` at 0 makes every weight 1 and gives
 *    a flat disc, which is a plain defocus rather than a broken one.
 *
 * Alpha is deliberately *not* bloom-weighted. Colour is the weighted average
 * `sum(rgb*a*w) / sum(a*w)`; alpha is the plain disc average `sum(a) / 96`.
 * Weighting alpha too would fatten bright glyphs and make a highlight more
 * opaque than its own coverage. It also means this pass needs no alpha raise
 * before the straight-alpha divide the way flameWrap does: a weighted average
 * is bounded by its largest input, so a blur can never produce a channel above
 * what it read, and the divide has nothing to clip.
 *
 * Inputs:
 *   u_tex0          - captured node content, straight alpha, device px
 *   u_resolution    - the captured region, device px
 *   u_contentOrigin - the node's box origin inside that region, device px from
 *                     the region's top-left, y growing down. Only the dither is
 *                     keyed to it; the blur itself runs over the whole region,
 *                     because spreading into the padding is the point
 *   u_radius        - the disc radius, device px
 *   u_bloom         - highlight knee, 0 to 1
 *   u_blades        - aperture sides; under 3 is a round aperture
 *   u_bladeAngle    - aperture orientation, radians
 *
 * Nothing here reads a clock. A blur is a pure function of the pixels, so it
 * is seekable by construction.
 */
export const BLUR_LENS_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform vec2 u_resolution;

uniform vec2 u_contentOrigin;

uniform float u_radius;
uniform float u_bloom;
uniform float u_blades;
uniform float u_bladeAngle;

const float GOLDEN = 2.39996323;
const float TAU = 6.28318531;
/**
 * Tap count, as a float for the maths. The loop below repeats it as a literal
 * because GLSL ES 1.00 only accepts a constant bound there, and headless-gl on
 * the server is WebGL1.
 */
const float TAPS = 96.0;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * How far the aperture reaches at one angle, as a fraction of u_radius.
 *
 * A round aperture is 1 everywhere. A polygon inscribed in that circle runs
 * from cos(PI/n) at an edge midpoint to 1 at a vertex, which is what gives a
 * six-blade lens its hexagonal bokeh.
 *
 * The angle is folded into one sector by subtracting whole sectors. The
 * built-in that would do this in one call, and the modulo operator, are both
 * outside the GLSL ES 1.00 subset the server compiles against.
 */
float apertureScale(float theta) {
  if (u_blades < 3.0) return 1.0;
  float n = floor(u_blades + 0.5);
  float sector = TAU / n;
  float half_ = sector * 0.5;
  float a = theta + u_bladeAngle;
  a = a - sector * floor(a / sector);
  return cos(half_) / max(cos(a - half_), 0.0001);
}

void main() {
  vec2 res = max(u_resolution, vec2(1.0));
  vec4 centre = texture(u_tex0, v_uv);

  // Sub-half-pixel radii cannot move anything, and the disc would collapse
  // onto the centre tap.
  if (u_radius < 0.5) {
    fragColor = centre;
    return;
  }

  // A fixed tap set leaves a spoke pattern on a hard highlight, because every
  // pixel samples the same directions. A per-pixel angular offset fills the
  // gaps between them and trades the spokes for grain — and being a function of
  // position alone, that grain is static rather than shimmering.
  //
  // The offset spans exactly one gap and no more. A full turn would decorrelate
  // the pixels just as well, but it would also randomize which way the aperture
  // polygon points, and a hexagon pointing a different way at every pixel
  // averages straight back into a circle. That is the difference between the
  // blade count doing something and doing nothing.
  //
  // The hash is anchored to the node's own box, not to the fragment position.
  // The captured region's origin is floored to whole device px, so a hash of
  // the raw coordinate would swim across the picture as the node moves; keyed
  // to the box, the grain stays pinned to what it is blurring.
  vec2 local = v_uv * res - u_contentOrigin;
  float jitter = hash21(floor(local)) * (TAU / TAPS);

  vec3 acc = vec3(0.0);
  float accWeight = 0.0;
  float accAlpha = 0.0;

  for (int i = 0; i < 96; i++) {
    float fi = float(i) + 0.5;
    float theta = fi * GOLDEN + jitter;
    // sqrt spreads the taps evenly over the disc's area. Linear spacing would
    // crowd them at the centre and leave the rim undersampled.
    float r = sqrt(fi / TAPS) * apertureScale(theta);

    // Snapped to a texel centre, which is what makes the premultiply below
    // correct. The capture is straight alpha with transparent texels zeroed,
    // so a LINEAR read landing between an opaque texel and a transparent one
    // returns half the colour at half the alpha — grey, not the white that was
    // actually there. Reading texel centres returns authentic samples instead,
    // and 96 dithered taps hide the quantization.
    vec2 tapPx = v_uv * res + vec2(cos(theta), sin(theta)) * r * u_radius;
    vec4 s = texture(u_tex0, (floor(tapPx) + 0.5) / res);

    float luma = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    float w = 1.0 + u_bloom * 8.0 * pow(luma, 4.0);

    // Premultiplied, so a tap straddling the content's alpha edge does not
    // drag its colour out into the transparency beside it.
    acc += s.rgb * s.a * w;
    accWeight += s.a * w;
    accAlpha += s.a;
  }

  // Straight alpha out: the server reads the framebuffer into an ImageData,
  // whose channels are not premultiplied, and the browser compositor is
  // created to match.
  vec3 rgb = accWeight > 0.0 ? acc / accWeight : vec3(0.0);
  fragColor = vec4(rgb, accAlpha / TAPS);
}
`;
