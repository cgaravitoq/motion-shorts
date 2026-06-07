// title-cards entrance choreography.
// Contract: build_<builder>(tl, t, s, p)
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".tc-card") -> "#scene-<id> .tc-card"
//   p  = resolved params object for this scene
// All positions are t + localOffset. Use only seek-safe constructs
// (from/to/fromTo/set). The assembler reveals/hides the section; this fn only
// animates the scene's own content.
function build_titleCards(tl, t, s, p) {
  tl.from(s(".tc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".tc-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);

  const cards = gsap.utils.toArray(s(".tc-card"));
  const n = cards.length;
  const STAGGER = 0.12;
  const ENTER = 0.95;

  tl.from(cards, { y: 34, autoAlpha: 0, scale: 0.96, duration: 0.5, stagger: STAGGER, ease: "power3.out" }, t + ENTER);

  // Seek-safe sequential spotlight (transform + opacity only — never width/flex,
  // so the equal repeat(N,1fr) row never reflows). Beats are derived from the
  // existing entrance stagger: as card i settles it becomes the focal point
  // (scale 1.06, full opacity) while siblings dim; the last card hands focus
  // back to all cards at 1.0 / 1.0.
  cards.forEach((card) => tl.set(card, { transformOrigin: "50% 50%" }, 0));

  const settle = 0.5; // entrance duration; card i is settled at ENTER + settle + i*STAGGER
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
