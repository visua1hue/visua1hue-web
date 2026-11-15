// Sets html[data-nav] when this page was opened from another page of the site, so first-visit
// entrance animations don't replay. A reload counts as a first visit. Loaded as a blocking classic
// script in <head> (Layout.astro), so it runs before the first paint; a file, not inline, because
// the CSP allows no inline scripts. Plain JS: it ships as-is, untranspiled
(() => {
  let from = "";
  try {
    from = new URL(document.referrer).origin;
  } catch {
    // no referrer: a direct visit
  }
  const [nav] = performance.getEntriesByType("navigation");
  if (from === location.origin && nav?.type !== "reload") document.documentElement.dataset.nav = "";
})();
