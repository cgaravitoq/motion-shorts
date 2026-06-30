function build_fanout(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  const workers = Array.isArray(p && p.workers) ? p.workers : [];
  const n = workers.length;
  const fractions = [];
  for (let i = 0; i < n; i++) fractions.push((i + 0.5) / n);

  const W = isDesktop ? 1560 : 912;
  const H = isDesktop ? 680 : 600;
  const wireGroup = document.querySelector(s(".fo-wires__paths"));
  const svg = document.querySelector(s(".fo-wires"));
  if (svg) svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const nodes = gsap.utils.toArray(s(".fo-node--worker"));
  const outLengths = [];
  const inLengths = [];
  const addWire = (cls, d, len) => {
    if (!wireGroup) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `fo-wire ${cls}`);
    path.setAttribute("d", d);
    path.setAttribute("stroke-dasharray", String(len));
    path.setAttribute("stroke-dashoffset", String(len));
    wireGroup.appendChild(path);
  };

  if (isDesktop) {
    const MID_Y = 340;
    const SRC_RIGHT = 340;
    const SYN_LEFT = 1200;
    const WRK_X0 = 572;
    const WRK_X1 = 988;
    const ELBOW_OUT = 456;
    const ELBOW_IN = 1094;
    fractions.forEach((f, i) => {
      const wy = Math.round(f * H);
      const straight = wy === MID_Y;
      const outD = straight
        ? `M ${SRC_RIGHT} ${MID_Y} L ${WRK_X0} ${MID_Y}`
        : `M ${SRC_RIGHT} ${MID_Y} L ${ELBOW_OUT} ${MID_Y} L ${ELBOW_OUT} ${wy} L ${WRK_X0} ${wy}`;
      const outLen = straight
        ? WRK_X0 - SRC_RIGHT
        : (ELBOW_OUT - SRC_RIGHT) + Math.abs(wy - MID_Y) + (WRK_X0 - ELBOW_OUT);
      const inD = straight
        ? `M ${WRK_X1} ${MID_Y} L ${SYN_LEFT} ${MID_Y}`
        : `M ${WRK_X1} ${wy} L ${ELBOW_IN} ${wy} L ${ELBOW_IN} ${MID_Y} L ${SYN_LEFT} ${MID_Y}`;
      const inLen = straight
        ? SYN_LEFT - WRK_X1
        : (ELBOW_IN - WRK_X1) + Math.abs(MID_Y - wy) + (SYN_LEFT - ELBOW_IN);
      outLengths.push(outLen);
      inLengths.push(inLen);
      addWire("fo-wire--out", outD, outLen);
      addWire("fo-wire--in", inD, inLen);
      const node = nodes[i];
      if (node) node.style.top = `${wy}px`;
    });
    tl.set(nodes, { yPercent: -50 }, 0);
  } else {
    const ROOT_X = 456;
    const SRC_BOTTOM = 118;
    const WRK_TOP = 248;
    const WRK_BOTTOM = 352;
    const SYN_TOP = 482;
    const ELBOW_OUT = 183;
    const ELBOW_IN = 417;
    fractions.forEach((f, i) => {
      const wx = Math.round(f * W);
      const straight = wx === ROOT_X;
      const outD = straight
        ? `M ${ROOT_X} ${SRC_BOTTOM} L ${ROOT_X} ${WRK_TOP}`
        : `M ${ROOT_X} ${SRC_BOTTOM} L ${ROOT_X} ${ELBOW_OUT} L ${wx} ${ELBOW_OUT} L ${wx} ${WRK_TOP}`;
      const outLen = straight
        ? WRK_TOP - SRC_BOTTOM
        : (ELBOW_OUT - SRC_BOTTOM) + Math.abs(wx - ROOT_X) + (WRK_TOP - ELBOW_OUT);
      const inD = straight
        ? `M ${ROOT_X} ${WRK_BOTTOM} L ${ROOT_X} ${SYN_TOP}`
        : `M ${wx} ${WRK_BOTTOM} L ${wx} ${ELBOW_IN} L ${ROOT_X} ${ELBOW_IN} L ${ROOT_X} ${SYN_TOP}`;
      const inLen = straight
        ? SYN_TOP - WRK_BOTTOM
        : (ELBOW_IN - WRK_BOTTOM) + Math.abs(ROOT_X - wx) + (SYN_TOP - ELBOW_IN);
      outLengths.push(outLen);
      inLengths.push(inLen);
      addWire("fo-wire--out", outD, outLen);
      addWire("fo-wire--in", inD, inLen);
      const node = nodes[i];
      if (node) node.style.left = `${wx}px`;
    });
    tl.set(nodes, { xPercent: -50, yPercent: -50 }, 0);
  }

  const outWires = gsap.utils.toArray(s(".fo-wire--out"));
  const inWires = gsap.utils.toArray(s(".fo-wire--in"));

  tl.from(s(".fo-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".fo-title"), { y: 42, opacity: 0, duration: 0.6, ease: "power2.out" }, t + 0.4);

  tl.from(s(".fo-node--source"), { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 0.3);
  outWires.forEach((wire, i) => {
    tl.fromTo(wire, { strokeDashoffset: outLengths[i] }, { strokeDashoffset: 0, duration: 0.34, ease: "power1.inOut" }, t + 0.7 + i * 0.08);
  });
  tl.from(s(".fo-node--worker"), { y: 30, scale: 0.78, autoAlpha: 0, duration: 0.46, stagger: 0.12, ease: "back.out(1.6)", transformOrigin: "50% 50%" }, t + 1.0);
  inWires.forEach((wire, i) => {
    tl.fromTo(wire, { strokeDashoffset: inLengths[i] }, { strokeDashoffset: 0, duration: 0.34, ease: "power1.inOut" }, t + 1.6 + i * 0.08);
  });
  tl.from(s(".fo-node--synth"), { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: "back.out(1.8)", transformOrigin: "50% 50%" }, t + 2.0);
}
