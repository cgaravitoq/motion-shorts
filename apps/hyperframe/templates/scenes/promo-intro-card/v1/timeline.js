// promo-intro-card entrance choreography. See title-cards/v1/timeline.js for
// the contract. Seek-safe only (from/to/set; no callbacks). The photo card
// settles in as a group; badge pops at its notch; the speaker fades; logo,
// headline and date cascade up. .pin-col keeps its CSS translateX(-50%), so
// only its children are animated.
function build_promoIntroCard(tl, t, s, p) {
  tl.set(s(".pin-card"), { autoAlpha: 0, scale: 0.965, transformOrigin: "50% 40%" }, 0);
  tl.set(s(".pin-badge"), { autoAlpha: 0, y: -20 }, 0);
  tl.set(s(".pin-speaker"), { autoAlpha: 0 }, 0);
  tl.set([s(".pin-logo"), s(".pin-title"), s(".pin-date")], { autoAlpha: 0, y: 42 }, 0);

  tl.to(s(".pin-card"), { autoAlpha: 1, scale: 1, duration: 0.8, ease: "power3.out" }, t + 0.05);
  tl.to(s(".pin-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.4);
  tl.to(s(".pin-speaker"), { autoAlpha: 1, duration: 0.55, ease: "power2.out" }, t + 0.5);
  tl.to(s(".pin-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);
  tl.to(s(".pin-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.72);
  tl.to(s(".pin-date"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.86);
}
