// media-split entrance choreography. See title-cards/v1/timeline.js for the contract.
// Copy block leads: eyebrow, title, then bullets stagger in (y + opacity). The
// image is the asset — it pops with y + scale 0.96. Seek-safe only.
function build_mediaSplit(tl, t, s, p) {
  tl.from(s(".ms-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".ms-title"), { y: 40, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);
  tl.from(s(".ms-point"), { y: 24, opacity: 0, duration: 0.42, stagger: 0.1, ease: "power3.out" }, t + 1.05);

  tl.from(s(".ms-media"), { y: 44, opacity: 0, scale: 0.96, duration: 0.6, ease: "power3.out" }, t + 0.7);
}
