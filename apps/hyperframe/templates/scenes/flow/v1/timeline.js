// flow entrance choreography. See title-cards/v1/timeline.js for the contract.
// Title in, then step nodes stagger along the rail while a SINGLE spine draws
// through the badge column. The spine is one fixed-px element; it reveals from a
// hidden scaleX/Y:0 state (set at literal time 0 first, seek-safe) and grows via
// a to() tween that materialises at any seek position -> byte-identical render.
// Desktop = horizontal spine (scaleX, origin left), portrait = vertical spine
// (scaleY, origin top); the transform-origin matches the CSS for each format.
function build_flow(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  const drawAxis = isDesktop ? "scaleX" : "scaleY";
  const drawOrigin = isDesktop ? "0% 50%" : "50% 0%";
  tl.set(s(".fl-spine"), { [drawAxis]: 0, autoAlpha: 0, transformOrigin: drawOrigin }, 0);
  tl.from(s(".fl-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".fl-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".fl-step"), { y: 36, opacity: 0, duration: 0.5, stagger: 0.16, ease: "power3.out" }, t + 0.95);
  tl.from(s(".fl-step__badge"), { scale: 0.7, duration: 0.42, stagger: 0.16, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 1.02);
  tl.to(s(".fl-spine"), { [drawAxis]: 1, autoAlpha: 1, duration: 0.6, ease: "power2.out" }, t + 1.2);
}
