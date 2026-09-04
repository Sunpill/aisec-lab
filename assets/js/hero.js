// Hero visual: a "representation space". Points on a sphere belong to one of three
// identities (A, B, C) — whichever center they are angularly closest to — and are
// tinted accordingly, so the decision regions show up as color territories.
// Drag to spin (with inertia). Touch or point at a spot: it becomes a query, its
// neighbourhood lights up, and a label says who the AI takes it for and how sure.
(function () {
  const c = document.getElementById('hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;   // touch screens
  const css = getComputedStyle(document.documentElement);
  const col = name => css.getPropertyValue(name).trim();
  const NAMES = ['A', 'B', 'C'];

  function rnd(a) { return (Math.random() * 2 - 1) * a; }
  function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
  const dot = (p, q) => p[0]*q[0] + p[1]*q[1] + p[2]*q[2];

  // Fibonacci sphere: evenly spread unit vectors.
  const N = 460, pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  // Three identity centers + a few noisy samples around each.
  const centers = [[0.6, 0.5, 0.62], [-0.7, 0.2, 0.68], [0.1, -0.75, 0.65]].map(norm);
  const clusters = centers.map(cn => {
    const s = [];
    for (let k = 0; k < 7; k++) s.push(norm([cn[0] + rnd(.16), cn[1] + rnd(.16), cn[2] + rnd(.16)]));
    return s;
  });
  // Each point's verdict: nearest center (region), and how clear-cut it is (margin).
  const region = [], margin = [];
  for (const p of pts) {
    const s = centers.map(cn => dot(p, cn)).map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
    region.push(s[0][1]); margin.push(s[0][0] - s[1][0]);
  }

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

  // ---- interaction: drag to spin, point/touch to query ----
  const K = 0.0055;                 // radians per pixel of drag
  const SNAP = coarse ? 36 : 18;    // px: how close the pointer must be to a point
  const CAP = coarse ? 0.5 : 0.42;  // neighbourhood radius in radians
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
    va = dx * K; vb = dy * K;
    lastP = mouse;
  });
  const end = () => { dragging = false; lastP = null; };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('pointerleave', () => { if (!dragging) mouse = null; });
  function clamp(x) { return Math.max(-1.3, Math.min(1.3, x)); }

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

  function arc(p, q, color, dash) {  // great-circle arc between two unit vectors
    const w = Math.acos(Math.max(-1, Math.min(1, dot(p, q))));
    if (w < 1e-4) return;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
      const s = proj([p[0]*s1+q[0]*s2, p[1]*s1+q[1]*s2, p[2]*s1+q[2]*s2]);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    }
    ctx.strokeStyle = color; ctx.lineWidth = dash ? 1.5 : 1; ctx.setLineDash(dash || [3, 5]); ctx.stroke(); ctx.setLineDash([]);
  }

  function capOutline(q, theta, color) {  // small circle on the sphere at angle theta around q
    const u = norm(Math.abs(q[1]) < 0.9 ? [q[2], 0, -q[0]] : [0, q[2], -q[1]]);
    const w = [q[1]*u[2]-q[2]*u[1], q[2]*u[0]-q[0]*u[2], q[0]*u[1]-q[1]*u[0]];
    const ct = Math.cos(theta), st = Math.sin(theta);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const ph = i / 48 * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
      const s = proj([ct*q[0] + st*(cp*u[0] + sp*w[0]), ct*q[1] + st*(cp*u[1] + sp*w[1]), ct*q[2] + st*(cp*u[2] + sp*w[2])]);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  function label(text, x, y, color, size) {
    ctx.font = `600 ${size}px ${col('--mono') || 'monospace'}`;
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.globalAlpha = 0.92; ctx.fillStyle = col('--surface') || '#fff';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y - size * 0.8, w, size * 1.6, 6); else ctx.rect(x, y - size * 0.8, w, size * 1.6); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.fillText(text, x + 6, y + 0.5);
  }

  let ink, idc;

  function frame() {
    ink = col('--ink') || '#1b1a2e';
    idc = [col('--id-a') || '#5646d6', col('--id-b') || '#f0653f', col('--id-c') || '#c9931f'];

    if (!dragging) {
      a += va; b = clamp(b + vb);
      va *= 0.95; vb *= 0.95;
      if (!reduce) a += 0.0016;
    }
    ctx.clearRect(0, 0, W, H);

    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.08; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

    // points, tinted by verdict; the one nearest the pointer becomes the query
    const rp = pts.map(p => rot(p, a, b));
    let q = -1;
    if (mouse) {
      let best = SNAP * SNAP;
      rp.forEach((v, i) => { if (v[2] < 0) return; const [x, y] = proj(v), d2 = (x - mouse[0]) ** 2 + (y - mouse[1]) ** 2; if (d2 < best) { best = d2; q = i; } });
    }
    const COS = Math.cos(CAP);
    rp.forEach((v, i) => {
      const [x, y] = proj(v), d = (v[2] + 1) / 2;
      const inCap = q >= 0 && dot(v, rp[q]) > COS;
      ctx.fillStyle = idc[region[i]];
      ctx.globalAlpha = inCap ? 0.95 : 0.10 + d * 0.38;
      ctx.beginPath(); ctx.arc(x, y, (inCap ? 1.9 : 0.9) + d * 1.3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    const cr = centers.map(v => rot(v, a, b));

    // query: glow, neighbourhood outline, arc to its identity, verdict label
    if (q >= 0) {
      const r = region[q], color = idc[r], [x, y] = proj(rp[q]);
      const ambiguous = margin[q] < 0.06;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 30);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; capOutline(rp[q], CAP, color);
      ctx.globalAlpha = 0.9; arc(rp[q], cr[r], color, [2, 4]);
      ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      const deg = Math.round(Math.acos(Math.max(-1, Math.min(1, dot(pts[q], centers[r])))) * 180 / Math.PI);
      const second = centers.map((cn, i) => [dot(pts[q], cn), i]).sort((u, v) => v[0] - u[0])[1][1];
      const text = ambiguous ? `${NAMES[r]}? ${NAMES[second]}? · ${deg}°` : `→ ${NAMES[r]} · ${deg}°`;
      label(text, x + 12, y - 16, color, 12);
    }

    // identity centers with their names; the arcs between them show angular distance
    ctx.globalAlpha = 0.45;
    arc(cr[0], cr[1], ink); arc(cr[1], cr[2], ink); arc(cr[0], cr[2], ink);
    ctx.globalAlpha = 1;
    clusters.forEach((cl, i) => {
      const color = idc[i];
      for (const p of cl) {
        const v = rot(p, a, b), [x, y] = proj(v), d = (v[2] + 1) / 2;
        ctx.globalAlpha = 0.3 + d * 0.6; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 2 + d * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      const [x, y] = proj(cr[i]), front = cr[i][2] > -0.2;
      ctx.globalAlpha = front ? 1 : 0.35; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = front ? 0.4 : 0.15;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      if (front) { ctx.globalAlpha = 1; label(NAMES[i], x + 12, y + 12, color, 11); }
      ctx.globalAlpha = 1;
    });

    if (visible) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
