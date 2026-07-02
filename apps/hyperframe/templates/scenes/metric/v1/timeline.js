function build_metric(tl, t, s, p) {
  tl.from(s(".mt-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".mt-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".mt-card"), { y: 40, opacity: 0, scale: 0.94, duration: 0.55, stagger: 0.14, ease: "power3.out" }, t + 0.95);
  tl.from(s(".mt-card__value"), { scale: 0.82, opacity: 0, duration: 0.5, stagger: 0.14, ease: "back.out(1.7)", transformOrigin: "50% 50%" }, t + 1.15);

  const parseCountUp = (display) => {
    const m = String(display).match(/^\s*(-?[\d.,]*\d)/);
    if (!m) return null;
    const numToken = m[1];
    const suffix = String(display).slice(m.index + m[0].length);
    const hasThousands = numToken.includes(",");
    const decMatch = numToken.match(/\.(\d+)$/);
    const decimals = decMatch ? decMatch[1].length : 0;
    const target = Number(numToken.replace(/,/g, ""));
    if (!Number.isFinite(target)) return null;
    const format = (n) => {
      const fixed = n.toFixed(decimals);
      if (!hasThousands) return fixed + suffix;
      const [intPart, fracPart] = fixed.split(".");
      const sign = intPart.startsWith("-") ? "-" : "";
      const digits = sign ? intPart.slice(1) : intPart;
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return sign + grouped + (fracPart != null ? "." + fracPart : "") + suffix;
    };
    return { target, format };
  };

  const ease = gsap.parseEase("power2.out");
  const STEPS = 26;
  const DUR = 0.9;
  const values = gsap.utils.toArray(s(".mt-card__value"));
  const stats = Array.isArray(p && p.stats) ? p.stats : [];
  values.forEach((el, i) => {
    const stat = stats[i];
    if (!stat) return;
    const parsed = parseCountUp(stat.value);
    if (!parsed) return;
    const start = t + 1.15 + i * 0.14;
    tl.set(el, { textContent: parsed.format(0) }, 0);
    for (let k = 0; k <= STEPS; k++) {
      const prog = k / STEPS;
      tl.set(el, { textContent: parsed.format(ease(prog) * parsed.target) }, start + prog * DUR);
    }
  });
}
