function build_promoSignalToolbar(tl, t, s, p) {
  tl.set(s(".pst-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".pst-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".pst-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".pst-bar"), { autoAlpha: 0, y: 70 }, 0);
  tl.set(s(".pst-chip"), { autoAlpha: 0, y: 26, scale: 0.92 }, 0);
  tl.set(s(".pst-tool"), { autoAlpha: 0, scale: 0.4, rotation: -10 }, 0);

  tl.to(s(".pst-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".pst-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".pst-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);

  tl.to(s(".pst-bar"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.8);
  tl.to(s(".pst-tool"), { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.55, ease: "back.out(2.2)" }, t + 1.35);
  tl.to(s(".pst-chip"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, t + 1.6);

  tl.to(s(".pst-tool"), { scale: 1.1, duration: 0.3, ease: "sine.inOut" }, t + 2.5);
  tl.to(s(".pst-tool"), { scale: 1, duration: 0.35, ease: "sine.inOut" }, t + 2.8);
  tl.to(s(".pst-chip"), { y: -10, duration: 0.8, ease: "sine.inOut" }, t + 2.3);
  tl.to(s(".pst-chip"), { y: 0, duration: 0.8, ease: "sine.inOut" }, t + 3.1);
}
