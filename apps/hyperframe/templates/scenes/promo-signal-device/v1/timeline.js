// promo-signal-device entrance + play-pulse choreography. Seek-safe only
// (from/to/set; no callbacks). The phone rises from the frame edge, the
// action button pops in and pulses twice like a video inviting the tap.
function build_promoSignalDevice(tl, t, s, p) {
  tl.set(s(".psd-badge"), { autoAlpha: 0, y: -24 }, 0);
  tl.set(s(".psd-title"), { autoAlpha: 0, y: 46 }, 0);
  tl.set(s(".psd-howto"), { autoAlpha: 0, y: 38 }, 0);
  tl.set(s(".psd-device"), { autoAlpha: 0, y: 130 }, 0);
  tl.set(s(".psd-action"), { autoAlpha: 0, scale: 0.3 }, 0);

  tl.to(s(".psd-badge"), { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.15);
  tl.to(s(".psd-title"), { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.3);
  tl.to(s(".psd-howto"), { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" }, t + 0.6);

  tl.to(s(".psd-device"), { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, t + 0.8);
  tl.to(s(".psd-action"), { autoAlpha: 1, scale: 1, duration: 0.55, ease: "back.out(2.4)" }, t + 1.5);

  // double pulse, inviting the tap
  tl.to(s(".psd-action"), { scale: 1.14, duration: 0.32, ease: "sine.inOut" }, t + 2.4);
  tl.to(s(".psd-action"), { scale: 1, duration: 0.36, ease: "sine.inOut" }, t + 2.72);
  tl.to(s(".psd-action"), { scale: 1.14, duration: 0.32, ease: "sine.inOut" }, t + 3.4);
  tl.to(s(".psd-action"), { scale: 1, duration: 0.36, ease: "sine.inOut" }, t + 3.72);
}
