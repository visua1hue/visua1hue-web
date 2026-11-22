(() => {
  const nav = performance.getEntriesByType("navigation")[0]?.type;

  // Entrance plays only on a fresh arrival. Reload and back/forward skip it too: the browser holds the
  // old paint until the new one, so hiding the text flashed
  const sameSite = document.referrer.startsWith(`${location.origin}/`);
  if (sameSite || nav === "reload" || nav === "back_forward") document.documentElement.dataset.noEntrance = "";

  // Back/forward: no page transition; iOS animates its own swipe
  let restored = false;
  addEventListener("pageshow", (e) => (restored = e.persisted));
  addEventListener("pagereveal", ({ viewTransition: vt }) => {
    const back = restored || nav === "back_forward" || window.navigation?.activation?.navigationType === "traverse";
    if (!vt || !back) return;
    vt.ready.catch(() => {}); // skipping rejects ready
    vt.skipTransition();
  });
})();
