/* Portfolio interactions. No framework; smooth scrolling uses the vendored
   Lenis library (js/vendor/lenis.min.js, MIT). Sections, in order:
   helpers · loader · theme · header + menu · smooth scroll · typewriter ·
   reveal · active nav · hero tilt · lanyard · carousel · repo tabs · avatar */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
    sessionSet: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  /* ── Smooth scroll (Lenis) ──────────────────────────────────────────────
     Falls back to native scrolling if the library is missing or the visitor
     prefers reduced motion. */
  let lenis = null;
  if (typeof window.Lenis === 'function' && !reduced.matches) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const lockScroll = (on) => { if (lenis) (on ? lenis.stop() : lenis.start()); };

  /* ── Loader ─────────────────────────────────────────────────────────────
     Shown once per browser session. The counter eases to 100 over a minimum
     of ~1.5 s and waits for the window load event before finishing. */
  const readyHandlers = [];
  const whenReady = (fn) => (html.classList.contains('is-ready') && !html.classList.contains('has-loader') ? fn() : readyHandlers.push(fn));
  const fireReady = () => { html.classList.add('is-ready'); readyHandlers.splice(0).forEach((fn) => fn()); };

  (function loader() {
    const el = $('#loader');
    if (!el || !html.classList.contains('has-loader')) { fireReady(); return; }

    const count = $('#loaderCount'), bar = $('#loaderBar');
    const MIN_MS = 1500;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; });
    lockScroll(true);

    const t0 = performance.now();
    (function tick(now) {
      const p = clamp((now - t0) / MIN_MS, 0, 1);
      const value = Math.min(ease(p) * 100, loaded ? 100 : 92);
      count.textContent = pad(Math.round(value), 3);
      bar.style.transform = `scaleX(${value / 100})`;
      if (value < 100) { requestAnimationFrame(tick); return; }
      setTimeout(finish, 250);
    })(t0);

    function finish() {
      el.classList.add('is-done');
      html.classList.remove('has-loader');
      store.sessionSet('intro-seen', '1');
      lockScroll(false);
      fireReady();                               // hero entrance starts under the lifting curtain
      setTimeout(() => el.remove(), 1100);
    }
  })();

  /* ── Theme toggle ─────────────────────────────────────────────────────── */
  (function theme() {
    const btn = $('#themeToggle');
    const meta = $('meta[name="theme-color"]');
    if (!btn) return;

    const apply = (name) => {
      html.dataset.theme = name;
      if (meta) meta.content = name === 'light' ? '#fafafa' : '#050505';
      btn.setAttribute('aria-label', `Switch to ${name === 'light' ? 'dark' : 'light'} theme`);
    };
    apply(html.dataset.theme === 'light' ? 'light' : 'dark');

    btn.addEventListener('click', () => {
      const next = html.dataset.theme === 'light' ? 'dark' : 'light';
      html.classList.add('theme-anim');
      apply(next);
      store.set('theme', next);
      setTimeout(() => html.classList.remove('theme-anim'), 600);
    });
  })();

  /* ── Header: scrolled state, hide on scroll down, mobile menu ─────────── */
  const header = $('#siteHeader');
  const menuBtn = $('#menuBtn');
  let navLockUntil = 0;                          // keep header visible during anchor jumps

  (function headerBehaviour() {
    if (!header) return;
    let lastY = window.scrollY;

    window.addEventListener('scroll', () => {
      const y = window.scrollY, dy = y - lastY;
      header.classList.toggle('is-scrolled', y > 8);
      if (html.classList.contains('menu-open') || performance.now() < navLockUntil || y < 120) {
        header.classList.remove('is-hidden');
      } else if (Math.abs(dy) > 6) {
        header.classList.toggle('is-hidden', dy > 0);
      }
      lastY = y;
    }, { passive: true });

    // Reveal the header when keyboard focus lands in it.
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  })();

  function setMenu(open) {
    if (!menuBtn) return;
    html.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    lockScroll(open);
    if (!lenis) document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && html.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ── Anchor links ─────────────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    const target = id.length > 1 ? $(id) : null;
    if (!target) return;
    e.preventDefault();

    const wasOpen = html.classList.contains('menu-open');
    if (wasOpen) setMenu(false);
    navLockUntil = performance.now() + 1600;
    header?.classList.remove('is-hidden');

    // Lenis reads the CSS scroll-padding-top, so sections land just below the header.
    if (lenis) lenis.scrollTo(target, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  });

  /* ── Typewriter (starts once the page is revealed) ────────────────────── */
  (function typewriter() {
    const el = $('#type');
    if (!el) return;
    const roles = ['Full Stack Developer', 'Computer Science Student', 'UI/UX Enthusiast', 'Open Source Contributor'];
    if (reduced.matches) { el.textContent = roles[0]; return; }

    let role = 0, chars = 0, deleting = false;
    const tick = () => {
      const word = roles[role];
      chars += deleting ? -1 : 1;
      el.textContent = word.slice(0, chars);
      let delay = deleting ? 45 : 85;
      if (!deleting && chars === word.length) { deleting = true; delay = 1800; }
      else if (deleting && chars === 0) { deleting = false; role = (role + 1) % roles.length; delay = 350; }
      setTimeout(tick, delay);
    };
    whenReady(() => setTimeout(tick, 700));
  })();

  /* ── Scroll reveal ────────────────────────────────────────────────────── */
  (function reveal() {
    const items = $$('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduced.matches) { items.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
        entry.target.style.setProperty('--reveal-delay', `${i * 90}ms`);
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  })();

  /* ── Active nav link ──────────────────────────────────────────────────── */
  (function activeNav() {
    const links = $$('[data-nav-link]');
    const ids = [...new Set(links.map((a) => a.getAttribute('href')))];
    const sections = ids.map((id) => $(id)).filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${id}`)));
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      const current = sections.filter((s) => visible.has(s.id)).pop();
      if (current) setActive(current.id);
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => io.observe(s));

    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(sections[sections.length - 1].id);
    }, { passive: true });
  })();

  /* ── Hero card tilt ───────────────────────────────────────────────────── */
  (function heroTilt() {
    const card = $('#idCard'), hero = $('#home');
    if (!card || !hero || reduced.matches || !window.matchMedia('(hover: hover)').matches) return;

    const MAX = 11;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, onScreen = true;
    const frame = () => {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
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
    html.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) kick(); }).observe(hero);
  })();

  /* ── Lanyard badge physics ────────────────────────────────────────────── */
  (function lanyard() {
    const root = $('#lanyard'), swing = $('#lanyardSwing'), string = $('#lanyardString'), card = $('#lanyardCard'), about = $('#about');
    if (!root || !swing || !string || !card) return;

    const STRING_H = 58, MAX_ANGLE = 35, MAX_STRETCH = 120;
    const RETURN = 0.11, DAMP = 0.955, ELASTIC = 0.14, STRETCH_DAMP = 0.9, STEP = 1000 / 60;
    let angle = 0, vel = 0, stretch = 0, sVel = 0, dragging = false, lastDx = 0, raf = 0, last = 0, acc = 0;

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
      acc += Math.min(now - last, 100); last = now;
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
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - r.top;
      angle = clamp(dx * 0.2, -MAX_ANGLE, MAX_ANGLE);
      stretch = dy > STRING_H ? Math.min((dy - STRING_H) * 0.75, MAX_STRETCH) : 0;
      vel = (dx - lastDx) * 0.025; lastDx = dx;
    });
    const release = () => { dragging = false; root.classList.remove('is-dragging'); start(); };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);

    if (about && !reduced.matches && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect(); angle = -22; vel = 0; start();
      }, { threshold: 0.4 });
      io.observe(about);
    }
  })();

  /* ── 3D lanyard ───────────────────────────────────────────────────────────
     Loads three.js (js/vendor/lanyard3d.min.js, ~0.6 MB) only when the About
     section is near. If WebGL or the script is unavailable, the 2D lanyard
     above stays in place. */
  (function lanyard3d() {
    const host = $('#lanyard3d'), fallback = $('#lanyard'), panel = $('.about-panel'), about = $('#about');
    if (!host || !fallback || !panel || !about) return;

    const hasWebGL = (() => {
      try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
    })();
    if (!hasWebGL || !('IntersectionObserver' in window)) return;

    let api = null, kicked = false;

    function load() {
      const script = document.createElement('script');
      script.src = 'js/vendor/lanyard3d.min.js';
      script.onload = () => {
        try {
          panel.classList.add('has-3d'); host.hidden = false; fallback.hidden = true;
          api = window.Lanyard3D.init(host, { reducedMotion: reduced.matches, avatar: 'assets/images/avatar.png' });
          host._lanyard = api;                       // handle for debugging and tests
          maybeKick();
        } catch (err) {
          console.warn('3D lanyard unavailable, keeping the 2D version.', err);
          panel.classList.remove('has-3d'); host.hidden = true; fallback.hidden = false;
          api = null;
        }
      };
      document.head.appendChild(script);
    }

    const maybeKick = () => { if (api && !kicked && visible) { kicked = true; api.kick(26); } };

    let visible = false;
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { near.disconnect(); load(); }
    }, { rootMargin: '700px 0px' });
    near.observe(about);

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; maybeKick(); }, { threshold: 0.4 }).observe(about);
  })();

  /* ── Project carousel ─────────────────────────────────────────────────────
     Arrows, index list, keyboard (← →) and drag/swipe. Does not wrap. */
  (function carousel() {
    const root = $('#carousel'), track = $('#carTrack');
    if (!root || !track) return;
    const slides = $$('.slide', track);
    const prev = $('#carPrev'), next = $('#carNext'), current = $('#carCurrent'), live = $('#carLive');
    const listBtns = $$('#carList button');
    let index = 0;

    function go(i, { announce = true } = {}) {
      index = clamp(i, 0, slides.length - 1);
      track.style.transform = `translateX(${-index * 100}%)`;
      slides.forEach((s, k) => { s.inert = k !== index; s.setAttribute('aria-hidden', String(k !== index)); });
      current.textContent = pad(index + 1);
      prev.disabled = index === 0;
      next.disabled = index === slides.length - 1;
      listBtns.forEach((b, k) => b.setAttribute('aria-current', String(k === index)));
      if (announce) live.textContent = `Project ${index + 1} of ${slides.length}: ${$('h3', slides[index]).textContent}`;
    }

    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    listBtns.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.slide))));

    const region = root.closest('[data-reveal]') || root;
    region.addEventListener('keydown', (e) => {
      if (e.target.closest('#carList') && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // Drag / swipe: the track follows the pointer, then snaps.
    let startX = 0, startY = 0, dx = 0, tracking = false, dragging = false, width = 1, t0 = 0;
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('a, button')) return;
      tracking = true; dragging = false; startX = e.clientX; startY = e.clientY; dx = 0; width = root.clientWidth; t0 = performance.now();
    });
    root.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - startY)) return;
        dragging = true; root.classList.add('is-dragging'); root.setPointerCapture(e.pointerId);
      }
      const atEdge = (index === 0 && dx > 0) || (index === slides.length - 1 && dx < 0);
      const shift = atEdge ? dx * 0.3 : dx;      // resistance at the ends
      track.style.transform = `translateX(calc(${-index * 100}% + ${shift}px))`;
    });
    const end = () => {
      if (!tracking) return;
      tracking = false;
      root.classList.remove('is-dragging');
      if (!dragging) return;
      dragging = false;
      const fast = Math.abs(dx) / Math.max(performance.now() - t0, 1) > 0.5;
      if (Math.abs(dx) > width * 0.18 || (fast && Math.abs(dx) > 40)) go(index + (dx < 0 ? 1 : -1));
      else go(index, { announce: false });
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    go(0, { announce: false });
  })();

  /* ── Open-source tabs ─────────────────────────────────────────────────── */
  (function repoTabs() {
    const tabs = $$('.os-tab'), pages = $$('.os-page'), dots = $$('.os-dot');
    if (!tabs.length) return;
    const show = (index, { focus = false } = {}) => {
      tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; if (i === index && focus) tab.focus(); });
      pages.forEach((p, i) => p.classList.toggle('is-active', i === index));
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
    };
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

  /* ── Avatar fallback ──────────────────────────────────────────────────────
     If assets/images/avatar.png is missing, hide the broken image so the
     monogram behind it shows. */
  $$('img[data-avatar]').forEach((img) => {
    const hide = () => img.classList.add('is-missing');
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });
})();
