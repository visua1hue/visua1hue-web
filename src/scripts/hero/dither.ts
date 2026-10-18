/**
 * Animated dither field for the hero grid. A domain-warped simplex field, lit by
 * its own slope, quantised per grid square into 5 levels and thresholded with an
 * 8x8 Bayer matrix. One canvas pixel is one dither cell; CSS scales it up.
 *
 * Two passes, because every value except the Bayer threshold is constant per grid square:
 * 1. Field pass: one fragment per square writes its brightness level (0..5) into a small texture.
 * 2. Dither pass: one fragment per cell reads its square's level and applies the Bayer threshold.
 * The noise runs once per square instead of once per cell (~144x less work).
 */

/** Canvas-pixel geometry, y-up (GL convention). */
export interface FieldGeometry {
  /** Canvas size in dither cells. */
  cols: number;
  rows: number;
  /** Grid square size in cells. */
  square: number;
  /** Dithered rows of grid squares, counted from the top. */
  ditherRows: number;
  /** Hero box: left, bottom, right, top. */
  box: [number, number, number, number];
  /** Wordmark centre and half-width, used to dim the field behind it. */
  logo: [number, number, number];
}

/** Horizontal slice shift: rows y0..y1 sampled `shift` cells to the side. */
export interface GlitchSlice {
  y0: number;
  y1: number;
  shift: number;
}

export interface DitherRenderer {
  resize(geometry: FieldGeometry): void;
  /** `intro` fades the field in, 0..1. */
  draw(time: number, intro: number, glitch: GlitchSlice | null): void;
  destroy(): void;
}

const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/** Pass 1: one fragment per grid square (x = column, y = row from the top). */
const FIELD_SRC = `#version 300 es
precision highp float;
out vec4 outColor;

uniform float u_time;
uniform float u_intro;
uniform vec2 u_res;
uniform vec3 u_logo;
uniform vec4 u_box;
uniform float u_square;
uniform float u_ditherRows;

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
  vec2 uv = cc / u_res.y * .72;
  float f = field(uv, u_time);
  float f2 = field(uv + vec2(-.008, .010), u_time);
  float shade = clamp((f - f2) * 11. + .5, 0., 1.);
  float lum = smoothstep(.46, .86, f) * (.42 + .62 * shade);
  lum = pow(lum, 1.15) * .82;

  float e = length((cc - u_logo.xy) / u_logo.z * vec2(.95, 2.4));
  lum *= 1. - .45 * smoothstep(1.3, .35, e);

  float gy = clamp(1. - (gid.y + .5) * S / dh, 0., 1.);
  vec2 crel = (gid + .5) * S;
  float ed = min(min(crel.x, bw.x - crel.x), min(crel.y, dh - crel.y));
  lum *= mix(1., .8, gy) * mix(.8, 1., smoothstep(0., u_res.y * .06, ed));
  lum *= u_intro;

  // Level 0..5, stored exactly in an 8-bit channel
  float level = clamp(floor(lum * 5. + .35), 0., 5.);
  outColor = vec4(level / 255., 0., 0., 1.);
}
`;

