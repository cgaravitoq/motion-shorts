// hook entrance choreography. See title-cards/v1/timeline.js for the contract.
function build_hook(tl, t, s, p) {
  tl.from(s(".hk-eyebrow"), { y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }, t + 0.15);
  tl.from(s(".hk-title"), { y: 54, opacity: 0, duration: 0.7, ease: "power3.out" }, t + 0.4);
  tl.from(s(".hk-subtitle"), { y: 30, opacity: 0, duration: 0.55, ease: "power2.out" }, t + 0.95);
  tl.from(s(".hk-image"), { y: 44, opacity: 0, scale: 0.96, duration: 0.75, ease: "power3.out" }, t + 0.95);
}
