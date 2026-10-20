import { readTokens } from "./tokens";

/** Dot opacity on top of the canvas's CSS `color`. */
const DOT_ALPHA = 0.22;

/** 8x8 Bayer threshold for cell (x, y), in 0..1. */
function bayer(x: number, y: number): number {
  let v = 0;
  let s = 1;
  for (let i = 0; i < 3; i++) {
    const bx = x & 1;
    const by = y & 1;
    v = v * 4 + ((bx ^ by) * 2 + by);
    x >>= 1;
    y >>= 1;
    s *= 4;
  }
  return (v + 0.5) / s;
}

/** Hard-edged opening quotation mark (two wedges) as an alpha mask. */
function maskGlyph(cols: number, rows: number): Uint8ClampedArray {
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  // No willReadFrequently: the software rasterizer it selects antialiases edges
  // differently, which flips dots along the wedge edges
  const o = off.getContext("2d")!;
  o.fillStyle = "#fff";
  const mw = cols * 0.42;
  const gap = cols * 0.12;
  const mh = rows * 0.86;
  const oy = rows * 0.04;
  for (const ox of [0, mw + gap]) {
    o.beginPath();
    o.moveTo(ox, oy + mh * 0.46);
    o.lineTo(ox + mw * 0.42, oy);
    o.lineTo(ox + mw, oy);
    o.lineTo(ox + mw * 0.62, oy + mh * 0.46);
    o.lineTo(ox + mw, oy + mh * 0.46);
    o.lineTo(ox + mw, oy + mh);
    o.lineTo(ox, oy + mh);
    o.closePath();
    o.fill();
  }
  return o.getImageData(0, 0, cols, rows).data;
}

function draw(canvas: HTMLCanvasElement, w: number, h: number) {
  const { cell } = readTokens(canvas, { cell: "--dither-cell" });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const mask = maskGlyph(cols, rows);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(canvas).color;
  ctx.globalAlpha = DOT_ALPHA;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = mask[(y * cols + x) * 4 + 3] / 255;
      if (a < 0.02) continue;
      // Fades toward the bottom right
      const g = 0.95 - 0.7 * (y / rows) - 0.15 * (x / cols);
      if (a * g > bayer(x, y)) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

/**
 * Draws the dithered quote mark once it nears the viewport, redraws only when its
 * CSS size changes, and fades it in when 20% visible.
 */
export function initQuote(canvas: HTMLCanvasElement): () => void {
  let drawn = "";
  const redraw = (w: number, h: number) => {
    const key = `${w}x${h}`;
    if (!w || !h || key === drawn) return;
    drawn = key;
    draw(canvas, w, h);
  };

  let near = false;
  const ro = new ResizeObserver(([e]) => {
    if (near) redraw(e.contentRect.width, e.contentRect.height);
  });
  const lazy = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      near = true;
      lazy.disconnect();
      redraw(canvas.clientWidth, canvas.clientHeight);
      ro.observe(canvas);
    },
    { rootMargin: "300px 0px" },
  );
  const fade = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      canvas.classList.add("in");
      fade.disconnect();
    },
    { threshold: 0.2 },
  );
  lazy.observe(canvas);
  fade.observe(canvas);

  return () => {
    lazy.disconnect();
    fade.disconnect();
    ro.disconnect();
  };
}
