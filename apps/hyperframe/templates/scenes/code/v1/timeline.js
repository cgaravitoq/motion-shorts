// code / terminal-window entrance choreography. See title-cards/v1/timeline.js
// for the contract. The window scales in, then the code lines reveal with a
// quick typing-like stagger. Selectors are scoped via s(); positions are t+off.
function build_code(tl, t, s, p) {
  tl.from(s(".cd-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".cd-title"), { y: 36, opacity: 0, duration: 0.58, ease: "power2.out" }, t + 0.4);
  tl.from(s(".cd-window"), { y: 40, opacity: 0, scale: 0.94, transformOrigin: "50% 30%", duration: 0.6, ease: "power3.out" }, t + 0.75);
  tl.from(s(".cd-line"), { x: -16, opacity: 0, duration: 0.28, stagger: 0.07, ease: "power2.out" }, t + 1.15);
}
