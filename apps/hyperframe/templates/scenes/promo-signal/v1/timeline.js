function build_promoSignal(tl, t, s, p) {
  tl.set(s(".psg-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".psg-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".psg-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".psg-art"), { autoAlpha: 0, y: 90 }, 0);

  tl.to(s(".psg-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".psg-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".psg-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);
  tl.to(s(".psg-art"), { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, t + 0.75);
}
