import type { FieldGeometry } from "@scripts/webgl/dither";

/** Grid square in CSS px; mirrors --grid-size. */
export const GRID = 24;
/** Dither cell in CSS px. */
export const CELL = 2;
/** Grid-only rows below the dithered area. */
const BASE_ROWS = 2;
/** Minimum dithered rows. */
const MIN_ROWS = 14;
/** Grid squares spanned by the BUILD/DEBUG blocks. */
const BLOCK_SPAN = 5;

export interface HeroElements {
  hero: HTMLElement;
  logo: HTMLElement;
  copy: HTMLElement;
  build: HTMLElement | null;
  debug: HTMLElement | null;
  metrics: HTMLElement[];
}

export interface HeroLayout {
  geometry: FieldGeometry;
  /** Canvas size in CSS px. */
  width: number;
  height: number;
}

function place(el: HTMLElement, col: number, row: number, span: number) {
  el.style.left = `${col * GRID + 1}px`;
  el.style.top = `${row * GRID + 1}px`;
  el.style.width = `${span * GRID - 1}px`;
  el.style.height = `${GRID - 1}px`;
  el.style.right = "auto";
}

/**
 * Snaps the hero to whole grid squares, sized to fit the wordmark and copy,
 * and locks the BUILD/DEBUG/metric blocks into grid rows.
 */
export function layoutHero(els: HeroElements): HeroLayout {
  const { hero, logo, copy } = els;
  const margin = Math.min(24, Math.max(10, innerWidth * 0.02));
  const nx = Math.max(1, Math.floor((innerWidth - 2 * margin - 1) / GRID));

  // Measure content at natural height before snapping
  hero.style.height = "auto";
  hero.style.paddingBottom = "0px";
  const contentH = copy.getBoundingClientRect().bottom - logo.getBoundingClientRect().top;
  const target = Math.max(contentH + 2 * GRID + 40, MIN_ROWS * GRID);
  const ditherRows = Math.max(1, Math.ceil((target - 1) / GRID));
  const ny = ditherRows + BASE_ROWS;

  const pw = nx * GRID + 1;
  const ph = ny * GRID + 1;
  hero.style.paddingBottom = `${BASE_ROWS * GRID}px`;
  hero.style.width = `${pw}px`;
  hero.style.height = `${ph}px`;

  const span = Math.min(BLOCK_SPAN, Math.max(1, nx - 2));
  const rightCol = nx - 1 - span;
  if (els.build) place(els.build, rightCol, ditherRows - 1, span);
  if (els.debug) place(els.debug, rightCol, ditherRows, span);

  // Metrics fill the same two rows from the left, two per row, if they fit
  const perRow = Math.min(2, Math.max(0, Math.floor((rightCol - 1) / (span + 1))));
  els.metrics.forEach((cell, i) => {
    const row = perRow ? Math.floor(i / perRow) : Infinity;
    if (row > BASE_ROWS - 1) {
      cell.style.display = "none";
      return;
    }
    cell.style.display = "";
    place(cell, 1 + (i % perRow) * (span + 1), ditherRows - 1 + row, span);
  });

  const cols = Math.ceil(pw / CELL);
  const rows = Math.ceil(ph / CELL);
  const h = rows * CELL;
  const heroRect = hero.getBoundingClientRect();
  const logoRect = logo.getBoundingClientRect();

  return {
    width: cols * CELL,
    height: h,
    geometry: {
      cols,
      rows,
      square: GRID / CELL,
      ditherRows,
      box: [0, (h - ph) / CELL, pw / CELL, h / CELL],
      logo: [
        (logoRect.left - heroRect.left + logoRect.width / 2) / CELL,
        (h - (logoRect.top - heroRect.top + logoRect.height / 2)) / CELL,
        logoRect.width / 2 / CELL,
      ],
    },
  };
}
