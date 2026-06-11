// promo-signal-messages entrance + float choreography. Seek-safe only
// (from/to/set; no callbacks). Cards pop in one by one down the staircase,
// then drift gently out of phase like floating notifications.
function build_promoSignalMessages(tl, t, s, p) {
  tl.set(s(".psm-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".psm-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".psm-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".psm-card"), { autoAlpha: 0, y: 60, scale: 0.88 }, 0);

  tl.to(s(".psm-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".psm-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".psm-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);

  tl.to(s(".psm-card:nth-child(1)"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, t + 0.85);
  tl.to(s(".psm-card:nth-child(2)"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, t + 1.2);
  tl.to(s(".psm-card:nth-child(3)"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, t + 1.55);

  // gentle out-of-phase float
  tl.to(s(".psm-card:nth-child(1)"), { y: -10, duration: 0.9, ease: "sine.inOut" }, t + 2.3);
  tl.to(s(".psm-card:nth-child(1)"), { y: 0, duration: 0.9, ease: "sine.inOut" }, t + 3.2);
  tl.to(s(".psm-card:nth-child(2)"), { y: -12, duration: 0.9, ease: "sine.inOut" }, t + 2.6);
  tl.to(s(".psm-card:nth-child(2)"), { y: 0, duration: 0.9, ease: "sine.inOut" }, t + 3.5);
  tl.to(s(".psm-card:nth-child(3)"), { y: -8, duration: 0.9, ease: "sine.inOut" }, t + 2.45);
  tl.to(s(".psm-card:nth-child(3)"), { y: 0, duration: 0.9, ease: "sine.inOut" }, t + 3.35);
}
