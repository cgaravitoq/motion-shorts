function build_dashboardComposite(tl, t, s, p) {
  tl.set(s(".dc-tile__fill"), { scaleX: 0, transformOrigin: "0% 50%" }, 0);
  tl.set(s(".dc-tile__delta"), { opacity: 0 }, 0);
  tl.from(s(".dc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".dc-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".dc-tile"), { y: 40, opacity: 0, scale: 0.95, duration: 0.55, stagger: 0.14, ease: "power3.out" }, t + 0.95);
  tl.from(s(".dc-tile__value"), { y: 16, opacity: 0, duration: 0.46, stagger: 0.14, ease: "back.out(1.6)" }, t + 1.15);
  tl.fromTo(s(".dc-tile__fill"), { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.14, ease: "power2.out" }, t + 1.35);
  tl.fromTo(s(".dc-tile__delta"), { opacity: 0, y: 12, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.14, ease: "back.out(1.7)" }, t + 1.85);
}
