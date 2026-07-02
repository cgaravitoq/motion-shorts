function build_promoHero(tl, t, s, p) {
  tl.set(s(".pmh-bg"), { autoAlpha: 0 }, 0);
  tl.set(s(".pmh-photo"), { autoAlpha: 0, scale: 1.04, transformOrigin: "50% 0%" }, 0);
  tl.set(s(".pmh-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set([s(".pmh-logo"), s(".pmh-title"), s(".pmh-body"), s(".pmh-cta")], { autoAlpha: 0, y: 42 }, 0);

  tl.to(s(".pmh-bg"), { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, t);
  tl.to(s(".pmh-photo"), { autoAlpha: 1, scale: 1, duration: 0.85, ease: "power3.out" }, t + 0.1);
  tl.to(s(".pmh-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.45);
  tl.to(s(".pmh-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.55);
  tl.to(s(".pmh-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.68);
  tl.to(s(".pmh-body"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.82);
  tl.to(s(".pmh-cta"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.4)" }, t + 0.98);
}
