// big-stat entrance choreography. See title-cards/v1/timeline.js for the contract.
// The hero number scales/blurs in, then counts up to its target. Count-up is
// built from stepped tl.set(el,{textContent}) zero-duration tweens — the
// seek-safe primitive (callbacks/onUpdate don't fire during Hyperframes'
// frame-by-frame seek; only set() materialises reliably). The .bs-suffix span
// keeps its own slot value.
function build_bigStat(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  tl.from(s(".bs-label"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".bs-figure"), { scale: 0.7, autoAlpha: 0, filter: "blur(18px)", transformOrigin: isDesktop ? "50% 50%" : "0% 50%", duration: 0.78, ease: "back.out(1.5)" }, t + 0.42);
  tl.from(s(".bs-context"), { y: 26, opacity: 0, duration: 0.55, ease: "power2.out" }, t + 1.05);

  const parseCountUp = (display) => {
    const m = String(display).match(/^\s*(-?[\d.,]*\d)/);
    if (!m) return null;
    const numToken = m[1];
    const trailing = String(display).slice(m.index + m[0].length);
    const hasThousands = numToken.includes(",");
    const decMatch = numToken.match(/\.(\d+)$/);
    const decimals = decMatch ? decMatch[1].length : 0;
    const target = Number(numToken.replace(/,/g, ""));
    if (!Number.isFinite(target)) return null;
    const format = (n) => {
      const fixed = n.toFixed(decimals);
      if (!hasThousands) return fixed + trailing;
      const [intPart, fracPart] = fixed.split(".");
      const sign = intPart.startsWith("-") ? "-" : "";
      const digits = sign ? intPart.slice(1) : intPart;
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return sign + grouped + (fracPart != null ? "." + fracPart : "") + trailing;
    };
    return { target, format };
  };

  const el = gsap.utils.toArray(s(".bs-value"))[0];
  const parsed = el && p ? parseCountUp(p.value) : null;
  if (!parsed) return;
  const ease = gsap.parseEase("power2.out");
  const STEPS = 26;
  const DUR = 0.9;
  const start = t + 1.15;
  tl.set(el, { textContent: parsed.format(0) }, 0);
  for (let k = 0; k <= STEPS; k++) {
    const prog = k / STEPS;
    tl.set(el, { textContent: parsed.format(ease(prog) * parsed.target) }, start + prog * DUR);
  }
}
