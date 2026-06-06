// contrib-heatmap entrance choreography. See metric/v1/timeline.js for the contract.
//   tl = global paused timeline   t = this scene's global start (seconds)
//   s  = selector helper scoped to this instance: s(".ch-cell") -> "#scene-<id> .ch-cell"
//   p  = resolved params object (p.data = "row/row/.../row", 7 rows of digits 0-4)
// This is the ONLY scene-type that GENERATES its DOM in the builder: the cell
// count is data-driven (7xN), so the fragment ships an empty .ch-grid and the
// builder parses p.data, sizes the grid, and creates one .ch-cell per value
// BEFORE any tween. This runs synchronously at load — fully deterministic, so
// identical p.data => identical DOM => identical bytes.
function build_contrib_heatmap(tl, t, s, p) {
  const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";
  const grid = document.querySelector(s(".ch-grid"));
  const rows = String(p && p.data ? p.data : "")
    .split("/")
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => r.split("").filter((c) => c >= "0" && c <= "4").map(Number));
  const cols = rows.length ? rows[0].length : 0;
  const valid = rows.length === 7 && cols >= 12 && cols <= 26 && rows.every((r) => r.length === cols);

  if (grid && valid) {
    // Fit a 7xN grid inside the safe band: width budget ~832px after panel pad,
    // height budget kept modest so heading + legend + meta still breathe.
    const gap = 8;
    const widthBudget = isDesktop ? 1456 : 832;
    const cellMax = isDesktop ? 68 : 52;
    const cellByWidth = Math.floor((widthBudget - (cols - 1) * gap) / cols);
    const cell = Math.max(20, Math.min(cellMax, cellByWidth));
    grid.style.setProperty("--ch-cols", String(cols));
    grid.style.setProperty("--ch-cell", cell + "px");
    grid.style.setProperty("--ch-gap", gap + "px");
    // Column-major order so the diagonal sweep reads left-to-right per week.
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const div = document.createElement("div");
        div.className = "ch-cell";
        div.setAttribute("data-level", String(rows[r][c]));
        div.style.gridColumn = String(c + 1);
        div.style.gridRow = String(r + 1);
        div.dataset.sweep = String(c + r);
        grid.appendChild(div);
      }
    }
  }

  tl.from(s(".ch-eyebrow"), { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, t + 0.2);
  tl.from(s(".ch-title"), { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, t + 0.45);
  tl.from(s(".ch-panel"), { y: 40, opacity: 0, scale: 0.96, duration: 0.55, ease: "power3.out", transformOrigin: "50% 50%" }, t + 0.9);

  // Diagonal cascade: each cell starts at scale 0 (hidden at literal 0), then
  // pops in keyed to its column+row sweep index — a left-to-right wipe.
  const cells = gsap.utils.toArray(s(".ch-cell"));
  tl.set(cells, { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%" }, 0);
  const sweepStep = 0.05;
  const start = t + 1.3;
  cells.forEach((el) => {
    const sweep = Number(el.dataset.sweep || 0);
    tl.fromTo(
      el,
      { scale: 0, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.42, ease: "back.out(1.7)" },
      start + sweep * sweepStep,
    );
  });

  const sweepMax = cells.reduce((m, el) => Math.max(m, Number(el.dataset.sweep || 0)), 0);
  const tail = start + sweepMax * sweepStep + 0.3;
  tl.from(s(".ch-legend"), { y: 16, opacity: 0, duration: 0.45, ease: "power2.out" }, tail);
  tl.from(s(".ch-caption"), { y: 18, opacity: 0, duration: 0.5, ease: "power2.out" }, tail + 0.15);
  tl.from(s(".ch-badge"), { scale: 0.8, autoAlpha: 0, duration: 0.5, ease: "back.out(1.7)", transformOrigin: "50% 50%" }, tail + 0.3);
}
