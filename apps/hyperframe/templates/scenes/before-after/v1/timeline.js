function build_beforeAfter(tl, t, s, p) {
  var wipeDur = 1.1;
  var wipeAt = t + 0.85;

  tl.from(s(".ba-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".ba-title"), { y: 40, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);
  tl.from(s(".ba-frame"), { y: 36, opacity: 0, scale: 0.97, duration: 0.6, ease: "power3.out" }, t + 0.55);

  tl.set(s(".ba-reveal"), { clipPath: "inset(0 100% 0 0)" }, 0);
  tl.set(s(".ba-divider"), { left: "0%", opacity: 0 }, 0);
  tl.set(s(".ba-chip--before"), { opacity: 0, y: -12 }, 0);
  tl.set(s(".ba-chip--after"), { opacity: 0, y: 12 }, 0);

  tl.to(s(".ba-chip--before"), { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.6);
  tl.to(s(".ba-divider"), { opacity: 1, duration: 0.3, ease: "power1.out" }, wipeAt - 0.1);
  tl.to(s(".ba-reveal"), { clipPath: "inset(0 0% 0 0)", duration: wipeDur, ease: "power2.inOut" }, wipeAt);
  tl.to(s(".ba-divider"), { left: "100%", duration: wipeDur, ease: "power2.inOut" }, wipeAt);
  tl.to(s(".ba-divider"), { autoAlpha: 0, duration: 0.25, ease: "power1.out" }, wipeAt + wipeDur);
  tl.to(s(".ba-chip--after"), { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, wipeAt + wipeDur - 0.2);
}
