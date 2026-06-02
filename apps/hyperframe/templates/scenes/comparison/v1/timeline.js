// comparison entrance choreography. See title-cards/v1/timeline.js for the contract.
// Two columns reveal (left then accented right), VS badge pops, and each
// column's points stagger in. Class+stagger entrances adapt to variable
// point counts automatically.
function build_comparison(tl, t, s, p) {
  tl.from(s(".cmp-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".cmp-title"), { y: 40, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);
  tl.from(s(".cmp-col--a"), { x: -40, opacity: 0, duration: 0.55, ease: "power3.out" }, t + 0.75);
  tl.from(s(".cmp-col--b"), { x: 40, opacity: 0, duration: 0.55, ease: "power3.out" }, t + 0.9);
  tl.from(s(".cmp-divider__vs"), { scale: 0.4, opacity: 0, duration: 0.45, ease: "back.out(1.8)" }, t + 1.1);
  tl.from(s(".cmp-col--a .cmp-point"), { y: 24, opacity: 0, duration: 0.42, stagger: 0.1, ease: "power3.out" }, t + 1.25);
  tl.from(s(".cmp-col--b .cmp-point"), { y: 24, opacity: 0, duration: 0.42, stagger: 0.1, ease: "power3.out" }, t + 1.45);
}
