/* 3D lanyard — a fabric strap and ID card hanging from a pin.
   Rendering: three.js. Physics: a small hand-written solver (no physics library):
     · the strap is a verlet rope pinned at the top,
     · the card swings as a pendulum from the rope's end (driven by that end's acceleration),
     · the card also yaws (spins) with a spring that brings it back to face the viewer.
   Drag the card to pull and fling it. Built into js/vendor/lanyard3d.min.js with esbuild:
     npx esbuild src/lanyard3d.js --bundle --minify --format=iife --outfile=js/vendor/lanyard3d.min.js
   Exposes window.Lanyard3D.init(host, options). */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, ShapeGeometry, ExtrudeGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, CanvasTexture, BufferGeometry, BufferAttribute,
  Vector3, Vector2, Raycaster, Plane, DoubleSide, SRGBColorSpace, RepeatWrapping,
  PMREMGenerator, DirectionalLight, AmbientLight, TorusGeometry, BoxGeometry, CatmullRomCurve3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const CARD_W = 1.6, CARD_H = 2.4, CARD_R = 0.14, CARD_D = 0.05;
const CLIP_GAP = 0.22;                         // attach point → top of card
const CARD_OFF = CARD_H / 2 + CLIP_GAP;        // attach point → card centre
const STRAP_W = 0.36;
const FACE_LIFT = 0.014;                       // faces sit just outside the bevelled edge
const SEGMENTS = 14;                           // rope segments
const GRAVITY = 14;
const STEP = 1 / 120;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── Textures ───────────────────────────────────────────────────────────── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function track(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

function barcode(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  let cx = x, i = 0;
  const pattern = [3, 2, 6, 3, 2, 9, 3, 2, 3, 6, 2, 3, 9, 2];
  while (cx < x + w) { const bw = pattern[i++ % pattern.length]; ctx.fillRect(cx, y, bw, h); cx += bw + pattern[(i + 3) % pattern.length]; }
}

function drawFront(avatar) {
  const c = document.createElement('canvas'); c.width = 700; c.height = 1050;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 700, 1050); bg.addColorStop(0, '#1d1d1d'); bg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 700, 1050);
  // top bar
  const bar = ctx.createLinearGradient(0, 0, 700, 0); bar.addColorStop(0, '#ffffff'); bar.addColorStop(1, '#8c8c8c');
  ctx.fillStyle = bar; ctx.fillRect(0, 0, 700, 14);
  // slot
  ctx.fillStyle = '#050505'; roundRect(ctx, 275, 58, 150, 30, 15); ctx.fill();
  // avatar ring
  const ring = ctx.createLinearGradient(220, 220, 480, 480); ring.addColorStop(0, '#ffffff'); ring.addColorStop(1, '#6a6a6a');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(350, 360, 136, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(350, 360, 128, 0, Math.PI * 2); ctx.fill();
  if (avatar) {
    ctx.save(); ctx.beginPath(); ctx.arc(350, 360, 128, 0, Math.PI * 2); ctx.clip();
    const s = Math.max(256 / avatar.width, 256 / avatar.height);
    ctx.drawImage(avatar, 350 - avatar.width * s / 2, 360 - avatar.height * s / 2, avatar.width * s, avatar.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 150px Syne, system-ui, sans-serif'; ctx.fillText('C', 350, 372);
  }
  // text
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff'; ctx.font = '700 70px Syne, system-ui, sans-serif'; track(ctx, 3); ctx.fillText('Christian', 350, 608);
  ctx.fillStyle = '#ffffff'; ctx.font = '500 29px "DM Sans", system-ui, sans-serif'; track(ctx, 5); ctx.fillText('CS STUDENT', 350, 672);
  ctx.fillStyle = '#9a9a9a'; track(ctx, 4); ctx.fillText('ZAMBOANGA, PH', 350, 722);
  // id box
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; roundRect(ctx, 175, 770, 350, 62, 12); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
  ctx.fillStyle = '#9a9a9a'; ctx.font = '500 28px ui-monospace, Menlo, monospace'; track(ctx, 5); ctx.fillText('DEV · 0001 · PH', 350, 811);
  barcode(ctx, 130, 900, 440, 70);
  // frame
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 3; roundRect(ctx, 3, 3, 694, 1044, 40); ctx.stroke();
  return c;
}

function drawBack() {
  const c = document.createElement('canvas'); c.width = 700; c.height = 1050;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(700, 0, 0, 1050); bg.addColorStop(0, '#1b1b1b'); bg.addColorStop(1, '#080808');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 700, 1050);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(350, 440, 170, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 220px Syne, system-ui, sans-serif'; ctx.fillText('C', 350, 462);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#9a9a9a'; ctx.font = '500 30px "DM Sans", system-ui, sans-serif'; track(ctx, 5);
  ctx.fillText('CHRISTIAN — PORTFOLIO', 350, 760);
  barcode(ctx, 130, 900, 440, 70);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 3; roundRect(ctx, 3, 3, 694, 1044, 40); ctx.stroke();
  return c;
}

function drawStrap(theme) {
  const light = theme === 'light';
  const bg = light ? '#0d0d0d' : '#ececec', fg = light ? '#f2f2f2' : '#101010', edge = light ? '#3a3a3a' : '#b4b4b4';
  const c = document.createElement('canvas'); c.width = 128; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 1024);
  ctx.fillStyle = edge; ctx.fillRect(8, 0, 3, 1024); ctx.fillRect(117, 0, 3, 1024);
  ctx.save(); ctx.translate(64, 512); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 50px Syne, system-ui, sans-serif'; track(ctx, 7);
  ctx.fillText('CHRISTIAN  ·  CS STUDENT  ·', 0, 2);
  ctx.restore();
  return c;
}

