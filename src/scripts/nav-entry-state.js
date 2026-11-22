(() => {
  let from = "";
  try {
    from = new URL(document.referrer).origin;
  } catch {}
  const [nav] = performance.getEntriesByType("navigation");
  if (from === location.origin && nav?.type !== "reload") document.documentElement.dataset.internalNav = "";

  let restored = false;
  addEventListener("pageshow", (e) => {
    restored = e.persisted;
  });
  // Back and forward: iOS animates its own swipe, and the page transition would play over it
  addEventListener("pagereveal", (e) => {
    const traverse =
      restored || nav?.type === "back_forward" || window.navigation?.activation?.navigationType === "traverse";
    if (traverse && e.viewTransition) {
      e.viewTransition.ready.catch(() => {}); // skipping rejects it: expected, not an error
      e.viewTransition.skipTransition();
    }
  });
})();
