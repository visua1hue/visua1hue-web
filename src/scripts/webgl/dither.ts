export interface DitherRenderer {
  draw(time?: number): void;
  setPointer(x: number, y: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

// Full-screen triangle — covers the viewport without a second triangle or index buffer.
const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 4x4 dispersed Bayer matrix — same values as Logotype.astro's SVG <pattern> (logotype-dither),
// but used here as a real per-pixel threshold against the source texture's luminance rather than
// a fixed density, so tone actually varies across the image instead of being uniform.
const FRAGMENT_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;

const float BAYER[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

float ditherThreshold(vec2 fragCoord) {
  int x = int(mod(fragCoord.x, 4.0));
  int y = int(mod(fragCoord.y, 4.0));
  return BAYER[y * 4 + x] / 16.0;
}

void main() {
  vec3 color = texture(u_source, v_uv).rgb;
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  // Slow brightness pulse — shifts how much of the image crosses the dither
  // threshold each frame, so the dot density breathes lighter and darker over time.
  float pulse = sin(u_time) * 0.09;
  float value = (luminance + pulse) > ditherThreshold(gl_FragCoord.xy) ? 1.0 : 0.0;
  outColor = vec4(vec3(value), 1.0);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
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

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
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

// No real photo asset yet — a small generated canvas stands in for one, built from
// distinct angled facets (like a folded/torn paper corner) rather than flat noise,
// so the dithered result reads as a textured object instead of uniform static.
// Swapping in a real photo later is a one-line change: replace this block with an
// `<img>`/`fetch` decode and pass the resulting ImageBitmap to gl.texImage2D instead.
function createPlaceholderTexture(gl: WebGL2RenderingContext): WebGLTexture {
  // Matches the dither window's own aspect ratio (~2.58:1, sized to span "HUE") —
  // a square source texture stretched into that wide a frame flattens any diagonal
  // into a horizontal smear, so the shapes below are drawn in the frame they'll
  // actually be seen in.
  const w = 200;
  const h = 78;
  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const ctx = source.getContext("2d");
  if (!ctx) throw new Error("Failed to create placeholder 2D context");

  // Biased dark overall (not a full 0-255 sweep): a difference-blended letter needs
  // strong invert-contrast wherever it lands, which a ~50%-luminance midtone can't
  // provide (inverting a ~50% dither density just swaps which dots are on, same
  // apparent texture) — every facet below stays within a dark tonal range.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  // Folded corner — a lighter facet peeling in from the top-right, like the
  // reference's torn-paper/concrete-slab photo.
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.moveTo(w * 0.6, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.65);
  ctx.closePath();
  ctx.fill();

  // A second angled facet, different tone — gives the surface more than one
  // visible plane instead of a single gradient sweep.
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.lineTo(w * 0.4, h * 0.3);
  ctx.lineTo(w * 0.62, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Soft directional falloff across the whole thing for depth, capped low so it
  // can't wash out the dark bias the facets rely on.
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "rgba(51, 51, 51, 0)");
  gradient.addColorStop(1, "rgba(51, 51, 51, 0.35)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    imageData.data[i] += noise;
    imageData.data[i + 1] += noise;
    imageData.data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

export function createDitherRenderer(
  canvas: HTMLCanvasElement,
): DitherRenderer | null {
  // preserveDrawingBuffer so toDataURL() reliably reads back what was just drawn —
  // without it, the buffer can be cleared before a synchronous readback completes.
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return null;

  const program = createProgram(gl);
  const texture = createPlaceholderTexture(gl);

  const vao = gl.createVertexArray();
  const positionBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Single triangle, clipped to the viewport by gl_Position — covers it fully with no waste.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");
  const uSource = gl.getUniformLocation(program, "u_source");

  let pointerX = canvas.width / 2;
  let pointerY = canvas.height / 2;

  function draw(time = 0): void {
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uPointer, pointerX, pointerY);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uSource, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setPointer(x: number, y: number): void {
    pointerX = x;
    pointerY = y;
  }

  function resize(width: number, height: number): void {
    canvas.width = width;
    canvas.height = height;
  }

  function destroy(): void {
    if (!gl) return;
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  }

  return { draw, setPointer, resize, destroy };
}
