function build_promoDetails(tl, t, s, p) {
  tl.set(s(".pdt-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set([s(".pdt-logo"), s(".pdt-title"), s(".pdt-cta")], { autoAlpha: 0, y: 42 }, 0);
  tl.set(s(".pdt-chip"), { autoAlpha: 0, y: 34 }, 0);

  tl.to(s(".pdt-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".pdt-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.3);
  tl.to(s(".pdt-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.42);
  tl.to(s(".pdt-chip"), { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.14, ease: "power3.out" }, t + 0.65);
  tl.to(s(".pdt-cta"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.4)" }, t + 1.1);
}
