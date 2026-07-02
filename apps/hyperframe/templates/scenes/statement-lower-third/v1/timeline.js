function build_statementLowerThird(tl, t, s, p) {
  const attrOpacity = 1;

  tl.set(s(".slt-statement"), { yPercent: 110, opacity: 0 }, 0);
  tl.set(s(".slt-attribution"), { y: 18, opacity: 0 }, 0);

  tl.from(s(".slt-image"), { opacity: 0, duration: 0.7, ease: "power2.out" }, t);
  tl.from(s(".slt-scrim"), { opacity: 0, duration: 0.7, ease: "power2.out" }, t);

  tl.to(s(".slt-statement"), { yPercent: 0, opacity: 1, duration: 0.72, ease: "power3.out" }, t + 0.35);
  tl.to(s(".slt-attribution"), { y: 0, opacity: attrOpacity, duration: 0.5, ease: "power2.out" }, t + 0.85);
}
