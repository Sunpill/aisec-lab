// Shared behaviour: language + theme toggles, nav, reveal, data rendering.
// Bilingual content lives in the HTML as sibling elements with class "ko" / "en";
// <html data-lang="ko|en"> decides which one shows (see CSS).
// <html data-theme="light|dark"> overrides the system color scheme; absent = follow system.

(function () {
  const root = document.documentElement;

  // ---- language ----
  const LANG = 'lab-lang';
  function pickLang() {
    const q = new URLSearchParams(location.search).get('lang');   // ?lang=en for shareable links
    if (q === 'ko' || q === 'en') return q;
    try { const s = localStorage.getItem(LANG); if (s) return s; } catch (e) {}
    return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }
  function setLang(lang) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    try { localStorage.setItem(LANG, lang); } catch (e) {}
    document.querySelectorAll('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.setLang === lang));
  }
  setLang(pickLang());

  // ---- theme ----
  const THEME = 'lab-theme';
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  function currentTheme() {
    return root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
  }
  function paintThemeButtons() {
    const t = currentTheme();
    document.querySelectorAll('[data-set-theme]').forEach(b => b.setAttribute('aria-pressed', b.dataset.setTheme === t));
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME, t); } catch (e) {}
    paintThemeButtons();
  }
  try { const s = localStorage.getItem(THEME); if (s === 'light' || s === 'dark') root.setAttribute('data-theme', s); } catch (e) {}
  paintThemeButtons();
  systemDark.addEventListener('change', paintThemeButtons);

  document.addEventListener('click', e => {
    const l = e.target.closest('[data-set-lang]');   if (l) setLang(l.dataset.setLang);
    const t = e.target.closest('[data-set-theme]');  if (t) setTheme(t.dataset.setTheme);
    const n = e.target.closest('[data-nav-toggle]'); if (n) document.body.classList.toggle('nav-open');
    // venue cards: tap to open on touch devices, tap elsewhere to close
    const v = e.target.closest('.venues li');
    document.querySelectorAll('.venues li.open').forEach(li => { if (li !== v) li.classList.remove('open'); });
    if (v) v.classList.toggle('open');
  });

  // ---- current nav link ----
  const here = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav a[href]').forEach(a => {
    const p = new URL(a.href, location.href).pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    if (p === here) a.setAttribute('aria-current', 'page');
  });

  // ---- scroll reveal (no-op when reduced motion) ----
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(es => es.forEach(x => {
      if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(el => io.observe(el));
  }
})();

// ---------- rendering helpers (use data.js) ----------

const LAB_START = '2026-09-01';   // news before this date is the PI's pre-lab history

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return M[+m - 1] + (day ? ' ' + (+day) : '') + ', ' + y;
}

function newsItem(n) {
  const date = `<time datetime="${n.date}">${fmtDate(n.date)}</time>`;
  if (n.title) {
    const tier = n.tier === 'top' ? ' is-top' : '';
    return `<li class="news-item${tier}">${date}
      <div><span class="venue">${n.venue}</span>
      <span class="ptitle">${n.title}</span>
      <span class="authors">${n.authors}</span></div></li>`;
  }
  return `<li class="news-item">${date}<div>${n.body}</div></li>`;
}

// Home: only lab-era news. News page: lab-era by default, older behind a toggle.
function renderNews(sel, opts) {
  const el = document.querySelector(sel);
  if (!el || typeof NEWS === 'undefined') return;
  opts = opts || {};
  const recent = NEWS.filter(n => n.date >= LAB_START);
  const older = NEWS.filter(n => n.date < LAB_START);
  const list = opts.limit ? recent.slice(0, opts.limit) : recent;
  el.innerHTML = list.map(newsItem).join('');
  if (!opts.withOlder || !older.length) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button class="news-toggle" aria-expanded="false">
      <span class="ko">2026년 9월 이전 소식 보기</span><span class="en">Show news before September 2026</span>
      <span class="chev">▾</span>
    </button>
    <div hidden>
      <p class="news-older-label"><span class="ko">개설 이전 · 지도교수 이력</span><span class="en">Before the lab · PI's history</span></p>
      <ul class="news-list">${older.map(newsItem).join('')}</ul>
    </div>`;
  el.after(wrap);
  const btn = wrap.querySelector('button'), box = wrap.querySelector('div');
  btn.addEventListener('click', () => {
    const open = box.hidden; box.hidden = !open; btn.setAttribute('aria-expanded', open);
  });
}

function pubItem(p) {
  const tier = p.tier === 'top' ? ' is-top' : '';
  const link = p.pdf ? `<a class="pub-link" href="${p.pdf}" target="_blank" rel="noopener">paper ↗</a>` : '';
  const note = p.note ? `<span class="note">${p.note}</span>` : '';
  return `<li class="pub${tier}" data-cat="${p.category}">
    <span class="pub-venue">${p.venue_short}</span>
    <div class="pub-body">
      <span class="pub-title">${p.title}</span>
      <span class="pub-authors">${p.authors}</span>
      <span class="pub-meta">${p.venue}${note ? ' · ' : ''}${note} ${link}</span>
    </div></li>`;
}

function renderPubs(sel) {
  const el = document.querySelector(sel);
  if (!el || typeof PUBS === 'undefined') return;
  const years = [...new Set(PUBS.map(p => p.year))].sort((a, b) => b - a);
  el.innerHTML = years.map(y => `
    <section class="pub-year" data-year="${y}"><h2 class="year">${y}</h2>
    <ul class="pub-list">${PUBS.filter(p => p.year === y).map(pubItem).join('')}</ul></section>`).join('');

  const filter = document.querySelector('[data-pub-filter]');
  if (!filter) return;
  filter.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const cat = b.dataset.cat;
    el.querySelectorAll('.pub').forEach(li => { li.hidden = cat !== 'all' && li.dataset.cat !== cat; });
    el.querySelectorAll('.pub-year').forEach(s => { s.hidden = !s.querySelector('.pub:not([hidden])'); });
  });
}
