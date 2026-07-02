function build_promoProductOutro(tl, t, s, p) {
  tl.set(s(".pou-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".pou-body"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".pou-art"), { autoAlpha: 0, x: 90, y: 90 }, 0);
  tl.set(s(".pou-logo"), { autoAlpha: 0, y: 20 }, 0);

  tl.to(s(".pou-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.15);
  tl.to(s(".pou-body"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.45);
  tl.to(s(".pou-art"), { autoAlpha: 1, x: 0, y: 0, duration: 0.85, ease: "power3.out" }, t + 0.6);
  tl.to(s(".pou-logo"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 1.0);

  tl.to(s(".pou-art-img"), { y: -16, duration: 2.6, ease: "none" }, t + 1.6);
}
