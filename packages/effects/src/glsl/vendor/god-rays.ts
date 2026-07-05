// Derived from paper-design/shaders packages/shaders/src/shaders/god-rays.ts (Apache-2.0). See NOTICE.
// Adaptations: sizing system removed (v_uv centered), helper chunks inlined,
// noise texture replaced with procedural hash, dynamic break rewritten to an
// `if` guard for GLSL ES 1.00.
export const godRaysFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colorBloom;
uniform vec4 u_colors[5];
uniform float u_colorsCount;

uniform float u_density;
uniform float u_spotty;
uniform float u_midSize;
uniform float u_midIntensity;
uniform float u_intensity;
uniform float u_bloom;

in vec2 v_uv;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float randomR(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return hash21(fract(uv));
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomR(i);
  float b = randomR(i + vec2(1.0, 0.0));
  float c = randomR(i + vec2(0.0, 1.0));
  float d = randomR(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float hash11(float p) {
  p = fract(p * 0.3183099) + 0.1;
  p *= p + 19.19;
  return fract(p * p);
}

float raysShape(vec2 uv, float r, float freq, float intensity, float radius) {
  float a = atan(uv.y, uv.x);
  vec2 left = vec2(a * freq, r);
  vec2 right = vec2(fract(a / TWO_PI) * TWO_PI * freq, r);
  float n_left = pow(valueNoise(left), intensity);
  float n_right = pow(valueNoise(right), intensity);
  float shape = mix(n_right, n_left, smoothstep(-.15, .15, uv.x));
  return shape;
}

void main() {
  vec2 shape_uv = v_uv - .5;

  float t = .2 * u_time;

  float radius = length(shape_uv);
  float spots = 6.5 * abs(u_spotty);

  float intensity = 4. - 3. * clamp(u_intensity, 0., 1.);

  float delta = 1. - smoothstep(0., 1., radius);

  float midSize = 10. * abs(u_midSize);
  float ms_lo = 0.02 * midSize;
  float ms_hi = max(midSize, 1e-6);
  float middleShape = pow(u_midIntensity, 0.3) * (1. - smoothstep(ms_lo, ms_hi, 3.0 * radius));
  middleShape = pow(middleShape, 5.0);

  vec3 accumColor = vec3(0.0);
  float accumAlpha = 0.0;

  for (int i = 0; i < 5; i++) {
    if (float(i) < u_colorsCount) {
      vec2 rotatedUV = rotate(shape_uv, float(i) + 1.0);

      float r1 = radius * (1.0 + 0.4 * float(i)) - 3.0 * t;
      float r2 = 0.5 * radius * (1.0 + spots) - 2.0 * t;
      float density = 6. * u_density + step(.5, u_density) * pow(4.5 * (u_density - .5), 4.);
      float f = mix(1.0, 3.0 + 0.5 * float(i), hash11(float(i) * 15.)) * density;

      float ray = raysShape(rotatedUV, r1, 5.0 * f, intensity, radius);
      ray *= raysShape(rotatedUV, r2, 4.0 * f, intensity, radius);
      ray += (1. + 4. * ray) * middleShape;
      ray = clamp(ray, 0.0, 1.0);

      float srcAlpha = u_colors[i].a * ray;
      vec3 srcColor = u_colors[i].rgb * srcAlpha;

      vec3 alphaBlendColor = accumColor + (1.0 - accumAlpha) * srcColor;
      float alphaBlendAlpha = accumAlpha + (1.0 - accumAlpha) * srcAlpha;

      vec3 addBlendColor = accumColor + srcColor;
      float addBlendAlpha = accumAlpha + srcAlpha;

      accumColor = mix(alphaBlendColor, addBlendColor, u_bloom);
      accumAlpha = mix(alphaBlendAlpha, addBlendAlpha, u_bloom);
    }
  }

  float overlayAlpha = u_colorBloom.a;
  vec3 overlayColor = u_colorBloom.rgb * overlayAlpha;

  vec3 colorWithOverlay = accumColor + accumAlpha * overlayColor;
  accumColor = mix(accumColor, colorWithOverlay, u_bloom);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;

  vec3 color = accumColor + (1. - accumAlpha) * bgColor;
  float opacity = accumAlpha + (1. - accumAlpha) * u_colorBack.a;
  color = clamp(color, 0., 1.);
  opacity = clamp(opacity, 0., 1.);

  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  fragColor = vec4(color, opacity);
}`;
