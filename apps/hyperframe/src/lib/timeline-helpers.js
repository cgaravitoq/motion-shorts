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

  const buildTimeline = (stageSelector) => {
    const stage = document.querySelector(stageSelector);
    if (!stage) throw new Error(`buildTimeline: ${stageSelector} not found`);
    const id = stage.getAttribute("data-composition-id");
    if (!id) throw new Error(`buildTimeline: ${stageSelector} missing data-composition-id`);
    const tl = global.gsap.timeline({ paused: true });
    registerTimeline(id, tl);
    return tl;
  };

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
    const MAX_ITERATIONS = 100;
    let iterations = 0;
    while (el.scrollWidth > maxWidth && size > minFontSize) {
      if (iterations >= MAX_ITERATIONS) {
        const ident = el.id ? `#${el.id}` : el.className ? `.${el.className}` : el.tagName;
        console.warn(
          `[hf] fitText: hit ${MAX_ITERATIONS}-iteration cap on ${ident}; shorten text or widen container. text="${el.textContent}"`,
        );
        break;
      }
      size -= 1;
      el.style.fontSize = `${size}px`;
      iterations += 1;
    }
  };

  global.__hf = global.__hf || {};
  global.__hf.registerTimeline = registerTimeline;
  global.__hf.buildTimeline = buildTimeline;
  global.__hf.counter = counter;
  global.__hf.staggerIn = staggerIn;
  global.__hf.fitText = fitText;
})(window);
