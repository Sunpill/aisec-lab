# AI Security Lab — website

Static site for the AI Security Lab, Division of Software, Sookmyung Women's University.
No build step: plain HTML + one CSS file + a little JS. GitHub Pages serves it as-is.

## Editing

| What | Where |
|---|---|
| Publications, news | `assets/js/data.js` (`PUBS`, `NEWS` arrays; newest first) |
| Members | `people.html` → `.member-grid` (copy a card, replace the `?` avatar with a photo in `assets/img/`) |
| Research text | `research.html` |
| Recruiting text, FAQ | `join.html` |
| Colors, fonts, layout | `assets/css/main.css` (tokens at the top) |

Every piece of text exists twice, in sibling elements `<span class="ko">…</span><span class="en">…</span>`.
The `data-lang` attribute on `<html>` chooses which one shows; the KO/EN buttons set it and remember the choice.

## Local preview

```bash
python -m http.server 8000
```

then open http://localhost:8000/.

## Deploy

Push to `master`. GitHub Pages (Settings → Pages → Deploy from branch, `master` / root) publishes it.
To use a custom domain (e.g. `lab.sunpillkim.com`), add a `CNAME` file containing that host and a DNS CNAME record pointing to `sunpill.github.io`.
