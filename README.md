# [-Bravo-] / rekin123p / rek123p — Portfolio

Personal portfolio site: a dark, cosmic-themed single-page site with a live 3D
background (sun/moon/earth), bilingual PL/EN content, a real-time 3D spinning
brand logo, a pricing section with live currency conversion, and per-project
release notes pages.

## Features

 - Real-time 3D WebGL cosmic background (Three.js) — a rotating Sun, Moon, and
   Earth — with a two-step graceful fallback: pre-rendered rotation frames if
   WebGL isn't available, then a plain static CSS disc if JavaScript itself
   never runs.
 - A real 3D spinning brand logo in the Hero, extruded in Three.js from the
   actual mascot silhouette, with the same fallback ladder as the cosmic
   background.
 - Twinkling parallax starfield across three depth layers, using native
   scroll-driven CSS animations where supported, with a JS/requestAnimationFrame
   fallback for browsers without it (e.g. Firefox).
 - Full PL/EN bilingual UI via a small JSON dictionary system
   (`data/i18n/`), with automatic English fallback and no page reload.
 - Live clock comparison (your local time vs. mine).
 - One-click copy for contact details.
 - A Pricing section with live currency conversion (PLN/EUR/USD/GBP), backed
   by exchange rates refreshed four times a day (00:00/06:00/12:00/18:00 UTC)
   through a GitHub Actions workflow.
 - Digital Business Card: an animated, exportable business card built
   directly into the site.
 - Per-project Release Notes pages, driven by JSON (`data/changelogs/`), not
   hardcoded in HTML.

## Tech stack

Plain HTML, CSS and JavaScript — no framework, no build step, no bundler.
The only external library is [Three.js](https://threejs.org/), vendored
directly in `js/vendor/` (not installed via npm) and loaded through a
dynamic `import()`, so the WebGL tier can be skipped cleanly on devices/
browsers that don't support it.

The site is written to prefer feature detection (`CSS.supports(...)`,
checking for a WebGL context, etc.) over browser sniffing, so it degrades
gracefully rather than breaking on any specific engine — developed and
tested primarily on Chromium, with Firefox/other-engine compatibility as an
explicit goal, not an afterthought.

Built with AI-assisted coding, same as most of what's on this site — see
`credits.html` for the full list of tools, libraries and assets used.

## Project structure

```
index.html                  Main page
changelog.html               Per-project release notes viewer (?project=<slug>)
credits.html                 Third-party assets & tools used on this site
css/style.css                All styling (single file, no preprocessor)
js/app.js                    Language switcher, clocks, copy buttons, starfield, pricing
js/cosmic-webgl.js           3D cosmic background + fallback ladder
js/shark-logo.js             3D spinning brand logo (Hero) + fallback ladder
js/shark-logo-shapes.js      Extruded geometry data for the brand logo
js/changelog.js              Release notes page logic
js/vendor/                   Vendored third-party libraries (Three.js)
data/i18n/                   Language manifest + per-language dictionaries
data/changelogs/             Per-project release notes data (JSON)
data/images/                 Textures, frame sequences, disc fallback images
data/rates.json              Currency exchange rates (auto-refreshed 4x/day)
.github/workflows/           GitHub Actions (currency rate refresh, 4x/day)
icons/                       Favicons / touch icons / brand logo source
```

## Running locally / deploying

This is a fully static site — no server-side code, no database, no build
step. Any static host works: upload the folder as-is (this one runs on
GitHub Pages).

One thing to know if you're running it locally rather than through a host:
the site fetches its language dictionaries and JSON data with `fetch()`,
which browsers block under the bare `file://` protocol. Serve the folder
through a simple local server instead, for example:

```
python3 -m http.server
```

then open `http://localhost:8000`.

## Known Issues

Known bugs, rough edges and things that need further work are tracked in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) rather than cluttering this README.

## License

All rights reserved. This is a personal portfolio — not licensed for reuse.
