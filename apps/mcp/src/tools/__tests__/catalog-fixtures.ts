export const compliantBrandHtml = `<!doctype html>
<!-- catalog: [brand-logo-watermark, brand-logo-outro] -->
<html>
  <body>
    <div data-composition-id="fixture" data-duration="1" data-width="1080" data-height="1920">
      <div id="brand-corner" data-track-index="97">@brand</div>
      <section id="scene-brand-outro" class="scene clip" data-start="0.5" data-duration="0.5" data-track-index="7">
        <div class="brand-outro">
          <div class="brand-outro__lockup">
            <div id="brand-aura" class="brand-outro__aura"></div>
            <svg id="brand-mark" class="brand-outro__mark"><path d="M0 0h1" /></svg>
            <div id="brand-piece-left" class="brand-outro__piece"></div>
            <div id="brand-piece-top-left" class="brand-outro__piece"></div>
            <div id="brand-piece-bridge" class="brand-outro__piece"></div>
            <div id="brand-piece-bottom-right" class="brand-outro__piece"></div>
            <div id="brand-piece-right" class="brand-outro__piece"></div>
          </div>
          <h1 id="brand-name" class="brand-outro__name">cgaravitoq</h1>
          <p id="brand-tagline" class="brand-outro__tagline">AI Engineering</p>
          <p id="brand-source" class="brand-outro__source">Source: fixture</p>
        </div>
      </section>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.set(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)" }, 0);
      tl.to("#brand-corner", { autoAlpha: 0 }, 0);
      tl.to("#scene-brand-outro", { autoAlpha: 1 }, 0);
      tl.to(["#brand-name", "#brand-tagline", "#brand-source"], { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, 0.6);
      window.__timelines = window.__timelines || {};
      window.__timelines.fixture = tl;
    </script>
  </body>
</html>
`;
