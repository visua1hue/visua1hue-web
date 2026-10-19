import { readTokens } from "@scripts/tokens";
import type { FieldGeometry } from "./dither";
import type { HeroParts } from "./parts";

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

/**
 * Snaps the hero to whole grid squares, sized to fit the wordmark and copy,
 * and locks BUILD into the first grid row and DEBUG plus metrics into the last dithered row.
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

  const C = t.cell;
  const cols = Math.ceil(pw / C);
  const rows = Math.ceil(ph / C);
  const h = rows * C;
  const heroRect = root.getBoundingClientRect();
  const logoRect = logo.getBoundingClientRect();

  return {
    width: cols * C,
    height: h,
    geometry: {
      cols,
      rows,
      square: G / C,
      ditherRows,
      box: [0, (h - ph) / C, pw / C, h / C],
      logo: [
        (logoRect.left - heroRect.left + logoRect.width / 2) / C,
        (h - (logoRect.top - heroRect.top + logoRect.height / 2)) / C,
        logoRect.width / 2 / C,
      ],
    },
  };
}
