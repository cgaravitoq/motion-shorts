function build_codeOutput(tl, t, s, p) {
  tl.from(s(".co-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".co-title"), { y: 38, opacity: 0, duration: 0.58, ease: "power2.out" }, t + 0.4);
  tl.from(s(".co-window"), { y: 40, opacity: 0, scale: 0.94, transformOrigin: "50% 30%", duration: 0.6, ease: "power3.out" }, t + 0.75);
  tl.from(s(".co-line"), { x: -16, opacity: 0, duration: 0.28, stagger: 0.07, ease: "power2.out" }, t + 1.15);
  tl.from(s(".co-output"), { y: 30, opacity: 0, scale: 0.96, transformOrigin: "50% 40%", duration: 0.52, ease: "power3.out" }, t + 1.95);
  tl.from(s(".co-output__chip"), { scale: 0, opacity: 0, duration: 0.34, ease: "back.out(2)" }, t + 2.05);
  tl.from(s(".co-output__line"), { y: 16, opacity: 0, duration: 0.3, stagger: 0.08, ease: "power2.out" }, t + 2.25);
}
