// Derived from paper-design/shaders packages/shaders/src/shaders/metaballs.ts (Apache-2.0). See NOTICE.
// Adaptations: sizing system removed (plain v_uv), helper chunks inlined,
// noise texture replaced with procedural hash, integer % and dynamic
// break/array-index rewritten for GLSL ES 1.00, fwidth replaced by a constant.
export const metaballsFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colors[8];
uniform float u_colorsCount;
uniform float u_size;
uniform float u_count;

in vec2 v_uv;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float randomR(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return hash21(fract(uv));
}

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  vec2 p0 = vec2(i, 0.0);
  vec2 p1 = vec2(i + 1.0, 0.0);
  return mix(randomR(p0), randomR(p1), u);
}

float getBallShape(vec2 uv, vec2 c, float p) {
  float s = .5 * length(uv - c);
  s = 1. - clamp(s, 0., 1.);
  s = pow(s, p);
  return s;
}

void main() {
  vec2 shape_uv = v_uv;

  const float firstFrameOffset = 2503.4;
  float t = .2 * (u_time + firstFrameOffset);

  vec3 totalColor = vec3(0.);
  float totalShape = 0.;
  float totalOpacity = 0.;

  for (int i = 0; i < 20; i++) {
    if (float(i) < ceil(u_count)) {
      float idxFract = float(i) / 20.;
      float angle = TWO_PI * idxFract;

      float speed = 1. - .2 * idxFract;
      float noiseX = noise(angle * 10. + float(i) + t * speed);
      float noiseY = noise(angle * 20. + float(i) - t * speed);

      vec2 pos = vec2(.5) + 1e-4 + .9 * (vec2(noiseX, noiseY) - .5);

      int safeIndex = int(mod(float(i), max(u_colorsCount, 1.)));
      vec4 ballColor = vec4(0.);
      for (int j = 0; j < 8; j++) {
        if (j == safeIndex) ballColor = u_colors[j];
      }
      ballColor.rgb *= ballColor.a;

      float sizeFrac = 1.;
      if (float(i) > floor(u_count - 1.)) {
        sizeFrac *= fract(u_count);
      }

      float shape = getBallShape(shape_uv, pos, 45. - 30. * u_size * sizeFrac);
      shape *= pow(u_size, .2);
      shape = smoothstep(0., 1., shape);

      totalColor += ballColor.rgb * shape;
      totalShape += shape;
      totalOpacity += ballColor.a * shape;
    }
  }

  totalColor /= max(totalShape, 1e-4);
  totalOpacity /= max(totalShape, 1e-4);

  float edge_width = .02;
  float finalShape = smoothstep(.4, .4 + edge_width, totalShape);

  vec3 color = totalColor * finalShape;
  float opacity = totalOpacity * finalShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  fragColor = vec4(color, opacity);
}`;
