// Hero visual: points on a sphere (a "representation space") with a few identity
// clusters and the angular arcs between them. Drag to spin it (with inertia);
// point or touch a spot and its cosine-similarity neighbourhood lights up.
(function () {
  const c = document.getElementById('hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;   // touch screens
  const css = getComputedStyle(document.documentElement);
  const col = name => css.getPropertyValue(name).trim();

  // Fibonacci sphere: evenly spread unit vectors.
  const N = 420, pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  // Three "identity" clusters: a center + a few noisy samples around it.
  const centers = [[0.6, 0.5, 0.62], [-0.7, 0.2, 0.68], [0.1, -0.75, 0.65]].map(norm);
  const clusters = centers.map(cn => {
    const s = [];
    for (let k = 0; k < 7; k++) s.push(norm([cn[0] + rnd(.16), cn[1] + rnd(.16), cn[2] + rnd(.16)]));
    return s;
  });
  function rnd(a) { return (Math.random() * 2 - 1) * a; }
  function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }

  let W, H, R, dpr;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const b = c.getBoundingClientRect();
    W = b.width; H = b.height;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.42;
  }
  addEventListener('resize', size); size();

  // ---- interaction: drag to spin, point/touch to highlight ----
  const K = 0.0055;                 // radians per pixel of drag
  const SNAP = coarse ? 36 : 18;    // px: how close the pointer must be to a point
  const CAP = coarse ? 0.5 : 0.42;  // cap radius in radians (~29° / ~24°)
  let a = 0.4, b = -0.35, va = 0, vb = 0;
  let mouse = null, dragging = false, lastP = null;

  const local = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId);
    dragging = true; lastP = mouse = local(e); va = vb = 0;
    c.parentElement.classList.add('dragged');
  });
  c.addEventListener('pointermove', e => {
    mouse = local(e);
    if (!dragging) return;
    const dx = mouse[0] - lastP[0], dy = mouse[1] - lastP[1];
    a += dx * K; b = clamp(b + dy * K);
    va = dx * K; vb = dy * K;         // remembered for inertia
    lastP = mouse;
  });
  const end = () => { dragging = false; lastP = null; };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('pointerleave', () => { if (!dragging) mouse = null; });
  function clamp(x) { return Math.max(-1.3, Math.min(1.3, x)); }

  // Only animate while on screen.
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => {
    visible = es[0].isIntersecting; if (visible) requestAnimationFrame(frame);
  }).observe(c);

  function rot(v, a, b) {  // rotate around y by a, then x by b
    let [x, y, z] = v;
    let x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    let y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    return [x1, y1, z2];
  }
  const proj = v => [W / 2 + v[0] * R, H / 2 - v[1] * R];

  function arc(p, q, color) {  // great-circle arc between two unit vectors
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, w = Math.acos(Math.max(-1, Math.min(1, p[0]*q[0]+p[1]*q[1]+p[2]*q[2])));
      const s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
      const s = proj([p[0]*s1+q[0]*s2, p[1]*s1+q[1]*s2, p[2]*s1+q[2]*s2]);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
  }

  function capOutline(q, theta, color) {  // small circle on the sphere at angle theta around q
    const u = norm(Math.abs(q[1]) < 0.9 ? [q[2], 0, -q[0]] : [0, q[2], -q[1]]);   // ⊥ q
    const w = [q[1]*u[2]-q[2]*u[1], q[2]*u[0]-q[0]*u[2], q[0]*u[1]-q[1]*u[0]];    // q × u
    const ct = Math.cos(theta), st = Math.sin(theta);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const ph = i / 48 * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
      const v = [ct*q[0] + st*(cp*u[0] + sp*w[0]), ct*q[1] + st*(cp*u[1] + sp*w[1]), ct*q[2] + st*(cp*u[2] + sp*w[2])];
      const s = proj(v);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  let ink, acc, acc2;

  function frame() {
    // re-read each frame so the light/dark toggle recolors the sphere
    ink = col('--ink') || '#1b1a2e'; acc = col('--accent') || '#5646d6'; acc2 = col('--accent-2') || '#f0653f';

    if (!dragging) {                       // inertia, then settle into the idle spin
      a += va; b = clamp(b + vb);
      va *= 0.95; vb *= 0.95;
      if (!reduce) a += 0.0016;
    }
    ctx.clearRect(0, 0, W, H);

    // faint sphere outline
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.08; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

    // background points; the one nearest the pointer becomes the query
    const rp = pts.map(p => rot(p, a, b));
    let q = -1;
    if (mouse) {
      let best = SNAP * SNAP;
      rp.forEach((v, i) => { if (v[2] < 0) return; const [x, y] = proj(v), d2 = (x - mouse[0]) ** 2 + (y - mouse[1]) ** 2; if (d2 < best) { best = d2; q = i; } });
    }
    const COS = Math.cos(CAP);
    rp.forEach((v, i) => {
      const [x, y] = proj(v), d = (v[2] + 1) / 2;
      const inCap = q >= 0 && (v[0]*rp[q][0] + v[1]*rp[q][1] + v[2]*rp[q][2]) > COS;
      ctx.globalAlpha = inCap ? 0.95 : 0.08 + d * 0.32;
      ctx.fillStyle = inCap ? acc2 : ink;
      ctx.beginPath(); ctx.arc(x, y, (inCap ? 1.8 : 0.8) + d * 1.2, 0, Math.PI * 2); ctx.fill();
    });
    if (q >= 0) {  // query point, its glow, and the cap boundary
      const [x, y] = proj(rp[q]);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
      g.addColorStop(0, acc2); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; capOutline(rp[q], CAP, acc2);
      ctx.globalAlpha = 1; ctx.fillStyle = acc2; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // arcs between cluster centers (angular distance)
    const cr = centers.map(v => rot(v, a, b));
    ctx.globalAlpha = 0.55;
    arc(cr[0], cr[1], acc); arc(cr[1], cr[2], acc); arc(cr[0], cr[2], acc);
    ctx.globalAlpha = 1;

    // clusters
    clusters.forEach((cl, i) => {
      const color = i === 1 ? acc2 : acc;
      for (const p of cl) {
        const v = rot(p, a, b), [x, y] = proj(v), d = (v[2] + 1) / 2;
        ctx.globalAlpha = 0.25 + d * 0.6; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 2 + d * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      const [x, y] = proj(cr[i]);
      ctx.globalAlpha = 1; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    if (visible) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
