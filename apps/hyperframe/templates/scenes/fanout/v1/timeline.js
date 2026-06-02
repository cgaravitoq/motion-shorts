// fanout entrance choreography. See flow/v1/timeline.js for the connector pattern.
// Source pops in, fan-out connectors draw (scaleY) and worker chips stagger in,
// then converge connectors draw and the synth node pops. Connectors reveal FROM a
// hidden scaleY:0 state, so they are hidden at literal time 0 first (seek-safe).
function build_fanout(tl, t, s, p) {
  tl.set(s(".fo-link--out"), { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" }, 0);
  tl.set(s(".fo-link--in"), { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 100%" }, 0);

  tl.from(s(".fo-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".fo-title"), { y: 42, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);

  tl.from(s(".fo-node--source"), { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 0.3);
  tl.to(s(".fo-link--out"), { scaleY: 1, autoAlpha: 1, duration: 0.34, stagger: 0.08, ease: "power2.out" }, t + 0.7);
  tl.from(s(".fo-node--worker"), { y: 30, scale: 0.78, autoAlpha: 0, duration: 0.46, stagger: 0.12, ease: "back.out(1.6)", transformOrigin: "50% 50%" }, t + 1.0);
  tl.to(s(".fo-link--in"), { scaleY: 1, autoAlpha: 1, duration: 0.34, stagger: 0.08, ease: "power2.out" }, t + 1.6);
  tl.from(s(".fo-node--synth"), { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 2.0);
}
