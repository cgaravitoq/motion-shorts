// flow entrance choreography. See title-cards/v1/timeline.js for the contract.
// Title in, then step nodes stagger down the rail while the connector segments
// draw between them. Connectors reveal FROM a hidden scaleY:0 state, so they are
// hidden at literal time 0 first (seek-safe).
function build_flow(tl, t, s, p) {
  tl.set(s(".fl-step__connector"), { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" }, 0);
  tl.from(s(".fl-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".fl-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".fl-step"), { y: 36, opacity: 0, duration: 0.5, stagger: 0.16, ease: "power3.out" }, t + 0.95);
  tl.from(s(".fl-step__badge"), { scale: 0.7, duration: 0.42, stagger: 0.16, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 1.02);
  tl.to(s(".fl-step__connector"), { scaleY: 1, autoAlpha: 1, duration: 0.34, stagger: 0.16, ease: "power2.out" }, t + 1.2);
}
