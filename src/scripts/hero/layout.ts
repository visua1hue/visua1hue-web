import { readTokens } from "@scripts/tokens";
import type { FieldGeometry } from "./dither";
import type { HeroParts } from "./parts";

/** Grid tokens from styles/variables.css; the pre-layout CSS uses the same ones. */
export interface GridTokens {
  /** Grid square, CSS px. */
  size: number;
  /** Minimum dithered rows. */
  ditherRows: number;
  /** Grid-only rows below the dither. */
  baseRows: number;
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
    baseRows: "--grid-base-rows",
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
 * and locks the BUILD/DEBUG/metric blocks into grid rows.
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
  root.style.paddingBottom = "0px";
  const contentH = copy.getBoundingClientRect().bottom - logo.getBoundingClientRect().top;
  const target = Math.max(contentH + 2 * G + 40, t.ditherRows * G);
  const ditherRows = Math.max(1, Math.ceil((target - 1) / G));
  const ny = ditherRows + t.baseRows;

  const pw = nx * G + 1;
  const ph = ny * G + 1;
  root.style.paddingBottom = `${t.baseRows * G}px`;
  root.style.width = `${pw}px`;
  root.style.height = `${ph}px`;

  const span = Math.min(t.blockSpan, Math.max(1, nx - 2));
  const rightCol = nx - 1 - span;
  if (parts.build) place(parts.build, rightCol, ditherRows - 1, span);
  if (parts.debug) place(parts.debug, rightCol, ditherRows, span);

  // Metrics fill the same rows from the left, two per row, if they fit
  const perRow = Math.min(2, Math.max(0, Math.floor((rightCol - 1) / (span + 1))));
  parts.metrics.forEach((cell, i) => {
    const row = perRow ? Math.floor(i / perRow) : Infinity;
    if (row > t.baseRows - 1) {
      cell.style.display = "none";
      return;
    }
    cell.style.display = "";
    place(cell, 1 + (i % perRow) * (span + 1), ditherRows - 1 + row, span);
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
