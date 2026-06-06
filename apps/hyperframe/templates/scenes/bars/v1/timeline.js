// bars entrance choreography. See title-cards/v1/timeline.js for the contract.
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".br-fill") -> "#scene-<id> .br-fill"
//   p  = resolved params object for this scene (use p.bars for data-driven motion)
// Seek-safe only (from/to/fromTo/set). Each fill has width:var(--pct) and grows
// via scaleX 0 -> 1 (transform-origin left); fills are hidden at literal 0 first.
function build_bars(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  const axis = isDesktop ? "scaleY" : "scaleX";
  const origin = isDesktop ? "50% 100%" : "0% 50%";
  tl.set(s(".br-fill"), { [axis]: 0, transformOrigin: origin }, 0);
  tl.from(s(".br-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".br-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".br-row"), { y: 30, opacity: 0, duration: 0.5, stagger: 0.14, ease: "power3.out" }, t + 0.9);
  tl.fromTo(s(".br-fill"), { [axis]: 0 }, { [axis]: 1, duration: 0.8, stagger: 0.14, ease: "power2.out" }, t + 0.9);
  tl.from(s(".br-value"), { y: 14, opacity: 0, duration: 0.46, stagger: 0.14, ease: "back.out(1.6)" }, t + 1.1);
}
