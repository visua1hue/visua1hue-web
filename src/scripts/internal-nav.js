(() => {
  let from = "";
  try {
    from = new URL(document.referrer).origin;
  } catch {}
  const [nav] = performance.getEntriesByType("navigation");
  if (from === location.origin && nav?.type !== "reload") document.documentElement.dataset.internalNav = "";
})();
