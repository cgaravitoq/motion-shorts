// decision-tree entrance choreography. See bars/v1/timeline.js for the contract
// header and progress-ring/v1/timeline.js for the real-px stroke-dasharray pattern.
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".dt-branch") -> "#scene-<id> .dt-branch"
//   p  = resolved params object for this scene (p.branches drives the layout)
// Seek-safe only (from/to/fromTo/set). Connector geometry is derived from the SAME
// fixed constants that the CSS uses to place the nodes (viewBox 912x760, root center
// x=456, trunk top y=196, elbow y=320, result top y=420) — NEVER measured at runtime.
// Each wire's stroke-dasharray is its REAL axis-aligned px length (a literal sum), and
// it draws via strokeDashoffset len->0 (the seek-safe primitive, like progress-ring).
// Result columns + the root are placed synchronously up front (deterministic setup).
function build_decisionTree(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  const W = isDesktop ? 1560 : 912;
  const H = isDesktop ? 680 : 760;
  const ROOT_X = W / 2;
  const TRUNK_TOP = isDesktop ? 200 : 196;
  const ELBOW_Y = isDesktop ? 340 : 320;
  const CHILD_TOP = isDesktop ? 430 : 420;
  const branches = Array.isArray(p && p.branches) ? p.branches : [];
  const n = branches.length;

  const fractions = n === 2 ? [0.25, 0.75] : [1 / 6, 0.5, 5 / 6];
  const childXs = fractions.map((f) => Math.round(f * W));

  const wireGroup = document.querySelector(s(".dt-wires__paths"));
  if (isDesktop) {
    const svg = document.querySelector(s(".dt-wires"));
    if (svg) svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  }
  const nodes = gsap.utils.toArray(s(".dt-branch"));
  const lengths = [];
  childXs.forEach((cx, i) => {
    const straight = cx === ROOT_X;
    const d = straight
      ? `M ${ROOT_X} ${TRUNK_TOP} L ${ROOT_X} ${CHILD_TOP}`
      : `M ${ROOT_X} ${TRUNK_TOP} L ${ROOT_X} ${ELBOW_Y} L ${cx} ${ELBOW_Y} L ${cx} ${CHILD_TOP}`;
    const len = straight
      ? CHILD_TOP - TRUNK_TOP
      : (ELBOW_Y - TRUNK_TOP) + Math.abs(cx - ROOT_X) + (CHILD_TOP - ELBOW_Y);
    lengths.push(len);
    if (wireGroup) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "dt-wire");
      path.setAttribute("d", d);
      path.setAttribute("stroke-dasharray", String(len));
      path.setAttribute("stroke-dashoffset", String(len));
      wireGroup.appendChild(path);
    }
    const node = nodes[i];
    if (node) node.style.left = `${cx}px`;
  });

  tl.set(s(".dt-node--root"), { xPercent: -50 }, 0);
  tl.set(s(".dt-branch"), { xPercent: -50 }, 0);

  tl.from(s(".dt-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".dt-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);

  tl.from(s(".dt-node--root"), { y: 28, scale: 0.86, autoAlpha: 0, duration: 0.55, ease: "back.out(1.6)", transformOrigin: "50% 50%" }, t + 0.85);

  const wires = gsap.utils.toArray(s(".dt-wire"));
  const drawStart = t + 1.5;
  wires.forEach((wire, i) => {
    tl.fromTo(wire, { strokeDashoffset: lengths[i] }, { strokeDashoffset: 0, duration: 0.5, ease: "power1.inOut" }, drawStart + i * 0.16);
  });

  tl.from(s(".dt-branch__badge"), { scale: 0.6, autoAlpha: 0, duration: 0.36, stagger: 0.16, ease: "back.out(1.9)", transformOrigin: "50% 50%" }, drawStart + 0.3);

  const order = branches
    .map((b, i) => ({ i, positive: (b && b.tone) === "positive" }))
    .sort((a, b) => (a.positive === b.positive ? a.i - b.i : a.positive ? 1 : -1));
  const results = gsap.utils.toArray(s(".dt-node--result"));
  const popStart = drawStart + 0.55;
  order.forEach((o, k) => {
    if (results[o.i]) tl.from(results[o.i], { y: 30, scale: 0.82, autoAlpha: 0, duration: 0.46, ease: "back.out(1.7)", transformOrigin: "50% 0%" }, popStart + k * 0.22);
  });
}
