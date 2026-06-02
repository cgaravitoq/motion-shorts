// outro entrance choreography. See title-cards/v1/timeline.js for the contract.
// Special: this scene animates its text TO visible (tl.to), so it hides those
// elements at literal time 0 first. It also fades the global #brand-corner
// watermark out just before the lockup reveals. The assembler still performs
// the generic section crossfade-in at the scene's window start.
function build_outro(tl, t, s, p) {
  tl.set([s(".brand-outro__name"), s(".brand-outro__tagline"), s(".brand-outro__source")], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)", transformOrigin: "50% 50%" }, 0);
  tl.to("#brand-corner", { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, t - 0.55);
  tl.to(s(".brand-outro__aura"), { autoAlpha: 1, scale: 1, duration: 0.65, ease: "power2.out" }, t + 0.2);
  tl.to(s(".brand-outro__piece"), { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.55, stagger: 0.08, ease: "back.out(1.6)", startAt: { x: -24, y: 20, scale: 0.92 } }, t + 0.3);
  tl.to([s(".brand-outro__name"), s(".brand-outro__tagline"), s(".brand-outro__source")], { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, stagger: 0.1, ease: "power3.out" }, t + 0.62);
  tl.to(s(".brand-outro__mark"), { scale: 1.04, duration: 0.32, ease: "power2.out", overwrite: "auto" }, t + 0.8);
  tl.to(s(".brand-outro__mark"), { scale: 1, duration: 0.34, ease: "power2.inOut", overwrite: "auto" }, t + 1.12);
}
