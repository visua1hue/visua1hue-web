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

import VERTEX_SRC from "./shaders/fullscreen.vert?raw";
/** Pass 1: one fragment per grid square (x = column, y = row from the top). */
import FIELD_SRC from "./shaders/field.frag?raw";
/** Pass 2: one fragment per dither cell. */
import DITHER_SRC from "./shaders/dither.frag?raw";

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
  /** Grid squares the wordmark covers: column, row (from the top), columns, rows. The intro covers them. */
  cover: [number, number, number, number];
}

/** Horizontal slice shift: rows y0..y1 sampled `shift` cells to the side. */
export interface GlitchSlice {
  y0: number;
  y1: number;
  shift: number;
}

export interface DitherRenderer {
  resize(geometry: FieldGeometry): void;
  /** `intro` runs the intro, 0..1. `cover` keeps the squares over the wordmark covered. */
  draw(time: number, intro: number, glitch: GlitchSlice | null, cover: boolean): void;
  destroy(): void;
}

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
      cover: fu("u_cover"),
      coverOn: fu("u_coverOn"),
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
    gl.uniform4f(res.f.cover, ...g.cover);

    gl.useProgram(res.dither);
    gl.uniform1i(res.d.field, 0);
    gl.uniform4f(res.d.box, ...g.box);
    gl.uniform1f(res.d.square, g.square);
    gl.uniform1f(res.d.ditherRows, g.ditherRows);
  }

  function draw(time: number, intro: number, glitch: GlitchSlice | null, cover: boolean): void {
    if (!res || !geometry) return;
    gl.bindVertexArray(res.vao);

    // Pass 1: field levels per square
    gl.bindFramebuffer(gl.FRAMEBUFFER, res.framebuffer);
    gl.viewport(0, 0, fieldSize[0], fieldSize[1]);
    gl.useProgram(res.field);
    gl.uniform1f(res.f.time, time);
    gl.uniform1f(res.f.intro, intro);
    gl.uniform1f(res.f.coverOn, cover ? 1 : 0);
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
