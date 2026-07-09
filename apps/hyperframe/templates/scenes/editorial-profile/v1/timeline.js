function build_editorialProfile(tl, t, s, p) {
  tl.set([s(".edp-brand"), s(".edp-kicker"), s(".edp-name"), s(".edp-tagline"), s(".edp-price"), s(".edp-note"), s(".edp-counter")], { autoAlpha: 0, y: 28 }, 0);
  tl.set(s(".edp-art"), { autoAlpha: 0, scale: 0.84, rotation: -8, transformOrigin: "50% 50%" }, 0);
  tl.set(s(".edp-divider"), { scaleX: 0 }, 0);
  tl.set(s(".edp-feature-text"), { autoAlpha: 0, x: -28 }, 0);

  tl.to(s(".edp-brand"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.05);
  tl.to(s(".edp-art"), { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.95, ease: "back.out(1.25)" }, t + 0.08);
  tl.to(s(".edp-art"), { scale: 1.035, rotation: 3, duration: 6.4, ease: "none" }, t + 0.95);
  tl.to(s(".edp-kicker"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.3);
  tl.to(s(".edp-name"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.45);
  tl.to(s(".edp-tagline"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.8);
  tl.to(s(".edp-divider"), { scaleX: 1, duration: 0.5, stagger: 0.18, ease: "power2.out" }, t + 1.05);
  tl.to(s(".edp-feature-text"), { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.18, ease: "power3.out" }, t + 1.18);
  tl.to(s(".edp-price"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.35)" }, t + 1.8);
  tl.to(s(".edp-note"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, t + 2.15);
  tl.to(s(".edp-counter"), { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, t + 2.25);
}
