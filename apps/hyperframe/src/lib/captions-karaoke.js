/*
 * TikTok-style karaoke caption renderer for Hyperframes.
 *
 * Input: captions array shape `[{ text, start, end, confidence? }]` in seconds.
 * Output: DOM nodes appended to `container`, all driven by `tl.set` so the
 * Hyperframes engine's frame-by-frame `tl.seek(t)` reliably materialises the
 * correct state on every frame.
 *
 * Why `tl.set` and not `tl.add(callback)` or `tl.to(... onStart)`:
 * Hyperframes seeks the timeline (does not play it). Callbacks attached to
 * tweens (`onStart`/`onComplete`) and timeline-level callbacks (`tl.add`,
 * `tl.call`) are NOT reliably invoked during seek. `tl.set(target, props, t)`
 * is a zero-duration tween whose properties are correctly applied at any
 * seek position — that's what we need.
 *
 * Theming: active-token styling is applied via the `--active` class toggle.
 * Each episode owns the visual treatment by declaring CSS like:
 *
 *   #captions .hf-caption-token { color: var(--paper); opacity: 0.78; }
 *   #captions .hf-caption-token.--active {
 *     color: var(--your-accent);
 *     opacity: 1;
 *     transform: scale(1.08);
 *   }
 *
 * No accent color is hardcoded here — the theme system is the single source
 * of truth.
 *
 * Idempotent — safe to load multiple times via sub-comp inlining.
 */
((global) => {
  global.__hf = global.__hf || {};

  const TOKEN_CLASS = "hf-caption-token";
  const ACTIVE_CLASS = "--active";

  const normalize = (captions) => {
    if (!Array.isArray(captions)) return [];
    return captions
      .map((c) => {
        if (c == null) return null;
        const text = typeof c.text === "string" ? c.text : "";
        if (!text) return null;
        if (typeof c.start !== "number" || typeof c.end !== "number") return null;
        if (c.start >= c.end) {
          console.warn("[hf] karaoke: dropping caption with reversed or zero-length timestamps", c);
          return null;
        }
        const out = { text, start: c.start, end: c.end };
        if (typeof c.confidence === "number") out.confidence = c.confidence;
        return out;
      })
      .filter((c) => c != null);
  };

  const groupCaptions = (captions, opts = {}) => {
    const maxChars = opts.maxChars ?? 28;
    const maxTokens = opts.maxTokens ?? 6;
    const sentenceEnd = /[.!?…]$/;
    const pages = [];
    let buf = [];
    let bufChars = 0;

    const flush = () => {
      if (buf.length === 0) return;
      pages.push({
        tokens: buf,
        start: buf[0].start,
        end: buf[buf.length - 1].end,
      });
      buf = [];
      bufChars = 0;
    };

    for (const tok of captions) {
      const len = tok.text.trim().length;
      const wouldOverflow = bufChars + len > maxChars || buf.length >= maxTokens;
      if (wouldOverflow && buf.length > 0) flush();
      buf.push(tok);
      bufChars += len + (buf.length > 1 ? 1 : 0);
      if (sentenceEnd.test(tok.text.trim())) flush();
    }
    flush();
    return pages;
  };

  const karaoke = (tl, container, captionsRaw, opts = {}) => {
    const root = typeof container === "string" ? document.querySelector(container) : container;
    if (!root) throw new Error(`karaoke: ${container} not found`);

    const captions = normalize(captionsRaw);
    if (captions.length === 0) return [];
    const pages = groupCaptions(captions, opts);

    pages.forEach((page) => {
      const pageEl = document.createElement("div");
      pageEl.className = "hf-caption-page";
      Object.assign(pageEl.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0 0.32em",
        padding: "0 6%",
        textAlign: "center",
        // Pages are HIDDEN by default; turned on by tl.set at page.start.
        opacity: "0",
      });

      page.tokens.forEach((tok) => {
        const span = document.createElement("span");
        span.className = TOKEN_CLASS;
        span.textContent = tok.text.trim();
        span.style.display = "inline-block";
        pageEl.appendChild(span);
      });
      root.appendChild(pageEl);

      // Page-level visibility: visible during [page.start, page.end].
      tl.set(pageEl, { opacity: 1 }, page.start);
      tl.set(pageEl, { opacity: 0 }, page.end);

      // Per-token activation: toggle the `.--active` class so each episode's
      // CSS owns the visual treatment. We assign explicit className strings
      // (instead of GSAP's `+=`/`-=` relative syntax) because in seek mode
      // GSAP's className diff is computed against the className snapshot at
      // construction time — so a later `-=` may end up writing back the
      // post-`+=` value as if `--active` had never been added, leaving stale
      // inline styles. Explicit literal classNames at each set() are
      // unambiguous and seek-safe.
      const activeClassName = `${TOKEN_CLASS} ${ACTIVE_CLASS}`;
      page.tokens.forEach((tok, tokIdx) => {
        const span = pageEl.children[tokIdx];
        tl.set(span, { className: activeClassName }, tok.start);
        tl.set(span, { className: TOKEN_CLASS }, tok.end);
      });
    });

    return pages;
  };

  global.__hf.karaoke = karaoke;
  global.__hf.groupCaptions = groupCaptions;
  global.__hf.normalizeCaptions = normalize;
})(window);
