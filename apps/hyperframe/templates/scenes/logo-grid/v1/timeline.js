// logo-grid entrance choreography. See title-cards/v1/timeline.js for the contract.
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".lg-chip") -> "#scene-<id> .lg-chip"
//   p  = resolved params object for this scene
// Seek-safe only (from/to/fromTo/set). The monogram letter is materialised with
// a zero-duration tl.set at literal time 0 (textContent — the seek-safe primitive;
// the CSS disc can't read the label). Discs pop in first (back.out scale stagger),
// then the wordmark labels fade up. Elements that animate TO visible are hidden
// at literal 0 first so they materialise correctly at any seek position.
function build_logoGrid(tl, t, s, p) {
  const discs = gsap.utils.toArray(s(".lg-chip__disc"));
  const items = Array.isArray(p && p.items) ? p.items : [];
  discs.forEach((el, i) => {
    const label = items[i] && items[i].label ? String(items[i].label).trim() : "";
    const initial = label ? label.charAt(0).toUpperCase() : "";
    tl.set(el, { textContent: initial }, 0);
  });

  tl.from(s(".lg-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".lg-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);

  tl.set(s(".lg-chip"), { opacity: 0 }, 0);
  tl.set(s(".lg-chip__disc"), { scale: 0.4, opacity: 0 }, 0);
  tl.set(s(".lg-chip__label"), { y: 16, opacity: 0 }, 0);

  tl.to(s(".lg-chip"), { opacity: 1, duration: 0.01, stagger: 0.1 }, t + 0.95);
  tl.to(s(".lg-chip__disc"), { scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: "back.out(2)", transformOrigin: "50% 50%" }, t + 0.98);
  tl.to(s(".lg-chip__label"), { y: 0, opacity: 1, duration: 0.42, stagger: 0.1, ease: "power3.out" }, t + 1.18);
}
