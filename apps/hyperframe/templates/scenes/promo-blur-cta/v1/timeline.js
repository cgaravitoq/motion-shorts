// promo-blur-cta entrance choreography. See title-cards/v1/timeline.js for the
// contract. Seek-safe only (from/to/set; no callbacks). The blurred bg fades
// in; the avatar pops; the speaker fades (it keeps its CSS translateY(-50%),
// so only autoAlpha is animated there); the lower block cascades up.
function build_promoBlurCta(tl, t, s, p) {
  tl.set(s(".pbc-bg"), { autoAlpha: 0 }, 0);
  tl.set(s(".pbc-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".pbc-avatar"), { autoAlpha: 0, scale: 0.55, transformOrigin: "50% 50%" }, 0);
  tl.set(s(".pbc-speaker"), { autoAlpha: 0 }, 0);
  tl.set([s(".pbc-logo"), s(".pbc-title"), s(".pbc-body"), s(".pbc-cta")], { autoAlpha: 0, y: 42 }, 0);

  tl.to(s(".pbc-bg"), { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, t);
  tl.to(s(".pbc-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.3);
  tl.to(s(".pbc-avatar"), { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, t + 0.4);
  tl.to(s(".pbc-speaker"), { autoAlpha: 1, duration: 0.55, ease: "power2.out" }, t + 0.55);
  tl.to(s(".pbc-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.65);
  tl.to(s(".pbc-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.78);
  tl.to(s(".pbc-body"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.92);
  tl.to(s(".pbc-cta"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.4)" }, t + 1.08);
}
