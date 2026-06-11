// promo-signal-cards entrance + card-pick choreography. Seek-safe only
// (from/to/set; no callbacks). After the skeleton cascade the strip slides
// horizontally while the highlight travels card to card, like picking one.
function build_promoSignalCards(tl, t, s, p) {
  tl.set(s(".psc-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".psc-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".psc-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".psc-strip"), { autoAlpha: 0, y: 80, x: 120 }, 0);
  tl.set(s(".psc-card"), { opacity: 0.42, scale: 1 }, 0);

  tl.to(s(".psc-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".psc-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".psc-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);
  tl.to(s(".psc-strip"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.7);

  // highlight travels: first card lit while the strip sits right, then the
  // strip slides left as the pick moves to the middle and last cards.
  tl.to(s(".psc-card:nth-child(1)"), { opacity: 1, scale: 1.04, duration: 0.35, ease: "power2.out" }, t + 1.1);
  tl.to(s(".psc-card:nth-child(1)"), { opacity: 0.42, scale: 1, duration: 0.35, ease: "power2.inOut" }, t + 2.0);
  tl.to(s(".psc-strip"), { x: 0, duration: 0.7, ease: "power2.inOut" }, t + 1.95);
  tl.to(s(".psc-card:nth-child(2)"), { opacity: 1, scale: 1.04, duration: 0.35, ease: "power2.out" }, t + 2.15);
  tl.to(s(".psc-card:nth-child(2)"), { opacity: 0.42, scale: 1, duration: 0.35, ease: "power2.inOut" }, t + 3.05);
  tl.to(s(".psc-strip"), { x: -120, duration: 0.7, ease: "power2.inOut" }, t + 3.0);
  tl.to(s(".psc-card:nth-child(3)"), { opacity: 1, scale: 1.04, duration: 0.35, ease: "power2.out" }, t + 3.2);
}
