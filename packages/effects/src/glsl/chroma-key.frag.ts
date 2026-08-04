/**
 * chromaKey's fragment shader.
 *
 * A single pass over the captured node that turns one colour into
 * transparency. The matte is a distance in chroma, not in RGB: the pixel and
 * the key colour are both projected onto the YUV chroma plane and compared
 * there, so brightness drops out and a shadow falling across the screen keys
 * the same as the lit part of it.
 *
 * That distance is then divided by the key colour's own distance from grey,
 * which the usual keying shaders do not do, and which is what lets one setting
 * work on two clips. Unnormalized, `similarity` is a length in a space where a
 * screen lit for camera sits about 0.2 from neutral, so the value that keys a
 * saturated screen erases every grey and white in a dull one — a lit subject
 * loses their white shirt. Divided through, 0 is the key colour and 1 is
 * neutral grey whatever the screen looked like, and `similarity` reads as how
 * far toward grey the key reaches.
 *
 * Three things the matte alone does not do, and this adds:
 *
 * 1. **Despill.** A green screen bounces green onto everything in front of it,
 *    and the fringe survives the key because it is not green enough to be cut.
 *    The key colour's chroma direction is subtracted out of whatever leans that
 *    way. The direction has zero luma by construction, so the subtraction
 *    removes the cast without darkening the pixel, and a colour leaning the
 *    other way (skin, a pink shirt) is left alone.
 * 2. **Choke.** Compression and soft focus leave a half-keyed rim a pixel or
 *    two wide. Positive `choke` erodes the matte, negative dilates it, as the
 *    min or max over a fixed golden-angle disc of taps.
 * 3. **Strength.** The whole key crossfades against the untouched pixel, so
 *    animating it dissolves the background away rather than cutting it.
 *
 * Inputs:
 *   u_tex0          - captured node content, straight alpha, device px
 *   u_contentOrigin - the node's box origin inside that region, device px from
 *                     the region's top-left, y growing down
 *   u_contentSize   - the box size, device px
 *   u_key           - the colour to remove, 0..1, as it appears on screen
 *
 * Nothing here reads a clock: the key is a pure function of the pixels, so it
 * is trivially seekable.
 */
export const CHROMA_KEY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform vec2 u_resolution;

uniform vec2 u_contentOrigin;
uniform vec2 u_contentSize;

uniform vec3 u_key;
uniform float u_strength;
uniform float u_similarity;
uniform float u_smoothness;
uniform float u_spill;
uniform float u_choke;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// The chroma half of YUV. Two numbers that say what colour a pixel is while
// saying nothing about how bright it is.
vec2 chromaOf(vec3 c) {
  return vec2(
    dot(c, vec3(-0.169, -0.331, 0.5)),
    dot(c, vec3(0.5, -0.419, -0.081))
  );
}

// How far a pixel is from the key colour, in units of the key's own distance
// from grey: 0 is the key colour, 1 is neutral, above 1 is a colour leaning the
// other way. A key with no colour in it at all — white, grey, black — has no
// direction to measure against, so that case falls back to plain RGB distance,
// where 1 is roughly half the cube away.
float keyDistance(vec3 rgb, vec2 keyChroma, float keyChromaLen) {
  if (keyChromaLen < 0.02) return distance(rgb, u_key) * 2.0;
  return distance(chromaOf(rgb), keyChroma) / keyChromaLen;
}

// 0 where the pixel is the key colour, 1 where it is far enough away to keep,
// with smoothness widening the ramp between them.
float matte(vec3 rgb, vec2 keyChroma, float keyChromaLen) {
  float d = keyDistance(rgb, keyChroma, keyChromaLen);
  return smoothstep(u_similarity, u_similarity + max(u_smoothness, 0.001), d);
}

float matteAt(vec2 uv, vec2 keyChroma, float keyChromaLen) {
  vec4 c = texture(u_tex0, uv);
  return c.a * matte(c.rgb, keyChroma, keyChromaLen);
}

void main() {
  // The captured region is the node's box snapped up to a 32px bucket, so the
  // key runs on the box and everything past it is left transparent.
  vec2 frag = v_uv * u_resolution;
  vec2 local = (frag - u_contentOrigin) / max(u_contentSize, vec2(1.0));
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) {
    fragColor = vec4(0.0);
    return;
  }

  // Half a texel inside the box on every side. Sampling the boundary itself
  // would have LINEAR blend the last content texel with the first transparent
  // one, which keys a translucent hairline all the way around the node.
  vec2 res = max(u_resolution, vec2(1.0));
  vec2 halfTexel = vec2(0.5) / res;
  vec2 lo = u_contentOrigin / res + halfTexel;
  vec2 hi = (u_contentOrigin + u_contentSize) / res - halfTexel;
  vec2 uv = clamp(frag / res, lo, hi);

  vec2 keyChroma = chromaOf(u_key);
  float keyChromaLen = length(keyChroma);
  vec4 src = texture(u_tex0, uv);
  float keyed = src.a * matte(src.rgb, keyChroma, keyChromaLen);

  // Choke: shrink the matte to eat a half-keyed fringe, or grow it back when
  // the key has bitten into the subject. Taps are a golden-angle disc, so a
  // shrink is a real erosion rather than a ring that leaves the middle behind.
  float radius = abs(u_choke);
  if (radius >= 0.5) {
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float ang = fi * 2.39996323;
      float rad = sqrt((fi + 0.5) / 8.0);
      vec2 tap = clamp(uv + vec2(cos(ang), sin(ang)) * rad * radius / res, lo, hi);
      float a = matteAt(tap, keyChroma, keyChromaLen);
      keyed = u_choke > 0.0 ? min(keyed, a) : max(keyed, a);
    }
  }

  // Despill. The key colour's chroma direction carries no luma, so taking it
  // out of a pixel that leans that way removes the cast at the same brightness.
  // Only the positive projection is removed: a colour leaning the other way is
  // the opposite of spill and must survive untouched.
  vec3 col = src.rgb;
  vec3 spillCast = u_key - vec3(dot(u_key, LUMA));
  float castLen = length(spillCast);
  if (u_spill > 0.0 && castLen > 0.001) {
    vec3 dir = spillCast / castLen;
    float along = dot(col - vec3(dot(col, LUMA)), dir);
    col -= dir * max(along, 0.0) * u_spill;
  }

  // Straight alpha, and the whole key crossfaded against the untouched pixel so
  // strength can be animated from 0 for a background that dissolves away.
  float amount = clamp(u_strength, 0.0, 1.0);
  fragColor = vec4(clamp(mix(src.rgb, col, amount), 0.0, 1.0), mix(src.a, keyed, amount));
}
`;
