// promo-highlight-hook entrance choreography. Seek-safe only (from/to/set;
// no callbacks). Logo fades, the marker headline rises, the subtitle
// follows, the art canvas rises from the bottom edge with a slow settle.
function build_promoHighlightHook(tl, t, s, p) {
  tl.set(s(".phk-logo"), { autoAlpha: 0, y: -20 }, 0);
  tl.set([s(".phk-title"), s(".phk-subtitle")], { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".phk-art"), { autoAlpha: 0, y: 90 }, 0);

  tl.to(s(".phk-logo"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.1);
  tl.to(s(".phk-title"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.25);
  tl.to(s(".phk-subtitle"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.55);
  tl.to(s(".phk-art"), { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, t + 0.7);
}
