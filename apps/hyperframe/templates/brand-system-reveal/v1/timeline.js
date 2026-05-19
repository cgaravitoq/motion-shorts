const tl = gsap.timeline({ paused: true });
const scenes = ["#scene-hook", "#scene-proof", "#scene-support", "#scene-comparison", "#scene-payoff", "#scene-brand-outro"];
tl.set(scenes, { autoAlpha: 0, scale: 1.02, filter: "blur(8px)" }, 0);
tl.set("#scene-hook", { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, 0);
tl.set(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)", transformOrigin: "50% 50%" }, 0);
[[-5, 4], [6, -3], [-8, 1], [2, 6], [-4, -4]].forEach(([gx, gy], i) => {
  tl.set(".hf-grain-overlay__texture", { "--grain-x": `${gx}%`, "--grain-y": `${gy}%` }, i * 7.6);
});

tl.from("#hook-source", { y: 20, opacity: 0, duration: 0.45, ease: "power2.out" }, 0.15);
tl.from("#hook-headline", { y: 44, opacity: 0, duration: 0.65, ease: "power2.out" }, 0.45);
tl.from("#hook-subtitle", { y: 30, opacity: 0, duration: 0.55, ease: "power2.out" }, 0.9);
tl.from("#hook-card", { y: 50, opacity: 0, scale: 0.96, duration: 0.75, ease: "power3.out" }, 1.15);
tl.fromTo("#hook-card", { "--shimmer-pos": "-20%" }, { "--shimmer-pos": "120%", duration: 1.4, ease: "power2.inOut" }, 1.9);
tl.to("#hook-card .hf-source-article-hero__image", { "--source-scan": "120%", duration: 1.35, ease: "power2.inOut" }, 2.05);

tl.to("#scene-hook", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.55, ease: "power2.in" }, 7.0);
tl.set("#scene-hook", { autoAlpha: 0 }, 7.55);
tl.to("#scene-proof", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 7.55);
tl.from("#proof-eyebrow", { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, 7.75);
tl.from("#proof-number", { y: 54, opacity: 0, scale: 0.92, duration: 0.72, ease: "back.out(1.5)" }, 8.05);
tl.from("#proof-headline", { y: 36, opacity: 0, duration: 0.55, ease: "power2.out" }, 8.55);
tl.from("#proof-subcopy", { y: 30, opacity: 0, duration: 0.5, ease: "power2.out" }, 8.95);

tl.to("#scene-proof", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.55, ease: "power2.in" }, 13.7);
tl.set("#scene-proof", { autoAlpha: 0 }, 14.25);
tl.to("#scene-support", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 14.25);
tl.from("#support-eyebrow", { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, 14.45);
tl.from("#support-headline", { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, 14.75);
tl.from(".hf-source-proof-card", { y: 34, opacity: 0, duration: 0.55, ease: "power2.out" }, 15.55);

tl.to("#scene-support", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.55, ease: "power2.in" }, 21.1);
tl.set("#scene-support", { autoAlpha: 0 }, 21.65);
tl.to("#scene-comparison", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 21.65);
tl.from("#comparison-eyebrow", { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, 21.85);
tl.from("#comparison-headline", { y: 36, opacity: 0, duration: 0.55, ease: "power2.out" }, 22.15);
tl.from(".hf-source-stat-comparison__row", { y: 28, opacity: 0, duration: 0.45, stagger: 0.14, ease: "power2.out" }, 22.8);
tl.to(".hf-source-stat-comparison__bar", { scaleX: 1, duration: 0.7, stagger: 0.18, ease: "power2.out" }, 23.15);
tl.set(".hf-source-stat-comparison__value", { autoAlpha: 1 }, 23.8);

tl.to("#scene-comparison", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.55, ease: "power2.in" }, 29.0);
tl.set("#scene-comparison", { autoAlpha: 0 }, 29.55);
tl.to("#scene-payoff", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 29.55);
tl.from("#payoff-eyebrow", { y: 18, opacity: 0, duration: 0.4, ease: "power2.out" }, 29.75);
tl.from("#payoff-headline", { y: 42, opacity: 0, duration: 0.62, ease: "power2.out" }, 30.05);
tl.from(".constraint-card", { y: 34, opacity: 0, duration: 0.55, stagger: 0.18, ease: "power2.out" }, 30.85);

tl.to("#scene-payoff", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: 0.55, ease: "power2.in" }, 35.2);
tl.set("#scene-payoff", { autoAlpha: 0 }, 35.75);
tl.to("#brand-corner", { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, 35.2);
tl.to("#scene-brand-outro", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 35.75);
tl.to("#brand-aura", { autoAlpha: 1, scale: 1, duration: 0.65, ease: "power2.out" }, 35.95);
tl.to(".brand-outro__piece", { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.55, stagger: 0.08, ease: "back.out(1.6)", startAt: { x: -24, y: 20, scale: 0.92 } }, 36.05);
tl.to(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, stagger: 0.1, ease: "power3.out" }, 36.37);
tl.to("#brand-mark", { scale: 1.04, duration: 0.32, ease: "power2.out", overwrite: "auto" }, 36.55);
tl.to("#brand-mark", { scale: 1, duration: 0.34, ease: "power2.inOut", overwrite: "auto" }, 36.87);

const captionsData = JSON.parse(document.getElementById("captions-data").textContent || "[]");
if (captionsData.length > 0) {
  window.__hf.karaoke(tl, "#captions", captionsData, { maxChars: 28, maxTokens: 5 });
}
window.__timelines = window.__timelines || {};
const templateCompositionId = "__SLUG__";
window.__timelines[templateCompositionId] = tl;
