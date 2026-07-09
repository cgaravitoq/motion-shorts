function build_editorialHook(tl, t, s, p) {
  tl.set([s(".edh-brand"), s(".edh-kicker"), s(".edh-title"), s(".edh-subtitle"), s(".edh-counter")], { autoAlpha: 0, y: 30 }, 0);
  tl.set(s(".edh-art"), { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%" }, 0);

  tl.to(s(".edh-brand"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, t + 0.05);
  tl.to(s(".edh-kicker"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" }, t + 0.25);
  tl.to(s(".edh-title"), { autoAlpha: 1, y: 0, duration: 0.75, ease: "power3.out" }, t + 0.45);
  tl.to(s(".edh-subtitle"), { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, t + 0.9);
  tl.to(s(".edh-art"), { autoAlpha: 1, scale: 1, duration: 0.9, ease: "power3.out" }, t + 0.7);
  tl.to(s(".edh-art"), { scale: 1.035, duration: 4.8, ease: "none" }, t + 1.2);
  tl.to(s(".edh-counter"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 1.1);
}
