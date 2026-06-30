function build_progressRing(tl, t, s, p) {
  const R = 86;
  const C = 2 * Math.PI * R;
  const rings = Array.isArray(p && p.rings) ? p.rings : [];

  const arcs = gsap.utils.toArray(s(".pr-arc"));
  arcs.forEach((arc) => {
    arc.setAttribute("stroke-dasharray", String(C));
    arc.setAttribute("stroke-dashoffset", String(C));
  });

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

  tl.from(s(".pr-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".pr-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".pr-ring"), { y: 36, opacity: 0, scale: 0.92, duration: 0.55, stagger: 0.16, ease: "power3.out", transformOrigin: "50% 50%" }, t + 0.9);
  tl.from(s(".pr-label"), { y: 16, opacity: 0, duration: 0.46, stagger: 0.16, ease: "power2.out" }, t + 1.2);

  const ease = gsap.parseEase("power2.out");
  const STEPS = 28;
  const DUR = 1.0;
  const nums = gsap.utils.toArray(s(".pr-num"));

  arcs.forEach((arc, i) => {
    const ring = rings[i];
    if (!ring) return;
    const pct = Math.max(0, Math.min(100, Number(ring.pct) || 0));
    const start = t + 1.2 + i * 0.16;
    const endOffset = C * (1 - pct / 100);
    tl.fromTo(arc, { strokeDashoffset: C }, { strokeDashoffset: endOffset, duration: DUR, ease: "power2.out" }, start);

    const num = nums[i];
    if (!num) return;
    const display = ring.value ? ring.value : `${pct}%`;
    const parsed = parseCountUp(display);
    if (!parsed) {
      tl.set(num, { textContent: display }, start);
      return;
    }
    tl.set(num, { textContent: parsed.format(0) }, 0);
    for (let k = 0; k <= STEPS; k++) {
      const prog = k / STEPS;
      tl.set(num, { textContent: parsed.format(ease(prog) * parsed.target) }, start + prog * DUR);
    }
  });
}
