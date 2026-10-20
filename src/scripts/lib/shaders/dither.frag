#version 300 es
precision highp float;
out vec4 outColor;

uniform sampler2D u_field;
uniform vec4 u_glitch;
uniform vec4 u_box;
uniform float u_square;
uniform float u_ditherRows;

// Recursive Bayer: b2 -> b4 -> b8
float b2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float b4(vec2 a) { return b2(.5 * a) * .25 + b2(a); }
float b8(vec2 a) { return b4(.5 * a) * .25 + b2(a); }

void main() {
  vec2 c = gl_FragCoord.xy;
  if (u_glitch.w > .5 && c.y > u_glitch.x && c.y < u_glitch.y) c.x += u_glitch.z;

  float S = u_square;
  vec2 rel = vec2(c.x - u_box.x, u_box.w - c.y);
  vec2 bw = vec2(u_box.z - u_box.x, u_box.w - u_box.y);
  vec2 gid = floor(rel / S);
  vec2 lc = rel - gid * S;
  float dh = u_ditherRows * S;

  ivec2 size = textureSize(u_field, 0);
  ivec2 at = clamp(ivec2(gid), ivec2(0), size - 1);
  vec4 fv = texelFetch(u_field, at, 0);
  float lum = round(fv.r * 255.) / 5.;
  vec3 tone = mix(vec3(.52, .54, .58), vec3(.93, .94, .95), smoothstep(.35, .9, lum));

  // Intro cover: the whole square, grid line included, is opaque so the logo beneath stays hidden
  if (fv.g > .5 && all(equal(ivec2(gid), at))) {
    float lit = step(1., lc.x) * step(1., lc.y) * step(b8(lc) + .008, lum);
    outColor = vec4(mix(vec3(.031, .035, .039), tone, lit), 1.);
    return;
  }

  // Inside a square (skipping its 1-cell grid line), inside the box, and not in
  // the first or last dithered row
  float inSq = step(1., lc.x) * step(1., lc.y)
    * step(0., rel.x) * step(0., rel.y) * step(rel.x, bw.x - .5)
    * step(rel.y, dh - .5) * step(S, rel.y) * step(rel.y, dh - S - .5);
  if (inSq < .5) { outColor = vec4(0.); return; }

  float on = step(b8(lc) + .008, lum);
  outColor = vec4(tone * on, on);
}
