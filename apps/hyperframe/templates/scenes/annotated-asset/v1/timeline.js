function build_annotatedAsset(tl, t, s, p) {
  tl.from(s(".ax-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".ax-title"), { y: 40, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);
  tl.from(s(".ax-frame"), { y: 32, opacity: 0, scale: 0.97, duration: 0.6, ease: "power3.out" }, t + 0.7);
  tl.from(s(".ax-pin__dot"), { scale: 0, opacity: 0, transformOrigin: "center center", duration: 0.46, stagger: 0.14, ease: "back.out(2)" }, t + 1.35);
  tl.from(s(".ax-pin__chip"), { x: -16, opacity: 0, duration: 0.4, stagger: 0.14, ease: "power2.out" }, t + 1.5);
}
