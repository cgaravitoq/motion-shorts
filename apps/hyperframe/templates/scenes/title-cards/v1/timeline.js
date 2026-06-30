function build_titleCards(tl, t, s, p) {
  tl.from(s(".tc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".tc-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);

  const cards = gsap.utils.toArray(s(".tc-card"));
  const n = cards.length;
  const STAGGER = 0.12;
  const ENTER = 0.95;

  tl.from(cards, { y: 34, autoAlpha: 0, scale: 0.96, duration: 0.5, stagger: STAGGER, ease: "power3.out" }, t + ENTER);

  cards.forEach((card) => tl.set(card, { transformOrigin: "50% 50%" }, 0));

  const settle = 0.5;
  cards.forEach((card, i) => {
    const at = t + ENTER + settle + i * STAGGER;
    const others = cards.filter((_, j) => j !== i);
    tl.to(card, { scale: 1.06, autoAlpha: 1, duration: 0.4, ease: "power2.out" }, at);
    if (others.length) {
      tl.to(others, { scale: 0.98, autoAlpha: 0.55, duration: 0.4, ease: "power2.out" }, at);
    }
  });

  const lastAt = t + ENTER + settle + (n - 1) * STAGGER + 0.5;
  tl.to(cards, { scale: 1.0, autoAlpha: 1.0, duration: 0.4, ease: "power2.inOut" }, lastAt);
}