/* ── Geometry helpers ───────────────────────────────────────────────────── */
function cardShape(w, h, r) {
  const s = new Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function normalizeUV(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
}

function makeRibbon(samples) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(samples * 2 * 3), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(samples * 2 * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(samples * 2 * 2), 2));
  const idx = [];
  for (let i = 0; i < samples - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  return geo;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
  });
}

/* ── Main ───────────────────────────────────────────────────────────────── */
function init(host, options = {}) {
  const reducedMotion = Boolean(options.reducedMotion);
  const html = document.documentElement;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 3, 5); scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.45); fill.position.set(-3, 0.5, 3); scene.add(fill);
  scene.add(new AmbientLight(0xffffff, 0.35));

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);

  /* strap */
  const strapTex = new CanvasTexture(drawStrap(html.dataset.theme));
  strapTex.colorSpace = SRGBColorSpace; strapTex.wrapT = RepeatWrapping; strapTex.anisotropy = 8;
  const ribbonGeo = makeRibbon(48);
  const ribbon = new Mesh(ribbonGeo, new MeshStandardMaterial({ map: strapTex, roughness: 0.65, metalness: 0, side: DoubleSide }));
  ribbon.frustumCulled = false;
  scene.add(ribbon);

  /* pin the strap hangs from */
  const metal = new MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.9, roughness: 0.28 });
  const pin = new Group();
  const pinPlate = new Mesh(new BoxGeometry(0.62, 0.16, 0.08), metal);
  const pinRing = new Mesh(new TorusGeometry(0.13, 0.03, 12, 28), metal); pinRing.position.y = -0.14;
  pin.add(pinPlate, pinRing); scene.add(pin);

  /* card group: origin = attach point (end of strap) */
  const rig = new Group(); rig.rotation.order = 'ZYX'; scene.add(rig);
  const cardRoot = new Group(); cardRoot.position.y = -CARD_OFF; rig.add(cardRoot);

  const shape = cardShape(CARD_W, CARD_H, CARD_R);
  const frontGeo = new ShapeGeometry(shape, 16); normalizeUV(frontGeo, CARD_W, CARD_H); frontGeo.translate(0, 0, CARD_D / 2 + FACE_LIFT);
  const backGeo = new ShapeGeometry(shape, 16); normalizeUV(backGeo, CARD_W, CARD_H); backGeo.rotateY(Math.PI); backGeo.translate(0, 0, -CARD_D / 2 - FACE_LIFT);
  const edgeGeo = new ExtrudeGeometry(shape, { depth: CARD_D, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
  edgeGeo.translate(0, 0, -CARD_D / 2);

  const faceProps = { roughness: 0.38, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.18 };
  const frontMat = new MeshPhysicalMaterial({ ...faceProps });
  const backMat = new MeshPhysicalMaterial({ ...faceProps });
  const frontMesh = new Mesh(frontGeo, frontMat), backMesh = new Mesh(backGeo, backMat);
  const edgeMesh = new Mesh(edgeGeo, new MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.85, roughness: 0.32 }));
  cardRoot.add(edgeMesh, frontMesh, backMesh);

  const clip = new Group(); clip.position.y = CARD_OFF - 0.1;
  const clipBody = new Mesh(new BoxGeometry(0.36, 0.2, 0.08), metal); clipBody.position.y = -0.03;
  const clipRing = new Mesh(new TorusGeometry(0.085, 0.026, 12, 24), metal); clipRing.position.y = 0.17;
  clip.add(clipBody, clipRing); cardRoot.add(clip);

  const textures = [];
  const makeTex = (cv) => { const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; textures.push(t); return t; };
  const setFaces = (avatar) => {
    frontMat.map = makeTex(drawFront(avatar)); backMat.map = makeTex(drawBack());
    frontMat.needsUpdate = backMat.needsUpdate = true; wake();
  };

  /* rope state */
  const P = Array.from({ length: SEGMENTS + 1 }, () => ({ x: 0, y: 0, px: 0, py: 0, w: 1 }));
  let anchorX = 0, anchorY = 0, ropeLen = 4, seg = 1;
  let phi = 0, phiVel = 0, theta = 0, thetaVel = 0, axSmooth = 0, lastVx = 0;

  const drag = { active: false, grab: new Vector2(), target: new Vector2(), lastW: new Vector2(), vx: 0 };

  function layout() {
    const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1), aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    let visH = 7.4; if (aspect * visH < 4.8) visH = 4.8 / aspect;
    camera.position.set(0, 0, (visH / 2) / Math.tan((camera.fov * Math.PI) / 360));
    camera.updateProjectionMatrix();
    anchorX = 0; anchorY = visH / 2 - 0.3;
    ropeLen = Math.max(1.6, visH - 0.3 - CARD_OFF * 2 - CLIP_GAP * 0.4 - 0.45);
    seg = ropeLen / SEGMENTS;
    pin.position.set(anchorX, anchorY + 0.12, 0);
    resetRope(0);
  }

  function resetRope(angle) {
    const s = Math.sin(angle), c = Math.cos(angle);
    P.forEach((p, i) => { p.x = p.px = anchorX + s * seg * i; p.y = p.py = anchorY - c * seg * i; p.w = i === 0 ? 0 : 1; });
    phi = angle; phiVel = 0; theta = 0; thetaVel = 0; axSmooth = 0; lastVx = 0;
    syncMeshes(); wake();
  }

  /* ── physics ── */
  function step(dt) {
    const last = P[SEGMENTS];
    const lx0 = last.x;
    if (drag.active) {
      last.px = last.x; last.py = last.y;
      last.x += (drag.target.x - last.x) * 0.45; last.y += (drag.target.y - last.y) * 0.45;
      last.w = 0;
    } else last.w = 0.3;

    // verlet integrate
    for (let i = 1; i < SEGMENTS; i++) {
      const p = P[i], vx = (p.x - p.px) * 0.9925, vy = (p.y - p.py) * 0.9925;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy - GRAVITY * dt * dt;
    }
    if (!drag.active) {
      const vx = (last.x - last.px) * 0.9925, vy = (last.y - last.py) * 0.9925;
      last.px = last.x; last.py = last.y; last.x += vx; last.y += vy - GRAVITY * dt * dt;
    }

    // distance constraints
    for (let it = 0; it < 14; it++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6, diff = (d - seg) / d, ws = a.w + b.w;
        if (!ws) continue;
        a.x += dx * diff * (a.w / ws); a.y += dy * diff * (a.w / ws);
        b.x -= dx * diff * (b.w / ws); b.y -= dy * diff * (b.w / ws);
      }
    }

    // horizontal acceleration of the attach point drives the card pendulum
    const vxNow = (last.x - lx0) / dt;
    const ax = clamp((vxNow - lastVx) / dt, -80, 80);
    lastVx = vxNow;
    axSmooth += (ax - axSmooth) * 0.25;

    const h = CARD_OFF;
    const phiAcc = -(GRAVITY / h) * Math.sin(phi) - (axSmooth / h) * Math.cos(phi) - 2.4 * phiVel;
    phiVel += phiAcc * dt; phi = clamp(phi + phiVel * dt, -1.35, 1.35);

    let thetaAcc = -9 * theta - 1.4 * thetaVel - axSmooth * 0.035;
    if (drag.active) thetaAcc += 26 * (clamp(drag.vx * 0.09, -0.8, 0.8) - theta);
    thetaVel += thetaAcc * dt; theta = clamp(theta + thetaVel * dt, -1.6, 1.6);
  }

  function energy() {
    let e = Math.abs(phiVel) + Math.abs(thetaVel) + Math.abs(phi) * 0.2 + Math.abs(theta) * 0.2;
    for (let i = 1; i <= SEGMENTS; i++) e += Math.hypot(P[i].x - P[i].px, P[i].y - P[i].py) * 40;
    return e;
  }

  /* ── drawing ── */
  const curvePts = P.map(() => new Vector3());
  function syncMeshes() {
    const last = P[SEGMENTS];
    rig.position.set(last.x, last.y, 0);
    rig.rotation.set(0, theta, phi);
    key.position.x = 2.5 + last.x * 0.3;

    P.forEach((p, i) => curvePts[i].set(p.x, p.y, 0));
    const curve = new CatmullRomCurve3(curvePts, false, 'centripetal');
    const n = ribbonGeo.attributes.position.count / 2, pos = ribbonGeo.attributes.position, uv = ribbonGeo.attributes.uv;
    const tile = (1024 / 128) * STRAP_W;
    const pts = curve.getPoints(n - 1);
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
      if (i > 0) dist += p.distanceTo(pts[i - 1]);
      let tx = q.x - o.x, ty = q.y - o.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty * STRAP_W / 2, ny = tx * STRAP_W / 2;
      pos.setXYZ(i * 2, p.x + nx, p.y + ny, 0); pos.setXYZ(i * 2 + 1, p.x - nx, p.y - ny, 0);
      uv.setXY(i * 2, 0, dist / tile); uv.setXY(i * 2 + 1, 1, dist / tile);
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
  }

  function render() { syncMeshes(); renderer.render(scene, camera); }

  /* ── loop (runs only while something is moving and the canvas is visible) ── */
  let raf = 0, lastT = 0, acc = 0, calm = 0, visible = true;
  function frame(now) {
    raf = 0;
    const dt = Math.min((now - lastT) / 1000, 0.05); lastT = now; acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    render();
    calm = drag.active || energy() > 0.12 ? 0 : calm + 1;
    if (visible && calm < 45) raf = requestAnimationFrame(frame);
  }
  function wake() { calm = 0; if (!raf && visible) { lastT = performance.now(); acc = 0; raf = requestAnimationFrame(frame); } }

  /* ── pointer ── */
  const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane(new Vector3(0, 0, 1), 0), hit = new Vector3();
  const cardCentre = () => new Vector2(P[SEGMENTS].x + Math.sin(phi) * CARD_OFF, P[SEGMENTS].y - Math.cos(phi) * CARD_OFF);
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const overCard = (e) => { setRay(e); return ray.intersectObjects([frontMesh, backMesh, edgeMesh, clipBody], false).length > 0; };
  const planePoint = (e) => { setRay(e); return ray.ray.intersectPlane(plane, hit) ? new Vector2(hit.x, hit.y) : null; };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !overCard(e)) return;
    const w = planePoint(e); if (!w) return;
    drag.active = true; drag.lastW.copy(w); drag.vx = 0;
    drag.grab.copy(w).sub(cardCentre());
    drag.target.set(P[SEGMENTS].x, P[SEGMENTS].y);
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag.active) { canvas.style.cursor = overCard(e) ? 'grab' : 'default'; return; }
    const w = planePoint(e); if (!w) return;
    drag.vx += ((w.x - drag.lastW.x) * 60 - drag.vx) * 0.3; drag.lastW.copy(w);
    const c = w.clone().sub(drag.grab);
    let tx = c.x - Math.sin(phi) * CARD_OFF, ty = c.y + Math.cos(phi) * CARD_OFF;
    const dx = tx - anchorX, dy = ty - anchorY, d = Math.hypot(dx, dy), max = ropeLen * 0.995;
    if (d > max) { tx = anchorX + (dx / d) * max; ty = anchorY + (dy / d) * max; }
    drag.target.set(tx, ty);
    wake();
  });
  const release = (e) => {
    if (!drag.active) return;
    drag.active = false; thetaVel += clamp(drag.vx * 0.5, -6, 6);
    canvas.style.cursor = overCard(e) ? 'grab' : 'default'; wake();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  /* ── lifecycle ── */
  const ro = new ResizeObserver(() => { layout(); render(); });
  ro.observe(host);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); });
  io.observe(host);

  // Re-colour the strap when the theme changes.
  const mo = new MutationObserver(() => {
    strapTex.image = drawStrap(html.dataset.theme); strapTex.needsUpdate = true; wake();
  });
  mo.observe(html, { attributes: true, attributeFilter: ['data-theme'] });

  layout();
  setFaces(null);                                   // monogram first, so something shows immediately
  Promise.race([document.fonts?.load('800 100px Syne'), new Promise((r) => setTimeout(r, 1500))])
    .then(() => loadImage(options.avatar))
    .then((img) => { setFaces(img); });             // redraw once fonts / avatar are ready
  render();

  return {
    /** Physics snapshot — used by tests. */
    state() { return { phi, theta, endX: P[SEGMENTS].x, endY: P[SEGMENTS].y, anchorX, anchorY, ropeLen, energy: energy(), running: Boolean(raf) }; },
    /** Card centre in client (viewport) pixels — used by tests. */
    screenCenter() {
      rig.updateMatrixWorld(true);
      const v = new Vector3(0, -CARD_OFF, 0); rig.localToWorld(v); v.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    kick(deg = 24) { if (reducedMotion) return; resetRope((deg * Math.PI) / 180); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect();
      textures.forEach((t) => t.dispose()); strapTex.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}

window.Lanyard3D = { init };
