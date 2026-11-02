/* Portfolio interactions: typewriter, scroll reveal, active nav, hero tilt,
   lanyard physics, repo tabs, avatar fallback. No dependencies. */
(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ── Avatar fallback ─────────────────────────────────────────────────────
     If assets/images/avatar.png is missing, hide the broken image and let the
     monogram behind it show. Handles errors that fired before this script ran. */
  document.querySelectorAll('img[data-avatar]').forEach((img) => {
    const hide = () => img.classList.add('is-missing');
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });

  /* ── Typewriter ───────────────────────────────────────────────────────── */
  (function typewriter() {
    const el = document.getElementById('type');
    if (!el) return;
    const roles = ['Full Stack Developer', 'Computer Science Student', 'UI/UX Enthusiast', 'Open Source Contributor'];

    if (prefersReducedMotion.matches) { el.textContent = roles[0]; return; }

    let role = 0, chars = 0, deleting = false;

    function tick() {
      const word = roles[role];
      chars += deleting ? -1 : 1;
      el.textContent = word.slice(0, chars);

      let delay = deleting ? 45 : 85;
      if (!deleting && chars === word.length) { deleting = true; delay = 1800; }
      else if (deleting && chars === 0) { deleting = false; role = (role + 1) % roles.length; delay = 350; }
      setTimeout(tick, delay);
    }
    setTimeout(tick, 600);
  })();

  /* ── Scroll reveal (one system, staggered within each batch) ──────────── */
  (function reveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || prefersReducedMotion.matches) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((entry, i) => {
          entry.target.style.setProperty('--reveal-delay', `${i * 90}ms`);
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  })();

  /* ── Active nav link ──────────────────────────────────────────────────── */
  (function activeNav() {
    const links = [...document.querySelectorAll('.site-nav a')];
    const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) =>
      links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${id}`)));

    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.set(e.target.id, e.intersectionRatio) : visible.delete(e.target.id)));
      // The last visible section in document order wins (the one nearest the reading line).
      const current = sections.filter((s) => visible.has(s.id)).pop();
      if (current) setActive(current.id);
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => io.observe(s));

    // Contact is short; when the page bottoms out, make sure it counts as current.
    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(sections[sections.length - 1].id);
      }
    }, { passive: true });
  })();

  /* ── Hero card tilt ───────────────────────────────────────────────────────
     Eases toward the pointer. The animation frame loop only runs while the card
     is still moving and the hero is on screen. */
  (function heroTilt() {
    const card = document.getElementById('idCard');
    const hero = document.getElementById('home');
    if (!card || !hero || prefersReducedMotion.matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return; // no pointer, no tilt

    const MAX = 11;                  // degrees
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, onScreen = true;

    const frame = () => {
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      card.style.transform = `rotateY(${x.toFixed(2)}deg) rotateX(${(-y).toFixed(2)}deg)`;
      raf = (Math.abs(tx - x) > 0.01 || Math.abs(ty - y) > 0.01) ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!raf && onScreen) raf = requestAnimationFrame(frame); };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !onScreen) return;
      tx = clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1) * MAX;
      ty = clamp((e.clientY / innerHeight - 0.5) * 2, -1, 1) * MAX;
      kick();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });

    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) kick(); }).observe(hero);
  })();

  /* ── Lanyard badge physics ────────────────────────────────────────────────
     A damped spring on swing angle plus a rubber-band stretch while dragged.
     String and card rotate as one group about the anchor point. */
  (function lanyard() {
    const root = document.getElementById('lanyard');
    const swing = document.getElementById('lanyardSwing');
    const string = document.getElementById('lanyardString');
    const card = document.getElementById('lanyardCard');
    const about = document.getElementById('about');
    if (!root || !swing || !string || !card) return;

    const STRING_H = 58;
    const MAX_ANGLE = 35, MAX_STRETCH = 120;
    const RETURN = 0.11, DAMP = 0.955;
    const ELASTIC = 0.14, STRETCH_DAMP = 0.9;
    const STEP = 1000 / 60;

    let angle = 0, vel = 0, stretch = 0, sVel = 0;
    let dragging = false, lastDx = 0, raf = 0, last = 0, acc = 0;

    const render = () => {
      swing.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      string.style.transform = `scaleY(${(1 + stretch / STRING_H).toFixed(3)})`;
      card.style.transform = `translateY(${stretch.toFixed(2)}px)`;
    };

    const atRest = () => Math.abs(angle) < 0.02 && Math.abs(vel) < 0.02 && stretch < 0.1 && Math.abs(sVel) < 0.1;

    const physicsStep = () => {
      vel += -angle * RETURN; vel *= DAMP; angle += vel;
      sVel += -stretch * ELASTIC; sVel *= STRETCH_DAMP; stretch += sVel;
      if (stretch < 0) { stretch = 0; sVel *= -0.5; }
      if (Math.abs(angle) > MAX_ANGLE) { angle = Math.sign(angle) * MAX_ANGLE; vel *= 0.4; }
    };

    const loop = (now) => {
      // Fixed timestep so the swing feels the same on 60 Hz and 120 Hz screens.
      acc += Math.min(now - last, 100);
      last = now;
      if (!dragging) {
        while (acc >= STEP) { physicsStep(); acc -= STEP; }
        if (atRest()) { angle = vel = stretch = sVel = 0; render(); raf = 0; return; }
      } else acc = 0;
      render();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf) { last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); } };

    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true; vel = sVel = 0; lastDx = 0;
      root.classList.add('is-dragging');
      root.setPointerCapture(e.pointerId);
      start();
    });

    root.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = root.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - r.top;
      angle = clamp(dx * 0.2, -MAX_ANGLE, MAX_ANGLE);
      stretch = dy > STRING_H ? Math.min((dy - STRING_H) * 0.75, MAX_STRETCH) : 0;
      vel = (dx - lastDx) * 0.025;
      lastDx = dx;
    });

    const release = () => { dragging = false; root.classList.remove('is-dragging'); start(); };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);

    // Intro: when the About section first scrolls into view, give the badge a push
    // and let the same spring settle it.
    if (about && !prefersReducedMotion.matches && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        angle = -22; vel = 0; start();
      }, { threshold: 0.4 });
      io.observe(about);
    }
  })();

  /* ── Open-source tabs ─────────────────────────────────────────────────── */
  (function repoTabs() {
    const tabs = [...document.querySelectorAll('.os-tab')];
    const pages = [...document.querySelectorAll('.os-page')];
    const dots = [...document.querySelectorAll('.os-dot')];
    if (!tabs.length) return;

    function show(index, { focus = false } = {}) {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      pages.forEach((p, i) => p.classList.toggle('is-active', i === index));
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => show(i));
      tab.addEventListener('keydown', (e) => {
        const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (dir) { e.preventDefault(); show((i + dir + tabs.length) % tabs.length, { focus: true }); }
        else if (e.key === 'Home') { e.preventDefault(); show(0, { focus: true }); }
        else if (e.key === 'End') { e.preventDefault(); show(tabs.length - 1, { focus: true }); }
      });
    });
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  })();
})();
