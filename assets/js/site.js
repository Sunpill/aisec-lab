// Shared behaviour: language toggle, nav, data rendering.
// Bilingual content lives in the HTML as sibling elements with class "ko" / "en".
// <html data-lang="ko|en"> decides which one is shown (see CSS).

(function () {
  const KEY = 'lab-lang';
  const root = document.documentElement;

  function pickDefault() {
    try { const s = localStorage.getItem(KEY); if (s) return s; } catch (e) {}
    return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  }

  function setLang(lang) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    document.querySelectorAll('[data-set-lang]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.setLang === lang);
    });
  }

  setLang(pickDefault());

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set-lang]');
    if (b) setLang(b.dataset.setLang);
    const t = e.target.closest('[data-nav-toggle]');
    if (t) document.body.classList.toggle('nav-open');
  });

  // Mark current nav link.
  const here = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav a[href]').forEach(a => {
    const p = new URL(a.href, location.href).pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    if (p === here) a.setAttribute('aria-current', 'page');
  });

  // Scroll reveal (no-op when reduced motion).
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

function renderNews(sel, limit) {
  const el = document.querySelector(sel);
  if (!el || typeof NEWS === 'undefined') return;
  const list = limit ? NEWS.slice(0, limit) : NEWS;
  el.innerHTML = list.map(newsItem).join('');
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
    <section class="pub-year"><h2 class="year">${y}</h2>
    <ul class="pub-list">${PUBS.filter(p => p.year === y).map(pubItem).join('')}</ul></section>`).join('');

  const filter = document.querySelector('[data-pub-filter]');
  if (!filter) return;
  filter.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const cat = b.dataset.cat;
    el.querySelectorAll('.pub').forEach(li => { li.hidden = cat !== 'all' && li.dataset.cat !== cat; });
    el.querySelectorAll('.pub-year').forEach(s => { s.hidden = ![...s.querySelectorAll('.pub')].some(li => !li.hidden); });
  });
}
