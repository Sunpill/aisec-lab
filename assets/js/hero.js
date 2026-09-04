// Hero visual: points on a slowly rotating sphere (a "representation space"),
// with a few identity clusters and the angular arcs between them.
(function () {
  const c = document.getElementById('hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  // Pointer: nearest visible point becomes a "query"; its angular neighbourhood
  // (cos-similarity cap) lights up. Touch devices just get the rotation.
  let mouse = null;
  c.addEventListener('pointermove', e => { const b = c.getBoundingClientRect(); mouse = [e.clientX - b.left, e.clientY - b.top]; });
  c.addEventListener('pointerleave', () => { mouse = null; });

  // Only animate while on screen.
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => {
    visible = es[0].isIntersecting; if (visible && !reduce) requestAnimationFrame(frame);
  }).observe(c);

  function rot(v, a, b) {  // rotate around y by a, then x by b
    let [x, y, z] = v;
    let x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    let y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    return [x1, y1, z2];
  }
  const proj = v => [W / 2 + v[0] * R, H / 2 - v[1] * R];

  function arc(a, b, color) {  // great-circle arc between two unit vectors
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, w = Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2])));
      const s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
      const p = proj([a[0]*s1+b[0]*s2, a[1]*s1+b[1]*s2, a[2]*s1+b[2]*s2]);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
  }

  let ink, acc, acc2, a = 0.4, b = -0.35;

  function frame(t) {
    // re-read each frame so the light/dark toggle recolors the sphere
    ink = col('--ink') || '#1f2321'; acc = col('--accent') || '#1f6f6b'; acc2 = col('--accent-2') || '#c88a3c';
    if (!reduce) { a += 0.0016; b = -0.35 + Math.sin(t / 9000) * 0.12; }
    ctx.clearRect(0, 0, W, H);

    // faint sphere outline
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.08; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

    // background points, front ones darker
    const rp = pts.map(p => rot(p, a, b));
    let q = -1;
    if (mouse) {  // nearest front-facing point to the pointer
      let best = 18 * 18;
      rp.forEach((v, i) => { if (v[2] < 0) return; const [x, y] = proj(v), d2 = (x - mouse[0]) ** 2 + (y - mouse[1]) ** 2; if (d2 < best) { best = d2; q = i; } });
    }
    const COS = Math.cos(0.42);  // cap radius ~24 degrees
    rp.forEach((v, i) => {
      const [x, y] = proj(v), d = (v[2] + 1) / 2;
      const inCap = q >= 0 && (v[0]*rp[q][0] + v[1]*rp[q][1] + v[2]*rp[q][2]) > COS;
      ctx.globalAlpha = inCap ? 0.9 : 0.08 + d * 0.32;
      ctx.fillStyle = inCap ? acc2 : ink;
      ctx.beginPath(); ctx.arc(x, y, (inCap ? 1.6 : 0.8) + d * 1.2, 0, Math.PI * 2); ctx.fill();
    });
    if (q >= 0) {  // query point + its cap outline
      const [x, y] = proj(rp[q]);
      ctx.globalAlpha = 1; ctx.fillStyle = acc2; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = acc2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
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

    if (!reduce && visible) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduce) c.addEventListener('pointermove', () => requestAnimationFrame(frame));
})();
