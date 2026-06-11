// promo-agenda entrance choreography. See title-cards/v1/timeline.js for the
// contract. Seek-safe only (from/to/set; no callbacks). Badge drops in, the
// title rises, topic rows cascade with a stagger, the footer follows.
function build_promoAgenda(tl, t, s, p) {
  tl.set(s(".pag-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set([s(".pag-title"), s(".pag-footer")], { autoAlpha: 0, y: 42 }, 0);
  tl.set(s(".pag-item"), { autoAlpha: 0, y: 34 }, 0);

  tl.to(s(".pag-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".pag-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".pag-item"), { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.14, ease: "power3.out" }, t + 0.6);
  tl.to(s(".pag-footer"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out" }, t + 1.05);
}
