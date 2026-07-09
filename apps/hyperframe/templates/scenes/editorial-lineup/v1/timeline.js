function build_editorialLineup(tl, t, s, p) {
  tl.set([s(".edl-brand"), s(".edl-kicker"), s(".edl-title"), s(".edl-counter")], { autoAlpha: 0, y: 26 }, 0);
  tl.set(s(".edl-card"), { autoAlpha: 0, y: 70, scale: 0.96, transformOrigin: "50% 50%" }, 0);

  tl.to(s(".edl-brand"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.05);
  tl.to(s(".edl-kicker"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.18);
  tl.to(s(".edl-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.35);
  tl.to(s(".edl-card"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.24, ease: "back.out(1.2)" }, t + 0.8);
  tl.to(s(".edl-counter"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 1.5);
}
