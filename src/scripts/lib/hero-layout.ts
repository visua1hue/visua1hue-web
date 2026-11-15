import { readTokens } from "./tokens";
import type { FieldGeometry } from "./dither";
import type { HeroParts } from "./hero-parts";

/** Grid tokens from styles/variables.css; the pre-layout CSS uses the same ones. */
export interface GridTokens {
  /** Grid square, CSS px. */
  size: number;
  /** Minimum dithered rows. */
  ditherRows: number;
  /** Squares spanned by BUILD/DEBUG/metric blocks. */
  blockSpan: number;
  /** Dither dot, CSS px. */
  cell: number;
  /** Minimum side gap, CSS px (viewport-dependent; re-read on resize). */
  margin: number;
}

export const readGridTokens = (el: Element): GridTokens =>
  readTokens(el, {
    size: "--grid-size",
    ditherRows: "--grid-dither-rows",
    blockSpan: "--grid-block-span",
    cell: "--dither-cell",
    margin: "--hero-margin",
  });

export interface HeroLayout {
  geometry: FieldGeometry;
  /** Canvas size in CSS px. */
  width: number;
  height: number;
}

/** Ink box of an SVG logo mark as fractions of its element: left, top, width, height. */
function inkBox(logo: HTMLElement): [number, number, number, number] | null {
  const svg = logo.querySelector<SVGSVGElement>("svg.mark");
  const use = svg?.querySelector("use");
  if (!svg || !use) return null;
  const vb = svg.viewBox.baseVal;
  const b = use.getBBox();
  if (!b.width || !vb.width) return null;
  return [(b.x - vb.x) / vb.width, (b.y - vb.y) / vb.height, b.width / vb.width, b.height / vb.height];
}

/** Logo width in grid squares: about half the hero, more on narrow screens; same parity as `nx` so it centres on grid lines. */
function logoSquares(nx: number): number {
  const share = Math.min(0.8, Math.max(0.5, 0.8 - ((nx - 16) * 0.3) / 24));
  const n = Math.max(1, Math.round(nx * share));
  return (nx - n) % 2 ? n - 1 : n;
}

/**
 * Snaps the hero to whole grid squares, sized to fit the wordmark and copy, puts the
 * wordmark's ink on grid lines, and locks BUILD into the first grid row and DEBUG plus
 * metrics into the last dithered row.
 */
export function layoutHero(parts: HeroParts, t: GridTokens): HeroLayout {
  const { root, logo, copy } = parts;
  const G = t.size;
  const place = (el: HTMLElement, col: number, row: number, span: number) => {
    el.style.left = `${col * G + 1}px`;
    el.style.top = `${row * G + 1}px`;
    el.style.width = `${span * G - 1}px`;
    el.style.height = `${G - 1}px`;
    el.style.right = "auto";
  };

  const nx = Math.max(1, Math.floor((innerWidth - 2 * t.margin - 1) / G));

  // An SVG wordmark spans whole squares: size it before measuring the content
  const ink = inkBox(logo);
  const logoCols = logoSquares(nx);
  logo.style.translate = "";
  if (ink) logo.style.width = `${(logoCols * G - 1) / ink[2]}px`;

  // Measure content at natural height before snapping
  root.style.height = "auto";
  const contentH = copy.getBoundingClientRect().bottom - logo.getBoundingClientRect().top;
  const target = Math.max(contentH + 2 * G + 40, t.ditherRows * G);
  const ditherRows = Math.max(1, Math.ceil((target - 1) / G));

  const pw = nx * G + 1;
  const ph = ditherRows * G + 1;
  root.style.width = `${pw}px`;
  root.style.height = `${ph}px`;

  const span = Math.min(t.blockSpan, Math.max(1, nx - 2));
  const rightCol = nx - 1 - span;
  const metaRow = ditherRows - 1;
  if (parts.build) place(parts.build, rightCol, 0, span);
  if (parts.debug) place(parts.debug, rightCol, metaRow, span);

  // Metrics share DEBUG's row from column 2 (balances the empty space right of DEBUG's
  // label); the ones that don't fit are hidden
  const firstCol = 2;
  const fit = Math.max(0, Math.floor((rightCol - firstCol) / (span + 1)));
  parts.metrics.forEach((cell, i) => {
    cell.style.display = i < fit ? "" : "none";
    if (i < fit) place(cell, firstCol + i * (span + 1), metaRow, span);
  });

  // Move the ink onto grid lines; `cover` is the block of squares it occupies
  const heroRect = root.getBoundingClientRect();
  let logoRect = logo.getBoundingClientRect();
  let cover: [number, number, number, number];
  if (ink) {
    const col = (nx - logoCols) / 2;
    const inkLeft = logoRect.left - heroRect.left + ink[0] * logoRect.width;
    const inkTop = logoRect.top - heroRect.top + ink[1] * logoRect.height;
    const row = Math.max(1, Math.round((inkTop - 1) / G));
    logo.style.translate = `${col * G + 1 - inkLeft}px ${row * G + 1 - inkTop}px`;
    logoRect = logo.getBoundingClientRect();
    cover = [col, row, logoCols, Math.ceil((ink[3] * logoRect.height + 1) / G)];
  } else {
    const x0 = Math.floor((logoRect.left - heroRect.left) / G);
    const y0 = Math.floor((logoRect.top - heroRect.top) / G);
    const x1 = Math.ceil((logoRect.right - heroRect.left) / G);
    const y1 = Math.ceil((logoRect.bottom - heroRect.top) / G);
    cover = [x0, y0, x1 - x0, y1 - y0];
  }

  const C = t.cell;
  const cols = Math.ceil(pw / C);
  const rows = Math.ceil(ph / C);
  const h = rows * C;

  return {
    width: cols * C,
    height: h,
    geometry: {
      cols,
      rows,
      square: G / C,
      ditherRows,
      box: [0, (h - ph) / C, pw / C, h / C],
      cover,
      logo: [
        (logoRect.left - heroRect.left + logoRect.width / 2) / C,
        (h - (logoRect.top - heroRect.top + logoRect.height / 2)) / C,
        logoRect.width / 2 / C,
      ],
    },
  };
}
