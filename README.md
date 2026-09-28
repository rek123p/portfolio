# [-Bravo-] / rekin123p / rek123p — Portfolio

Personal portfolio site: a dark, spaced-theme single-page site with a live 3D
cosmic background (sun/moon/earth), bilingual PL/EN content, and per-project
changelog pages.

## Features

 - Real-time 3D WebGL background (Three.js) with a two-ste graceful fallback:
   pre-rendered rotation frames if WebG: isn't available, then a plain static
   CSS disc if JavaScript itself never runs.
 - Twinkling parallax starfield across three depth layers, using native
   scroll-drivven CSS animations where supported.
 - Full PL/EN bilingual UI via a small JSON dictionary system
   (`data/i18n/`), with automatic English fallback and no page reload.
 - Live clock comparison (your local time vs. mine).
 - One-click copy for contact details.
 - Per-project changelog pages, driven by JSON (`data/changelog/`), not
   harddcoded in HTML.

## Tech stack

Plain HTML, CSS and JavaScript — no framework, no build step, no bundler.
The only external library is [Three.js](https://threejs.org/), vendored
directly in `js/vendor/` (not installed via npm) and loaded through a
dynamic `import()`, so the WebGL tier can be skipped cleanly on devices/
browsers that don't support it.

The site is written to prefer feature detection (`CSS.supports(...)`,
checking for a WebGL context, etc.) over browser sniffing, so it degrades
gracefully rather than breaking on any specific engine — developed and
tasted primarily on Chromium, with Firefox/other-engine compatibility as an
explicit goal, not an afterthought.

Built with AI-assisted coding, same as most of what's on this site — see
`credits.html` for the full list of tools, libraries and assets used.

## Project structure

```
index.html                  Main page
changelog.html              Per-project changelog viewer (?project=<slug>)
credits.html                Third-party assets & tools used on this site
css/style.css               All styling (single file, no preprocessor)
js/app.js                   Language switcher, clocks, copy buttons, starfield
js/cosmic-webgl.js          3D background + fallback ladder
js/changelog.js             Changelog page logic
js/vendor/                  Vendored third-party libraries (Three.js)
data/i18n/                  Language manifest + per-language dictionaries
data/changelogs/            Per-project changelog data (JSON)
data/images/                Textures, frame sequences, disc fallback images
icons/                      Favicons / touch icons
```

## Running locally / deploying

This is a fully static site — no server-side code, no database, no build
step. Any static host works: upload the folder as-is.

One thing to know if you're running it locally rather than through a host:
the site fetches its language dictionaries and changelog data with
`fetch()`, which browsers block under the bare `file://` protocol. Serve
the folder through a simple local server instead, for example:

```
python3 -m http.server
```

then open `http://localhost:8000`.

## License

All rights reserved. This is a personal portfolio — not licensed for reuse.