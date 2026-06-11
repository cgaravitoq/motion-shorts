// promo-card-speaker entrance choreography. See title-cards/v1/timeline.js for
// the contract. Seek-safe only (from/to/set; no callbacks). The photo card
// settles in first; badge and speaker fade (the speaker keeps its CSS
// translateY(-50%), so only autoAlpha is animated there); the lower block
// cascades up.
function build_promoCardSpeaker(tl, t, s, p) {
  tl.set(s(".pcs-photo"), { autoAlpha: 0, scale: 0.965, transformOrigin: "50% 40%" }, 0);
  tl.set(s(".pcs-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".pcs-speaker"), { autoAlpha: 0 }, 0);
  tl.set([s(".pcs-logo"), s(".pcs-title"), s(".pcs-body"), s(".pcs-cta")], { autoAlpha: 0, y: 42 }, 0);

  tl.to(s(".pcs-photo"), { autoAlpha: 1, scale: 1, duration: 0.8, ease: "power3.out" }, t + 0.05);
  tl.to(s(".pcs-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.35);
  tl.to(s(".pcs-speaker"), { autoAlpha: 1, duration: 0.55, ease: "power2.out" }, t + 0.45);
  tl.to(s(".pcs-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.55);
  tl.to(s(".pcs-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.68);
  tl.to(s(".pcs-body"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.82);
  tl.to(s(".pcs-cta"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.4)" }, t + 0.98);
}
