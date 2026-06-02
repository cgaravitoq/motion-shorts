// timeline entrance choreography. See title-cards/v1/timeline.js for the contract.
// The vertical rail draws from the top (scaleY), then each event's dot and body
// stagger in. Stagger count adapts automatically to the resolved event count.
function build_timeline(tl, t, s, p) {
  tl.from(s(".tln-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".tln-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".tln-rail"), { scaleY: 0, duration: 0.7, ease: "power2.out" }, t + 0.85);
  tl.from(s(".tln-event__dot"), { scale: 0, opacity: 0, duration: 0.42, stagger: 0.14, ease: "back.out(2)", transformOrigin: "50% 50%" }, t + 1.0);
  tl.from(s(".tln-event__body"), { x: 36, opacity: 0, duration: 0.5, stagger: 0.14, ease: "power3.out" }, t + 1.08);
}
