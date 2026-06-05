// line-chart entrance choreography. See metric/v1/timeline.js for the seek-safe
// count-up pattern and fanout/v1/timeline.js for hidden-at-literal-0 states.
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".lc-line") -> "#scene-<id> .lc-line"
//   p  = resolved params object (p.series, p.xLabels, p.unit) for this scene
//
// The builder is synchronous and deterministic: it parses p, computes plot
// geometry, and createElementNS/setAttribute the gridlines, axis labels,
// polylines and dots BEFORE any tween is created. Stroke reveal uses a REAL px
// path length (Euclidean sums over the literal vertices) as stroke-dasharray and
// tweens strokeDashoffset len -> 0 (seek-safe). No pathLength, no getTotalLength,
// no randomness, no time APIs.
function build_lineChart(tl, t, s, p) {
  const SVGNS = "http://www.w3.org/2000/svg";
  const VB_W = 1000;
  const VB_H = 620;
  const PAD_L = 96;
  const PAD_R = 36;
  const PAD_T = 30;
  const PAD_B = 84;
  const plotX0 = PAD_L;
  const plotX1 = VB_W - PAD_R;
  const plotY0 = PAD_T;
  const plotY1 = VB_H - PAD_B;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;

  const parseNums = (str) =>
    String(str)
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));

  const series = (Array.isArray(p && p.series) ? p.series : [])
    .map((sr) => ({ label: sr.label, values: parseNums(sr.values) }))
    .filter((sr) => sr.values.length >= 2);
  if (series.length === 0) return;

  const pointCount = Math.max(...series.map((sr) => sr.values.length));
  let dataMax = 0;
  for (const sr of series) for (const v of sr.values) if (v > dataMax) dataMax = v;
  if (dataMax <= 0) dataMax = 1;
  const yMax = dataMax * 1.12;

  const xAt = (i) => (pointCount === 1 ? plotX0 : plotX0 + (plotW * i) / (pointCount - 1));
  const yAt = (v) => plotY1 - (plotH * v) / yMax;

  const niceTick = (raw) => {
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / pow;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * pow;
  };
  const unit = (p && typeof p.unit === "string" ? p.unit : "") || "";
  const xLabels = p && typeof p.xLabels === "string" && p.xLabels.trim()
    ? p.xLabels.split(",").map((l) => l.trim())
    : [];

  const gridGroup = document.querySelector(s(".lc-grid"));
  const yLabelGroup = document.querySelector(s(".lc-ylabels"));
  const xLabelGroup = document.querySelector(s(".lc-xlabels"));
  const seriesGroup = document.querySelector(s(".lc-series"));
  const dotGroup = document.querySelector(s(".lc-dots"));
  if (!gridGroup || !seriesGroup) return;

  const tickStep = niceTick(yMax / 4);
  const fmtTick = (n) => {
    const r = Math.round(n * 10) / 10;
    const txt = Number.isInteger(r) ? String(r) : r.toFixed(1);
    return txt + unit;
  };
  for (let v = 0; v <= yMax + 1e-6; v += tickStep) {
    const y = yAt(v);
    const line = document.createElementNS(SVGNS, "line");
    line.setAttribute("x1", String(plotX0));
    line.setAttribute("x2", String(plotX1));
    line.setAttribute("y1", y.toFixed(2));
    line.setAttribute("y2", y.toFixed(2));
    if (v === 0) line.setAttribute("class", "lc-grid__base");
    gridGroup.appendChild(line);

    const label = document.createElementNS(SVGNS, "text");
    label.setAttribute("x", String(plotX0 - 18));
    label.setAttribute("y", y.toFixed(2));
    label.textContent = fmtTick(v);
    yLabelGroup.appendChild(label);
  }

  if (xLabels.length > 0) {
    for (let i = 0; i < pointCount; i++) {
      const text = xLabels[i];
      if (text === undefined || text === "") continue;
      const label = document.createElementNS(SVGNS, "text");
      label.setAttribute("x", xAt(i).toFixed(2));
      label.setAttribute("y", String(plotY1 + 20));
      label.textContent = text;
      xLabelGroup.appendChild(label);
    }
  }

  const lineEls = [];
  const dotEls = [];
  const lineLengths = [];
  const dotFracs = [];

  series.forEach((sr, si) => {
    const pts = sr.values.map((v, i) => [xAt(i), yAt(v)]);

    let total = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      total += Math.sqrt(dx * dx + dy * dy);
      cum.push(total);
    }

    const poly = document.createElementNS(SVGNS, "polyline");
    poly.setAttribute("class", `lc-line lc-line--${si}`);
    poly.setAttribute("points", pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "));
    seriesGroup.appendChild(poly);
    lineEls.push(poly);
    lineLengths.push(total);

    const dots = pts.map(([x, y], pi) => {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("class", `lc-dot lc-dot--${si}`);
      c.setAttribute("cx", x.toFixed(2));
      c.setAttribute("cy", y.toFixed(2));
      c.setAttribute("r", "11");
      dotGroup.appendChild(c);
      return c;
    });
    dotEls.push(dots);
    dotFracs.push(pts.map((_, pi) => (total > 0 ? cum[pi] / total : pi / Math.max(1, pts.length - 1))));
  });

  // ── seek-safe entrance ──────────────────────────────────────────────────
  tl.set(gridGroup, { autoAlpha: 0 }, 0);
  tl.set(yLabelGroup, { autoAlpha: 0 }, 0);
  tl.set(xLabelGroup, { autoAlpha: 0 }, 0);
  lineEls.forEach((el, i) => {
    const len = lineLengths[i];
    tl.set(el, { strokeDasharray: len, strokeDashoffset: len }, 0);
  });
  dotEls.flat().forEach((el) => {
    tl.set(el, { autoAlpha: 0 }, 0);
  });

  tl.from(s(".lc-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".lc-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);

  tl.to(gridGroup, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, t + 0.7);
  tl.to(yLabelGroup, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, t + 0.8);
  tl.to(xLabelGroup, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, t + 0.9);

  const DRAW = 1.4;
  const SERIES_STAGGER = 0.55;
  lineEls.forEach((el, si) => {
    const start = t + 1.0 + si * SERIES_STAGGER;
    tl.to(el, { strokeDashoffset: 0, duration: DRAW, ease: "power1.inOut" }, start);
  });

  dotEls.forEach((dots, si) => {
    const start = t + 1.0 + si * SERIES_STAGGER;
    dots.forEach((c, pi) => {
      const at = start + dotFracs[si][pi] * DRAW;
      tl.to(c, { autoAlpha: 1, duration: 0.34, ease: "power2.out" }, at);
    });
  });

  tl.from(s(".lc-legend__item"), { y: 16, opacity: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }, t + 1.0);
}
