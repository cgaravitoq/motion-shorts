/*
 * GSAP timeline helpers shared across Hyperframes compositions.
 *
 * Hyperframes contract (see AGENTS.md rules 1–2 and 21):
 *   - Every composition MUST register `window.__timelines["<comp-id>"]`
 *   - Timeline MUST be `paused: true` — the engine drives the playhead
 *   - No Math.random / Date.now / repeat: -1 / async timeline construction
 *
 * Loaded via <script src="lib/timeline-helpers.js"></script> AFTER GSAP.
 * Exposes helpers on window.__hf for use inside episode <script> blocks.
 */
((global) => {
  if (!global.gsap) {
    console.error("[hf] timeline-helpers loaded before GSAP — load gsap.min.js first");
    return;
  }

  global.__timelines = global.__timelines || {};

  const registerTimeline = (compositionId, timeline) => {
    if (!compositionId) throw new Error("registerTimeline: compositionId required");
    if (!timeline) throw new Error("registerTimeline: timeline required");
    global.__timelines[compositionId] = timeline;
  };

  /**
   * Builds a paused GSAP timeline and registers it under the composition ID
   * read from the data-composition-id attribute on the stage element.
   */
  const buildTimeline = (stageSelector) => {
    const stage = document.querySelector(stageSelector);
    if (!stage) throw new Error(`buildTimeline: ${stageSelector} not found`);
    const id = stage.getAttribute("data-composition-id");
    if (!id) throw new Error(`buildTimeline: ${stageSelector} missing data-composition-id`);
    const tl = global.gsap.timeline({ paused: true });
    registerTimeline(id, tl);
    return tl;
  };

  /**
   * Counter animation pattern — animates a number from `from` to `to` over
   * `duration`s, formatting with the given `format` callback.
   *
   *   counter(tl, "#kpi-value", { from: 0, to: 150000, duration: 2 }, 0.5);
   */
  const counter = (tl, target, opts, position = 0) => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) throw new Error(`counter: ${target} not found`);
    const state = { v: opts.from ?? 0 };
    const format = opts.format ?? ((n) => Math.round(n).toLocaleString());
    el.textContent = format(state.v);
    return tl.to(
      state,
      {
        v: opts.to,
        duration: opts.duration ?? 2,
        ease: opts.ease ?? "power2.out",
        onUpdate: () => {
          el.textContent = format(state.v);
        },
      },
      position,
    );
  };

  /**
   * Stagger reveal — fades in children of `parent` with vertical offset.
   * Layout-Before-Animation rule: assumes children already in final position.
   */
  const staggerIn = (tl, parent, opts = {}, position = 0) => {
    const sel = typeof parent === "string" ? `${parent} > *` : parent;
    return tl.from(
      sel,
      {
        y: opts.y ?? 30,
        opacity: 0,
        duration: opts.duration ?? 0.5,
        stagger: opts.stagger ?? 0.12,
        ease: opts.ease ?? "power2.out",
      },
      position,
    );
  };

  /**
   * Fits text into a container by shrinking font-size until it fits or hits
   * minFontSize. Uses the official window.__hyperframes.fitTextFontSize when
   * present (Hyperframes runtime injects it); falls back to a manual loop.
   */
  const fitText = (selector, opts = {}) => {
    const el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    const baseFontSize = opts.baseFontSize ?? Number.parseFloat(getComputedStyle(el).fontSize);
    const minFontSize = opts.minFontSize ?? Math.max(12, baseFontSize * 0.5);
    const maxWidth = opts.maxWidth ?? el.parentElement?.clientWidth ?? el.clientWidth;

    if (global.__hyperframes?.fitTextFontSize) {
      const size = global.__hyperframes.fitTextFontSize({
        text: el.textContent,
        maxWidth,
        baseFontSize,
        minFontSize,
        fontFamily: getComputedStyle(el).fontFamily,
        fontWeight: getComputedStyle(el).fontWeight,
      });
      el.style.fontSize = `${size}px`;
      return;
    }

    let size = baseFontSize;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > maxWidth && size > minFontSize) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  };

  // Idempotent: extend any existing __hf rather than replace. This script
  // gets re-evaluated each time a sub-composition is inlined into the master
  // page (Hyperframes inlines them at render time), so a destructive
  // `__hf = { ... }` would clobber methods attached by other helpers
  // (notably captions-karaoke.js's `__hf.karaoke`). Keep this assignment
  // additive.
  global.__hf = global.__hf || {};
  global.__hf.registerTimeline = registerTimeline;
  global.__hf.buildTimeline = buildTimeline;
  global.__hf.counter = counter;
  global.__hf.staggerIn = staggerIn;
  global.__hf.fitText = fitText;
})(window);
