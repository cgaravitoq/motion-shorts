function build_editorialCheatSheet(tl, t, s, p) {
  tl.set([s(".edc-brand"), s(".edc-kicker"), s(".edc-title"), s(".edc-note"), s(".edc-counter")], { autoAlpha: 0, y: 24 }, 0);
  tl.set(s(".edc-choice"), { autoAlpha: 0, x: -44 }, 0);

  tl.to(s(".edc-brand"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.05);
  tl.to(s(".edc-kicker"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, t + 0.18);
  tl.to(s(".edc-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.35);

  const choices = gsap.utils.toArray(s(".edc-choice"));
  const revealAt = [1.2, 4.8, 8.0, 10.8];
  choices.forEach((choice, index) => {
    tl.to(choice, { autoAlpha: 1, x: 0, duration: 0.65, ease: "back.out(1.25)" }, t + revealAt[index]);
  });

  tl.to(s(".edc-note"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 12.0);
  tl.to(s(".edc-counter"), { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, t + 12.3);
}
