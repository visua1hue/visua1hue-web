#version 300 es
precision highp float;
out vec4 outColor;

uniform float u_time;
uniform float u_intro;
uniform vec2 u_res;
uniform vec3 u_logo;
uniform vec4 u_box;
uniform float u_square;
uniform float u_ditherRows;
uniform vec4 u_cover;
uniform float u_coverOn;

vec3 perm(vec3 x) { return mod(((x * 34.) + 1.) * x, 289.); }

float snoise(vec2 v) {
  const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.);
  vec3 p = perm(perm(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
  m = m * m;
  m = m * m;
  vec3 x = 2. * fract(p * C.www) - 1.;
  vec3 h = abs(x) - .5;
  vec3 ox = floor(x + .5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - .85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130. * dot(m, g);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float fbm(vec2 p) {
  float v = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 4; i++) { v += a * snoise(p); p = r * p * 2.03 + 1.7; a *= .5; }
  return .5 + .5 * v;
}

float field(vec2 uv, float t) {
  vec2 q = vec2(fbm(uv * 1.2 + vec2(0., t * .04)), fbm(uv * 1.2 + vec2(5.2, 1.3) - t * .035));
  vec2 r = vec2(fbm(uv * 1.1 + 1.8 * q + vec2(1.7, 9.2) + t * .025), fbm(uv * 1.1 + 1.8 * q + vec2(8.3, 2.8) - t * .02));
  return fbm(uv * .9 + 2. * r);
}

void main() {
  vec2 gid = floor(gl_FragCoord.xy);
  float S = u_square;
  vec2 bw = vec2(u_box.z - u_box.x, u_box.w - u_box.y);
  float dh = u_ditherRows * S;

  // Sample at the square's centre
  vec2 cc = vec2(u_box.x + (gid.x + .5) * S, u_box.w - (gid.y + .5) * S);
  vec2 uv = cc / u_res.y * 1.08;
  float f = field(uv, u_time);
  float f2 = field(uv + vec2(-.008, .010), u_time);
  float shade = clamp((f - f2) * 11. + .5, 0., 1.);
  float lum = smoothstep(.40, .82, f) * (.42 + .62 * shade);
  lum = pow(lum, 1.15) * .82;

  float e = length((cc - u_logo.xy) / u_logo.z * vec2(.95, 2.4));
  lum *= 1. - .45 * smoothstep(1.3, .35, e);

  float gy = clamp(1. - (gid.y + .5) * S / dh, 0., 1.);
  vec2 crel = (gid + .5) * S;
  float ed = min(min(crel.x, bw.x - crel.x), min(crel.y, dh - crel.y));
  lum *= mix(1., .8, gy) * mix(.8, 1., smoothstep(0., u_res.y * .06, ed));

  // Intro. Squares over the wordmark (u_cover) are opaque covers in random shades that drop
  // out in random clusters, revealing the logo square by square (the canvas sits above the
  // logo while u_coverOn). Around them, a band of field-like clumps hugs the wordmark and
  // dissolves while the field develops outward. At u_intro = 1 this is the plain field.
  float covered = 0.;
  if (u_intro < 1.) {
    vec2 q = abs(gid + .5 - u_cover.xy - u_cover.zw * .5) - u_cover.zw * .5;
    float outside = step(0., max(q.x, q.y));
    // Shades weighted toward the low levels; bright squares are rare
    float shade = .15 + .7 * pow(hash(gid + floor(u_time * 6.)), 2.2);
    float develop = smoothstep(0., 1., (u_intro - .18 - .1 * e) / .4);
    if (u_coverOn > .5 && outside < .5) {
      // Drop out in clusters: smooth noise picks the moment, a little hash roughens the edges
      float n = smoothstep(-.55, .55, snoise(gid * .32 + 5.7));
      covered = step(u_intro, .17 + .25 * (.8 * n + .2 * hash(gid + 3.3)));
      lum = covered * step(.4, hash(gid + 9.2 + floor(u_time * 6.))) * shade;
    } else {
      float dist = length(max(q, 0.) * vec2(.4, 1.));
      float reach = 1. - smoothstep(.5, 4.5, dist + 1.2 * snoise(gid * .3 + 3.1));
      float clump = fbm(gid * .18 + vec2(u_time * .6, -u_time * .4));
      float on = .02 + .12 * hash(gid);
      float off = .33 + .25 * hash(gid + 7.1);
      float alive = outside * step(on, u_intro) * step(u_intro, off) * step(.05, reach)
        * step(.62 - .22 * reach, clump);
      lum = max(lum * develop, alive * shade);
    }
  }

  // Level 0..5, stored exactly in an 8-bit channel
  float level = clamp(floor(lum * 5. + .35), 0., 5.);
  outColor = vec4(level / 255., covered, 0., 1.);
}
