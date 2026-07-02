function build_promoQuote(tl, t, s, p) {
  tl.set(s(".pqt-bg"), { autoAlpha: 0 }, 0);
  tl.set(s(".pqt-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".pqt-avatar"), { autoAlpha: 0, scale: 0.55, transformOrigin: "50% 50%" }, 0);
  tl.set(s(".pqt-speaker"), { autoAlpha: 0 }, 0);
  tl.set([s(".pqt-logo"), s(".pqt-quote")], { autoAlpha: 0, y: 42 }, 0);

  tl.to(s(".pqt-bg"), { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, t);
  tl.to(s(".pqt-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.3);
  tl.to(s(".pqt-avatar"), { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, t + 0.4);
  tl.to(s(".pqt-speaker"), { autoAlpha: 1, duration: 0.55, ease: "power2.out" }, t + 0.55);
  tl.to(s(".pqt-logo"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.65);
  tl.to(s(".pqt-quote"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.78);
}
