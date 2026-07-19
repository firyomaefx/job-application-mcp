# Marketing site

Static, single-page marketing site for Job Application MCP. No framework, no
build step, no tracking, no external scripts — just `index.html`, `style.css`,
and `app.js`.

## Why static

The free core is local-first and privacy-respecting, and the marketing site
should match. There are no analytics scripts, no fonts loaded from a CDN, and
no third-party JS. The only interactivity is smooth-scroll for in-page anchors.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve website
# or
python -m http.server -d website 8080
```

## Deploy

Drop the three files onto any static host: GitHub Pages, Cloudflare Pages,
Netlify, Vercel, or an S3 bucket. Nothing to build.

## Content

- Hero + privacy pitch.
- Feature grid (CV parsing, job analysis, match scoring, autofill preview,
  local storage, MCP-native).
- Pricing tiers: **Free** (community core), **Pro** (AI credits + hosted Claude),
  **Business** (team dashboard + analytics).
- Privacy section: no tracking, CVs stored locally under `JOB_MCP_DATA_DIR`.
- Footer with AGPL-3.0 licence notice.

## Editing

Edit the HTML directly. Pricing copy and feature blurbs live in `index.html`.
Colors and the dark theme live in `style.css` (CSS custom properties at the top).