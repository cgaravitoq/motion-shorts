function build_editorialOutro(tl, t, s, p) {
  tl.set([s(".edo-brand"), s(".edo-kicker"), s(".edo-title"), s(".edo-subtitle"), s(".edo-counter")], { autoAlpha: 0, y: 34 }, 0);

  tl.to(s(".edo-brand"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.05);
  tl.to(s(".edo-kicker"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.18);
  tl.to(s(".edo-title"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.35);
  tl.to(s(".edo-subtitle"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.85);
  tl.to(s(".edo-counter"), { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, t + 1.1);
}