/** Pass 2: one fragment per dither cell. */
const DITHER_SRC = `#version 300 es
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

  // Inside a square (skipping its 1-cell grid line), inside the box, and not in
  // the first or last dithered row
  float inSq = step(1., lc.x) * step(1., lc.y)
    * step(0., rel.x) * step(0., rel.y) * step(rel.x, bw.x - .5)
    * step(rel.y, dh - .5) * step(S, rel.y) * step(rel.y, dh - S - .5);
  if (inSq < .5) { outColor = vec4(0.); return; }

  ivec2 size = textureSize(u_field, 0);
  ivec2 at = clamp(ivec2(gid), ivec2(0), size - 1);
  float lum = round(texelFetch(u_field, at, 0).r * 255.) / 5.;

  float on = step(b8(lc) + .008, lum);
  vec3 tone = mix(vec3(.52, .54, .58), vec3(.93, .94, .95), smoothstep(.35, .9, lum));
  outColor = vec4(tone * on, on);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, fragmentSrc: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

/** GPU objects; rebuilt from scratch after a context loss. */
function createResources(gl: WebGL2RenderingContext) {
  const field = createProgram(gl, FIELD_SRC);
  const dither = createProgram(gl, DITHER_SRC);

  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Single triangle, clipped to the viewport by gl_Position
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();

  const fu = (name: string) => gl.getUniformLocation(field, name);
  const du = (name: string) => gl.getUniformLocation(dither, name);
  return {
    field,
    dither,
    vao,
    buffer,
    texture,
    framebuffer,
    f: {
      time: fu("u_time"),
      intro: fu("u_intro"),
      res: fu("u_res"),
      logo: fu("u_logo"),
      box: fu("u_box"),
      square: fu("u_square"),
      ditherRows: fu("u_ditherRows"),
    },
    d: {
      field: du("u_field"),
      glitch: du("u_glitch"),
      box: du("u_box"),
      square: du("u_square"),
      ditherRows: du("u_ditherRows"),
    },
  };
}

type Resources = ReturnType<typeof createResources>;

export function createDitherRenderer(canvas: HTMLCanvasElement): DitherRenderer | null {
  const ctx = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    // A 2D-ish effect; keep laptops on the integrated GPU
    powerPreference: "low-power",
  });
  if (!ctx) return null;
  const gl: WebGL2RenderingContext = ctx;

  let res: Resources | null = createResources(gl);
  let geometry: FieldGeometry | null = null;
  let fieldSize: [number, number] = [1, 1];

  const onLost = (e: Event) => {
    e.preventDefault(); // allow restore
    res = null;
  };
  const onRestored = () => {
    res = createResources(gl);
    if (geometry) resize(geometry);
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  function resize(g: FieldGeometry): void {
    geometry = g;
    canvas.width = g.cols;
    canvas.height = g.rows;
    if (!res) return;

    const bw = g.box[2] - g.box[0];
    fieldSize = [Math.max(1, Math.ceil(bw / g.square)), Math.max(1, g.ditherRows)];
    gl.bindTexture(gl.TEXTURE_2D, res.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fieldSize[0], fieldSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, res.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, res.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(res.field);
    gl.uniform2f(res.f.res, g.cols, g.rows);
    gl.uniform3f(res.f.logo, ...g.logo);
    gl.uniform4f(res.f.box, ...g.box);
    gl.uniform1f(res.f.square, g.square);
    gl.uniform1f(res.f.ditherRows, g.ditherRows);

    gl.useProgram(res.dither);
    gl.uniform1i(res.d.field, 0);
    gl.uniform4f(res.d.box, ...g.box);
    gl.uniform1f(res.d.square, g.square);
    gl.uniform1f(res.d.ditherRows, g.ditherRows);
  }

  function draw(time: number, intro: number, glitch: GlitchSlice | null): void {
    if (!res || !geometry) return;
    gl.bindVertexArray(res.vao);

    // Pass 1: field levels per square
    gl.bindFramebuffer(gl.FRAMEBUFFER, res.framebuffer);
    gl.viewport(0, 0, fieldSize[0], fieldSize[1]);
    gl.useProgram(res.field);
    gl.uniform1f(res.f.time, time);
    gl.uniform1f(res.f.intro, intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2: dither to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, geometry.cols, geometry.rows);
    gl.useProgram(res.dither);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, res.texture);
    if (glitch) gl.uniform4f(res.d.glitch, glitch.y0, glitch.y1, glitch.shift, 1);
    else gl.uniform4f(res.d.glitch, 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function destroy(): void {
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    if (!res) return;
    gl.deleteFramebuffer(res.framebuffer);
    gl.deleteTexture(res.texture);
    gl.deleteBuffer(res.buffer);
    gl.deleteVertexArray(res.vao);
    gl.deleteProgram(res.field);
    gl.deleteProgram(res.dither);
    res = null;
  }

  return { resize, draw, destroy };
}
