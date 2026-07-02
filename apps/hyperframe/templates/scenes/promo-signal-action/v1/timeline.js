function build_promoSignalAction(tl, t, s, p) {
  tl.set(s(".psa-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".psa-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".psa-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".psa-cta"), { autoAlpha: 0, y: 60 }, 0);
  tl.set(s(".psa-cursor"), { autoAlpha: 0, x: 240, y: 280 }, 0);
  tl.set(s(".psa-cta-icon"), { rotation: 0 }, 0);

  tl.to(s(".psa-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".psa-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".psa-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);
  tl.to(s(".psa-cta"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.75);

  tl.to(s(".psa-cursor"), { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, t + 1.2);
  tl.to(s(".psa-cursor"), { x: 0, y: 0, duration: 1.0, ease: "power2.inOut" }, t + 1.2);
  tl.to(s(".psa-cursor"), { scale: 0.88, duration: 0.12, ease: "power2.in" }, t + 2.25);
  tl.to(s(".psa-cursor"), { scale: 1, duration: 0.3, ease: "back.out(2.5)" }, t + 2.37);
  tl.to(s(".psa-cta"), { scale: 0.95, duration: 0.12, ease: "power2.in" }, t + 2.25);
  tl.to(s(".psa-cta"), { scale: 1, duration: 0.35, ease: "back.out(2)" }, t + 2.37);
  tl.to(s(".psa-cta-icon"), { rotation: 360, duration: 0.9, ease: "power1.inOut" }, t + 2.4);
}
