const tl = gsap.timeline({ paused: true });
const scenes = ["#scene-hook", "#scene-pipeline", "#scene-loop", "#scene-rule", "#scene-payoff", "#scene-brand-outro"];
const captionsData = JSON.parse(document.getElementById("captions-data").textContent || "[]");
if (captionsData.length > 0) {
  window.__hf.karaoke(tl, "#captions", captionsData, { maxChars: 26, maxTokens: 5 });
}

tl.set(scenes, { autoAlpha: 0, scale: 1.018, filter: "blur(8px)" }, 0);
tl.set("#scene-hook", { scale: 1, filter: "blur(0px)" }, 0);
tl.set("#avatar-dock", { autoAlpha: 0, y: 44 }, 0);
tl.set("#rail-progress", { scaleX: 0 }, 0);
tl.set(".rail-dot", { backgroundColor: "#0d1119", borderColor: "rgba(247, 243, 234, 0.28)" }, 0);
tl.set([".claim-card", "#swap-link", ".signal-pill"], { autoAlpha: 0, y: 34 }, 0);
tl.set([".pipeline-node", "#route-lock"], { autoAlpha: 0, y: 30 }, 0);
tl.set("#pipeline-line", { scaleX: 0 }, 0);
tl.set("#pipeline-pulse", { autoAlpha: 0, x: 0 }, 0);
tl.set([".loop-node", "#state-core"], { autoAlpha: 0, y: 24 }, 0);
tl.set("#loop-path", { strokeDashoffset: 980 }, 0);
tl.set(".split-card", { autoAlpha: 0, y: 34 }, 0);
tl.set(".split-card li", { autoAlpha: 0, x: -18 }, 0);
tl.set(".matrix-card", { autoAlpha: 0, y: 32, scale: 0.97 }, 0);
tl.set(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)", transformOrigin: "50% 50%" }, 0);

const showScene = (selector, at, progress) => {
  tl.to(selector, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.56, ease: "power2.out" }, at);
  tl.to("#rail-progress", { scaleX: progress, duration: 0.55, ease: "power2.out" }, at);
};
const hideScene = (selector, at) => {
  tl.to(selector, { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.48, ease: "power2.in" }, at);
  tl.set(selector, { autoAlpha: 0 }, at + 0.5);
};

tl.to("#avatar-dock", { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" }, 0.15);
showScene("#scene-hook", 0, 0.2);
tl.to(".rail-dot:nth-child(3)", { backgroundColor: "#65b7ff", borderColor: "#65b7ff", duration: 0.3 }, 0.1);
tl.to("#claim-primary", { autoAlpha: 1, y: 0, duration: 0.56, ease: "power2.out" }, 0.35);
tl.to("#swap-link", { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.75);
tl.to("#claim-layout", { autoAlpha: 1, y: 0, duration: 0.56, ease: "power2.out" }, 1.0);
tl.to(".signal-pill", { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.12, ease: "power2.out" }, 1.5);

hideScene("#scene-hook", 6.9);
showScene("#scene-pipeline", 7.35, 0.4);
tl.to(".rail-dot:nth-child(4)", { backgroundColor: "#65b7ff", borderColor: "#65b7ff", duration: 0.3 }, 7.35);
tl.to(".pipeline-node", { autoAlpha: 1, y: 0, duration: 0.46, stagger: 0.12, ease: "back.out(1.5)" }, 7.8);
tl.to("#pipeline-line", { scaleX: 1, duration: 1.1, ease: "power2.out" }, 8.2);
tl.to("#pipeline-pulse", { autoAlpha: 1, duration: 0.18, ease: "power2.out" }, 8.25);
tl.to("#pipeline-pulse", { x: 884, duration: 1.22, ease: "power2.inOut" }, 8.3);
tl.to("#pipeline-pulse", { autoAlpha: 0, duration: 0.22, ease: "power2.in" }, 9.55);
tl.to("#route-lock", { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 10.2);

hideScene("#scene-pipeline", 15.4);
showScene("#scene-loop", 15.85, 0.6);
tl.to(".rail-dot:nth-child(5)", { backgroundColor: "#42d392", borderColor: "#42d392", duration: 0.3 }, 15.85);
tl.to("#state-core", { autoAlpha: 1, y: 0, duration: 0.5, ease: "back.out(1.5)" }, 16.25);
tl.to(".loop-node", { autoAlpha: 1, y: 0, duration: 0.46, stagger: 0.16, ease: "back.out(1.5)" }, 16.7);
tl.to("#loop-path", { strokeDashoffset: 0, duration: 1.25, ease: "power2.out" }, 17.35);
tl.to("#state-core", { scale: 1.05, duration: 0.34, ease: "power2.out", overwrite: "auto" }, 22.75);
tl.to("#state-core", { scale: 1, duration: 0.34, ease: "power2.inOut", overwrite: "auto" }, 23.1);
tl.to("#loop-path", { stroke: "var(--amber)", duration: 0.35, ease: "power2.inOut" }, 23.0);
tl.to("#loop-path", { stroke: "var(--green)", duration: 0.35, ease: "power2.inOut" }, 23.35);

hideScene("#scene-loop", 25.8);
showScene("#scene-rule", 26.25, 0.8);
tl.to(".rail-dot:nth-child(6)", { backgroundColor: "#f5bf4f", borderColor: "#f5bf4f", duration: 0.3 }, 26.25);
tl.to(".split-card", { autoAlpha: 1, y: 0, duration: 0.54, stagger: 0.16, ease: "power2.out" }, 26.75);
tl.to(".split-card li", { autoAlpha: 1, x: 0, duration: 0.36, stagger: 0.09, ease: "power2.out" }, 27.45);

hideScene("#scene-rule", 35.05);
showScene("#scene-payoff", 35.5, 1);
tl.to(".rail-dot:nth-child(7)", { backgroundColor: "#f06d8f", borderColor: "#f06d8f", duration: 0.3 }, 35.5);
tl.to(".matrix-card", { autoAlpha: 1, y: 0, scale: 1, duration: 0.48, stagger: 0.12, ease: "power2.out" }, 36.0);
tl.to(".matrix-card--strong", { boxShadow: "0 0 70px rgba(66, 211, 146, 0.20)", duration: 0.5, ease: "power2.out" }, 38.0);

hideScene("#scene-payoff", 42.35);
tl.to("#avatar-dock", { autoAlpha: 0, y: 32, duration: 0.48, ease: "power2.in" }, 42.4);
tl.to("#story-rail", { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, 42.4);
tl.to("#brand-corner", { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, 42.42);
tl.set("#avatar-dock", { autoAlpha: 0 }, 42.92);
tl.set("#brand-corner", { autoAlpha: 0 }, 42.92);
tl.to("#scene-brand-outro", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 42.92);
tl.to("#brand-aura", { autoAlpha: 1, scale: 1, duration: 0.65, ease: "power2.out" }, 43.12);
tl.to(".brand-outro__piece", { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.55, stagger: 0.08, ease: "back.out(1.6)", startAt: { x: -24, y: 20, scale: 0.92 } }, 43.22);
tl.to(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, stagger: 0.1, ease: "power3.out" }, 43.62);
tl.to("#brand-mark", { scale: 1.04, duration: 0.32, ease: "power2.out", overwrite: "auto" }, 43.82);
tl.to("#brand-mark", { scale: 1, duration: 0.34, ease: "power2.inOut", overwrite: "auto" }, 44.14);

window.__timelines = window.__timelines || {};
const templateCompositionId = "__SLUG__";
window.__timelines[templateCompositionId] = tl;
