/* Flowing wave-lines background. One fixed <canvas> behind the page.
   Lines are drawn with layered sine waves; the pointer pushes them gently and
   scrolling shifts their phase. Colour comes from the theme (--ink), so it
   stays black/white. Static when the visitor prefers reduced motion. */
(() => {
  'use strict';
  const canvas = document.getElementById('bgWaves');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const small = window.matchMedia('(max-width: 760px)');

  let w = 0, h = 0, dpr = 1, lines = 40, step = 14;
  let ink = '255,255,255', baseAlpha = 0.1;
  let t = 0, last = 0, raf = 0, running = false;
  const pointer = { x: -1e3, y: -1e3, sx: -1e3, sy: -1e3, active: false };

  function readTheme() {
    const v = getComputedStyle(html).getPropertyValue('--ink').trim();
    ink = v || '255,255,255';
    baseAlpha = html.dataset.theme === 'light' ? 0.09 : 0.11;
    if (!running) draw();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lines = small.matches ? 26 : 44;
    step = small.matches ? 18 : 12;
    if (!running) draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const scroll = window.scrollY * 0.0016;
    const span = h * 1.1, top = -h * 0.05;
    ctx.lineWidth = 1;

    for (let i = 0; i < lines; i++) {
      const v = i / (lines - 1);
      const baseY = top + v * span;
      // lines fade toward the top and bottom of the screen
      const edge = Math.sin(v * Math.PI);
      ctx.strokeStyle = `rgba(${ink},${(baseAlpha * (0.35 + 0.65 * edge)).toFixed(3)})`;
      ctx.beginPath();
      for (let x = -step; x <= w + step; x += step) {
        const nx = x / w;
        let y = baseY
          + Math.sin(nx * 3.1 + t * 0.55 + v * 3.4 + scroll) * (26 + 22 * v)
          + Math.sin(nx * 6.2 - t * 0.38 + v * 7.1) * 11
          + Math.sin(nx * 1.4 + t * 0.21 - v * 2.0 + scroll * 0.6) * 34;
        if (pointer.active) {                       // soft push around the pointer
          const dx = x - pointer.sx, dy = baseY - pointer.sy, d2 = dx * dx + dy * dy;
          y -= 46 * Math.exp(-d2 / 52000) * Math.sign(dy || 1) * -1;
        }
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    t += dt;
    pointer.sx += (pointer.x - pointer.sx) * 0.08;
    pointer.sy += (pointer.y - pointer.sy) * 0.08;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced.matches || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (!pointer.active) { pointer.sx = e.clientX; pointer.sy = e.clientY; }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduced.addEventListener('change', () => { if (reduced.matches) { stop(); draw(); } else start(); });
  new MutationObserver(readTheme).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  readTheme();
  draw();
  start();
})();
