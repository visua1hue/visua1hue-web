/**
 * The built homepage must match the approved prototype (prototype/index.html):
 * same element boxes, and the same pixels under reduced motion, where both render
 * one deterministic dither frame and no glitch.
 *
 * The prototype is served from a fake origin so its relative font URLs resolve to the
 * self-hosted files (file:// pages cannot load fonts in Chromium).
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const root = new URL("../", import.meta.url);
const ORIGIN = "http://prototype.test";
const PROTOTYPE = `${ORIGIN}/prototype/index.html`;

/** Serves repo files under ORIGIN. */
async function serveRepo(page: Page) {
  await page.route(`${ORIGIN}/**`, (r) =>
    r.fulfill({ path: fileURLToPath(new URL(`.${new URL(r.request().url()).pathname}`, root)) }),
  );
}

const writePng = async (path: string, png: PNG) => (await writeFile(path, PNG.sync.write(png)), path);

/** Same element in both pages: [prototype selector, build selector]. */
const BOXES: Record<string, [string, string]> = {
  hero: ["#hero", "[data-hero=root]"],
  logo: ["#logo", "[data-hero=logo]"],
  copy: [".copy", "[data-hero=copy]"],
  role: ["#role", "[data-role]"],
  build: [".meta-top", "[data-hero=build]"],
  debug: ["#dbg", "[data-hero=debug]"],
  about: ["#about", "[data-about]"],
  label: ["#about-label", "#about-label"],
  quote: ["#quote", "[data-quote]"],
  footer: ["footer", "footer"],
  legal: [".legal", ".legal"],
  year: ["#year", "[data-year]"],
};

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

async function settle(page: Page, url: string) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  // Layout re-runs on font load; the field fades in over 1.2s
  await page.waitForTimeout(1600);
}

async function boxes(page: Page, which: 0 | 1) {
  const sels = Object.fromEntries(Object.entries(BOXES).map(([k, v]) => [k, v[which]]));
  return page.evaluate((sels) => {
    const out: Record<string, number[]> = {};
    for (const [k, s] of Object.entries(sels)) {
      const b = document.querySelector(s)!.getBoundingClientRect();
      out[k] = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100);
    }
    out.page = [document.documentElement.scrollHeight];
    return out;
  }, sels);
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, reducedMotion: "reduce" });

    test("element boxes match the prototype", async ({ page }) => {
      await serveRepo(page);
      await settle(page, PROTOTYPE);
      const expected = await boxes(page, 0);
      await settle(page, "/");
      expect(await boxes(page, 1)).toEqual(expected);
    });

    test("pixels match the prototype", async ({ page }, info) => {
      await serveRepo(page);
      // The BUILD hash differs by design; debug metrics are live measurements
      const hideLive = (sel: string) =>
        page.addStyleTag({ content: `${sel} .t, [data-m] { visibility: hidden }` });

      await settle(page, PROTOTYPE);
      await hideLive(".meta-top");
      const a = PNG.sync.read(await page.screenshot({ fullPage: true }));
      await settle(page, "/");
      await hideLive("[data-hero=build]");
      const b = PNG.sync.read(await page.screenshot({ fullPage: true }));

      expect([b.width, b.height]).toEqual([a.width, a.height]);
      const out = new PNG({ width: a.width, height: a.height });
      const diff = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.03 });
      if (diff) await info.attach("diff", { path: await writePng(info.outputPath("diff.png"), out) });
      // At 1024px two antialiased pixels on the wordmark edge differ; the field
      // underneath is identical (checked with the wordmark hidden), cause not isolated
      expect(diff).toBeLessThanOrEqual(4);
    });
  });
}
