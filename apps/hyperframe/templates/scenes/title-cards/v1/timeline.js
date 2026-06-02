// title-cards entrance choreography.
// Contract: build_<builder>(tl, t, s, p)
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".tc-card") -> "#scene-<id> .tc-card"
//   p  = resolved params object for this scene
// All positions are t + localOffset. Use only seek-safe constructs
// (from/to/fromTo/set). The assembler reveals/hides the section; this fn only
// animates the scene's own content.
function build_titleCards(tl, t, s, p) {
  tl.from(s(".tc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".tc-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".tc-card"), { y: 34, opacity: 0, scale: 0.96, duration: 0.5, stagger: 0.12, ease: "power3.out" }, t + 0.95);
}
