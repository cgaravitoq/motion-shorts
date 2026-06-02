// social-card entrance choreography. See title-cards/v1/timeline.js for the contract.
// The card is the primary object: it scales + fades in, then its head, body and
// engagement row reveal in sequence. Optional eyebrow/title lead in first.
function build_socialCard(tl, t, s, p) {
  tl.from(s(".soc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".soc-title"), { y: 40, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);
  tl.from(s(".soc-card"), { y: 48, opacity: 0, scale: 0.92, transformOrigin: "50% 50%", duration: 0.62, ease: "power3.out" }, t + 0.85);
  tl.from(s(".soc-card__head"), { y: 16, opacity: 0, duration: 0.45, ease: "power2.out" }, t + 1.2);
  tl.from(s(".soc-card__body"), { y: 22, opacity: 0, duration: 0.5, ease: "power2.out" }, t + 1.42);
  tl.from(s(".soc-card__stat"), { y: 14, opacity: 0, duration: 0.42, stagger: 0.1, ease: "power2.out" }, t + 1.7);
}
