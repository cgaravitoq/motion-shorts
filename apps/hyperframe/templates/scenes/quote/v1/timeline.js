// quote entrance choreography. See title-cards/v1/timeline.js for the contract.
function build_quote(tl, t, s, p) {
  tl.from(s(".qt-mark"), { y: 24, scale: 0.7, opacity: 0, duration: 0.55, ease: "back.out(1.7)", transformOrigin: "0% 100%" }, t + 0.15);
  tl.from(s(".qt-quote"), { y: 40, opacity: 0, duration: 0.7, ease: "power3.out" }, t + 0.45);
  tl.from([s(".qt-attribution__name"), s(".qt-attribution__role")], { x: -28, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, t + 1.05);
}
