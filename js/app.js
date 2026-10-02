// Web fonts (Orbitron/Inter, loaded via <link>, non-blocking with
// display=swap) can finish loading AFTER the browser already jumped to a
// URL's #hash target on page load — the font swap reflows the page,
// leaving the "landed" scroll position stale relative to where the
// target actually is now. Once fonts are truly ready, jump again.
if (location.hash) {
    document.fonts.ready.then(() => {
        const target = document.querySelector(location.hash);
        if (target) target.scrollIntoView();
    });
}

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Language switcher — dropdown driven by data/i18n/languages.json (the list
// of available languages) plus one data/i18n/<code>.json dictionary per
// non-default language. English stays baked directly into the HTML (inside
// data=i18n="key" elements) as the always-available default — captured once
// below — so nothing needs a network fetch to show correctly in English.
// Almost all of the site's static text now lives here. The older data-lang
// mechanism (hide/show a pair of spans) still runs alongisde it purely for
// changelog.js's dunamically-injected changelog entries — those come from
// per-project JSON with their own separate en/pl arrays, not from a
// dictionary file, so they build actual data-lang spans on the fly.
const langToggle = document.getElementById("langToggle");
const langMenu = document.getElementById("langMenu");
const langCurrent = document.getElementById("langCurrent");


// innerHTML (not textContent) on purpose: a few keys (e.g. the About
// section paragraphs, Virtual Hell's credit line) carry inline <strong>/<a>
// markup, and dictionaries are our own trusted content, never user input.
document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.dataset.i18nDefault = el.innerHTML;
});

const i18nDicts = {}; // code -> { key: translatedText }, filled in lazily
let currentLang = document.body.getAttribute("data-lang") || "en";

// Persist the chosen language across page loads/navigations (localStorage
// is per-origin, so this carries over from index.html to changelog.html and
// back). Wrapped in try/catch — private browsing or disabled storage can
// make localStorage throw instead of just being unavailable.
const LANG_STORAGE_KEY = "lang";

function getStoredLang() {
    try {
        return localStorage.getItem(LANG_STORAGE_KEY);
    } catch (err) {
        return null;
    }
}

function setStoredLang(lang) {
    try{
        localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (err) {
        // Private browsing / storage disabled — language just won't persist.
    }
}

async function loadI18nDict(code) {
    if (code === "en") return null;
    if (i18nDicts[code]) return i18nDicts[code];
    try {
        const res = await fetch(`data/i18n/${code}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        i18nDicts[code] = await res.json();
    } catch (err) {
        console.warn(`Failed to load i18n dictionary for "${code}":`, err);
        i18nDicts[code] = {};
    }
    return i18nDicts[code];
}

// Looks up `key` in the currently active language, falling back to
// `fallback` (normally the English copy) if there's no translation for it —
// used both for static markup below and for transient JS-driven text like
// the "Copied!" message. Named "translate", not "t", so it doesn't shadow
// the unrelated locat `t` (interpolation factor) used down in buildStars().
function translate(key, fallback) {
    const dict = currentLang === "en" ? null : i18nDicts[currentLang];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return fallback;
}

function applyI18nDict(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        el.innerHTML =
            dict && Object.prototype.hasOwnProperty.call(dict, key)
                ? dict[key]
                : el.dataset.i18nDefault;
    });
}

async function setLanguage(lang) {
    currentLang = lang;
    setStoredLang(lang);
    document.documentElement.lang = lang;
    document.body.setAttribute("data-lang", lang);

    // Legacy data-lang spans — only changelog.js's dynamically-built
    // changelog entries use these now (see comment above).
    document.querySelectorAll("[data-lang]").forEach((el) => {
        el.hidden = el.getAttribute("data-lang") !== lang;
    });

    // Static site chrome, driven by the i18n dictionary.
    applyI18nDict(await loadI18nDict(lang));

    if (langCurrent) langCurrent.textContent = lang.toUpperCase();
    if (langMenu) {
        langMenu.querySelectorAll("button").forEach((btn) => {
            btn.setAttribute("aria-selected", btn.dataset.langCode === lang ? "true" : "false");
        });
    }

    // Same idea as the document.fonts.ready hooks: switching language can
    // change text length enough to reflow the page (Polish generally runs
    // longer than English), which leaves anything that measured element
    // positions beforehand — WebGL's canvas size and per-body ligh
    // direction, changelog.js's per-language project title — stale.
    // Broadcasting this lets each of them recompute on their own terms
    // instead of setLanguage() needing to know about either of them.
    document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

async function buildLangMenu() {
    if (!langMenu) return {};
    let languages = { en: "English" };
    try {
        const res = await fetch("data/i18n/languages.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        languages = await res.json();
    } catch (err) {
        console.warn("Failed to load language list, defaulting to English only:", err);
    }

    Object.entries(languages).forEach(([code, label]) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "option");
        btn.dataset.langCode = code;
        btn.textContent = label;
        li.appendChild(btn);
        langMenu.appendChild(li);
    });

    return languages;
}

// Fire these in parallel rather than chaining buildLangMenu().then(setLanguage)
// — the dropdown's option list and the page's actual translated text don't
// depend on each other, and chaining them meant a stored non-English
// language wated on TWO sequential fetches (languages.json, then its own
// dictionary) before showing, which is exactly the kind of visible
// English-then-Polish flash that used to happen with English-then-fonts.
const initialLang = getStoredLang() || document.body.getAttribute("data-lang") || "en";
setLanguage(initialLang);
buildLangMenu().then(() => {
    // setLanguage() above may already have run (or may still be waiting on
    // its own fetch) by the time the menu exists — either way, make sure
    // the right option is marked selected once the menu actually built.
    if (langMenu) {
        langMenu.querySelectorAll("button").forEach((btn) => {
            btn.setAttribute("aria-selected", btn.dataset.langCode === currentLang ? "true" : "false");
        });
    }
});

langToggle?.addEventListener("click", () => {
    const expanded = langToggle.getAttribute("aria-expanded") === "true";
    langToggle.setAttribute("aria-expanded", String(!expanded));
    if (langMenu) langMenu.hidden = expanded;
});

langMenu?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-lang-code]");
    if (!btn) return;
    setLanguage(btn.dataset.langCode);
    langMenu.hidden = true;
    langToggle?.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", (event) => {
    if (!langMenu || langMenu.hidden) return;
    if (event.target.closest(".lang-switch")) return;
    langMenu.hidden = true;
    langToggle?.setAttribute("aria-expanded", "false");
});

// ---------------------------------------------------------------------------
// Hero status badge — phrasing is randomized once per page load from a small
// pool per state, driven entirely by data-* attributes set by hand on
// #heroStatus (data-status: "available" | "busy"; data-client / data-client-url
// only used when status is "busy"). The random PICK stays fixed across a
// language switch — only its translation changes — so toggling EN/PL doesn't
// re-roll the phrasing mid-visit.
// ---------------------------------------------------------------------------

const heroStatusEl = document.getElementById("heroStatus");

const HERO_STATUS_VARIANTS = {
    available: [
        { key: "hero.status.available.1", fallback: "Awaiting a client" },
        { key: "hero.status.available.2", fallback: "Currently available" },
    ],
    busy: [
        { key: "hero.status.busy.1", fallback: "Working for {client}" },
        { key: "hero.status.busy.2", fallback: "Currently building for {client}" },
        { key: "hero.status.busy.3", fallback: "On a project with {client}" },
    ],
};

let heroStatusVariantIndex = null;

function renderHeroStatus() {
    if (!heroStatusEl) return;

    const status = heroStatusEl.dataset.status === "busy" ? "busy" : "available";
    const variants = HERO_STATUS_VARIANTS[status];

    if (heroStatusVariantIndex === null) {
        heroStatusVariantIndex = Math.floor(Math.random() * variants.length);
    }

    const variant = variants[heroStatusVariantIndex % variants.length];
    const template = translate(variant.key, variant.fallback);

    heroStatusEl.textContent = "";

    if (status === "busy") {
        const client = heroStatusEl.dataset.client || "";
        const clientUrl = heroStatusEl.dataset.clientUrl || "";
        const [before, after] = template.split("{client}");

        heroStatusEl.appendChild(document.createTextNode(before));
        if (clientUrl) {
            const link = document.createElement("a");
            link.href = clientUrl;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = client;
            heroStatusEl.appendChild(link);
        } else {
            heroStatusEl.appendChild(document.createTextNode(client));
        }
        heroStatusEl.appendChild(document.createTextNode(after || ""));
    } else {
        heroStatusEl.textContent = template;
    }
}

renderHeroStatus();
document.addEventListener("languagechange", renderHeroStatus);

// Copy-to-clipboard buttons (email, Discord)
document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy");

        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.warn("Clipboard copy failed:", err);
            return;
        }

        const label = btn.querySelector("[data-i18n]");
        if (!label) return;

        const original = label.textContent;
        label.textContent = translate("common.copied", "Copied!");

        setTimeout(() => {
            label.textContent = original;
        }, 1500);
    });
});

// My time / your time comparison
const MY_TIMEZONE = "Europe/Warsaw";
const myTimeEl = document.getElementById("myTime");
const yourTimeEl = document.getElementById("yourTime");

function formatTime(timeZone, date) {
    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    }).format(date);
}

function updateClocks() {
    if (!myTimeEl || !yourTimeEl) return;

    const now = new Date();
    const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    myTimeEl.textContent = formatTime(MY_TIMEZONE, now);
    yourTimeEl.textContent = formatTime(visitorTimezone, now);
}

updateClocks();

// Phase-lock the refresh to the real wall-clock minute boundary: a single
// setTimeout waits out whatever's left of the current minute, then a
// regular setInterval takes over from exactly that boundary — otherwise
// the display could lag up to 59s behind the real time (interval counted
// from page load, not from the actual minute actually changing).
const msUntilNextMinute = 60000 - (Date.now() % 60000);
setTimeout(() => {
    updateClocks();
    setInterval(updateClocks, 60 * 1000);
}, msUntilNextMinute);

// ---------------------------------------------------------------------------
// Pricing — live currency conversion + "last updated" readout
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS = { PLN: "zł", EUR: "€", USD: "$", GBP: "£" };

const currencySwitchEl = document.querySelector(".currency-switch");
const pricingUpdatedEl = document.getElementById("pricingUpdated");
const priceRangeEls = document.querySelectorAll(".pricing-card__range");

let pricingRates = null; // { PLN: 1, EUR: .., USD: .., GBP: .. } once loaded, else null
let pricingUpdatedAt = null; // Date parsed from rates.json's "updated" field
let currentCurrency = "PLN";

// Polish plural category for a whole number: "one" (1), "few" (2-4, except
// 12-14), "many" (everything else) — the three forms "minutę/minuty/minut"
// each need. English only ever needs singular vs. plural, handled inline
// in formatPricingUpdated() below instead of a second branching function.
function pluralFormPl(n) {
    if (n === 1) return "one";
    const lastDigit = n % 10;
    const lastTwo = n % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "few";
    return "many";
}

function formatPricingUpdated(date) {
    if (!date) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60 * 1000) {
        return translate("pricing.updatedMoments", "moments ago");
    }

    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) {
        const form = currentLang === "pl" ? pluralFormPl(diffMin) : diffMin === 1 ? "one" : "many";
        const key =
            form === "one" ? "pricing.updatedMinutesOne" : form === "few" ? "pricing.updatedMinutesFew" : "pricing.updatedMinutesMany";
        const fallback = diffMin === 1 ? "{n} minute ago" : "{n} minutes ago";
        return translate(key, fallback).replace("{n}", diffMin);
    }

    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);

    // Past the 1-hour mark we show a clock time instead of running count —
    // but a bare clock time is ambiguous once the update isn't from today
    // anymore (visitor's own calendar day, not UTC — that's what "today"
    // means to them). In that case tack on the date too.
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) {
        return translate("pricing.updatedAt", "updated at {time}").replace("{time}", time);
    }

    const dateStr = new Intl.DateTimeFormat(currentLang === "pl" ? "pl-PL" : "en-GB", {
        day: "numeric",
        month: "short",
    }).format(date);
    return translate("pricing.updatedAtWithDate", "updated {date} at {time}")
        .replace("{date}", dateStr)
        .replace("{time}", time);
}

function refreshPricingUpdatedText() {
    if (!pricingUpdatedEl) return;
    pricingUpdatedEl.textContent = formatPricingUpdated(pricingUpdatedAt);
}

function applyCurrency(code) {
    currentCurrency = code;

    currencySwitchEl?.querySelectorAll(".currency-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.currency === code);
    });

    const rate = pricingRates ? pricingRates[code] : code === "PLN" ? 1 : null;
    if (rate == null) return; // rates.json hasn't loaded yet — HTML's baked-in PLN values stay as-is

    priceRangeEls.forEach((el) => {
        const min = Math.round(Number(el.dataset.priceMin) * rate);
        const max = Math.round(Number(el.dataset.priceMax) * rate);
        el.querySelector(".price-min").textContent = min;
        el.querySelector(".price-max").textContent = max;
        el.querySelector(".price-currency").textContent = CURRENCY_SYMBOLS[code] || code;
    });
}

async function loadPricingRates() {
    try {
        const res = await fetch("data/rates.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        pricingRates = data.rates;
        pricingUpdatedAt = new Date(data.updated);
    } catch (err) {
        // rates.json ships as part of the site's own files and is refreshed
        // hourly by GitHub Actions, so this should be near-impossible in
        // practice — but if it ever does happen, the page just keeps the
        // PLN values already baked into the HTML instead of throwing.
        console.warn("Failed to load currency rates:", err);
    }

    applyCurrency(currentCurrency);
    refreshPricingUpdatedText();
}

currencySwitchEl?.addEventListener("click", (event) => {
    const btn = event.target.closest(".currency-btn");
    if (!btn || btn.disabled) return;
    applyCurrency(btn.dataset.currency);
});

document.addEventListener("languagechange", () => {
    refreshPricingUpdatedText(); // "minutes ago" text is language-dependent
});

loadPricingRates();
// "moments ago" → "X minutes ago" → a fixed time all age with real time
// passing even if the visitor never touches anything else on the page.
setInterval(refreshPricingUpdatedText, 30 * 1000);

// ---------------------------------------------------------------------------
// Cosmic background — star field (3 parallax depth layers)
// ---------------------------------------------------------------------------
//
// Canvases are sized to the VIEWPORT, not the full page, and redrawn as the
// page scrolls (throttled via requestAnimationFrame) — not driven by a
// native CSS scroll-linked animation on a page-tall canvas. That native-CSS
// approach looked like the lighter option on paper (zero JS per frame
// browsers that support it, Chrome included), but turned out to be the
// actual cause of severe mobile Chrome stutter: a composited layer as
// tall as the entire page is expensive for the browser to manage during
// scroll regardless of how little (or how efficiently) is drawn onto it —
// confirmed by direct testing on a real device: shrinking the canvas to
// viewport height alone, with none of the drawing logic changed, fixed it.
// Both browsers now share this one JS-driven mechanism instead of branching.

const STAR_LAYERS = [
    {
        canvas: document.querySelector(".cosmic-stars--far"),
        twinkleCanvas: document.querySelector(".cosmic-stars-twinkle--far"),
        density: 220, // stars per 1,000,000 px^2 of page area
        radius: [0.5, 1.2],
        alpha: [0.25, 0.55],
        twinkleShare: 0.06,
        parallaxDamp: 0.85, // higher = feels farther away (moves less on scroll)
    },
    {
        canvas: document.querySelector(".cosmic-stars--mid"),
        twinkleCanvas: document.querySelector(".cosmic-stars-twinkle--mid"),
        density: 110,
        radius: [0.9, 1.8],
        alpha: [0.4, 0.75],
        twinkleShare: 0.12,
        parallaxDamp: 0.5,
    },
    {
        canvas: document.querySelector(".cosmic-stars--near"),
        twinkleCanvas: document.querySelector(".cosmic-stars-twinkle--near"),
        density: 45,
        radius: [1.3, 2.4],
        alpha: [0.6, 1],
        twinkleShare: 0.2,
        parallaxDamp: 0.15,
    },
];

// Weighted star-color palette, roughly matching real stellar colour
// distribution as seen by eye (mostly white/blue-white, warmer tones rarer).
const STAR_COLORS = [
    { color: "255, 255, 255", weight: 45 }, // white
    { color: "205, 220, 255", weight: 30 }, // blue-white
    { color: "255, 244, 214", weight: 16 }, // warm white / pale yellow
    { color: "255, 210, 160", weight: 6 }, // pale orange
    { color: "255, 180, 160", weight: 3 }, // pale red
];
const STAR_COLOR_TOTAL = STAR_COLORS.reduce((sum, c) => sum + c.weight, 0);

function pickStarColor() {
    let roll = Math.random() * STAR_COLOR_TOTAL;
    for (const entry of STAR_COLORS) {
        roll -= entry.weight;
        if (roll <= 0) return entry.color;
    }
    return STAR_COLORS[0].color;
}

function pageHeight() {
    return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );
}

function buildStars(layer, cssWidth, pageH) {
    const area = cssWidth * pageH;
    const count = Math.round((area / 1_000_000) * layer.density);
    const stars = [];

    for (let i = 0; i < count; i++) {
        // power-law skew: most stars small/dim, few large/bright — matches how
        // a real sky actually looks, not a flat random distribution
        const t = Math.pow(Math.random(), 2.2);
        const isTwinkle = Math.random() < layer.twinkleShare;

        stars.push({
            x: Math.random() * cssWidth,
            y: Math.random() * pageH, // position is Page space, not viewport space
            r: layer.radius[0] + t * (layer.radius[1] - layer.radius[0]),
            baseAlpha: layer.alpha[0] + t * (layer.alpha[1] - layer.alpha[0]),
            color: pickStarColor(),
            twinkle: isTwinkle,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0006 + Math.random() * 0.0012,
        });
    }

    return stars;
}

// yOffset converts a star's page-space Y into this frame's on-screen Y —
// cssHeight here is the VIEWPORT height (see setupStarLayer), not the page
// height. A little slack beyond the edges so a star isn't abruptly clipped
// mid-circle right at the boundary.
function drawStars(ctx, cssWidth, cssHeight, stars, now, yOffset) {
    if (!ctx) return;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const EDGE_SLACK = 40;
    for (const star of stars) {
        const y = star.y - yOffset;
        if (y < -EDGE_SLACK || y > cssHeight + EDGE_SLACK) continue;

        let alpha = star.baseAlpha;
        if (star.twinkle) {
            alpha *= 0.55 + 0.45 * Math.sin(now * star.speed + star.phase);
        }
        alpha = Math.max(0, Math.min(1, alpha));

        ctx.beginPath();
        if (star.r > 1.5) {
            // brighter/nearer stars get a soft glow instead of a hard dot
            const glow = ctx.createRadialGradient(star.x, y, 0, star.x, y, star.r * 3);
            glow.addColorStop(0, `rgba(${star.color}, ${alpha})`);
            glow.addColorStop(1, `rgba(${star.color}, 0)`);
            ctx.fillStyle = glow;
            ctx.arc(star.x, y, star.r * 3, 0, Math.PI * 2);
        } else {
            ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
            ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
        }
        ctx.fill();
    }
}

function sizeCanvas(canvas, cssWidth, cssHeight, dpr) {
    if (!canvas) return null;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

// How far this layer's star field has scrolled past, in its own
// (parallax-damped) coordinate space — the amount by which a star's
// page-space Y needs to be shifted to land in the current viewport.
function layerShift(layer) {
    return window.scrollY * (1 - layer.parallaxDamp);
}

function redrawStarLayer(layer, now) {
    const shift = layerShift(layer);
    drawStars(layer.ctx, layer.cssWidth, layer.viewportHeight, layer.staticStars, now, shift);
    drawStars(layer.twinkleCtx, layer.cssWidth, layer.viewportHeight, layer.twinkleStars, now, shift);
}

// Extra padding added to each canvas's height on top of the current
// viewport — a mobile browser's address bar hiding/showing as you scroll
// changes window.innerHeight on practically every scroll direction change,
// and without this buffer that was forcing a full canvas resize (and with
// it, a visible redraw) every single time, 150px covers the typical mobile
// toolbar height with room to spare, so ordinary toolbar toggling now needs
// no resize at all — only a genuinely different viewport (real resize,
// orientation change) does.
const TOOLBAR_BUFFER = 150;

function setupStarLayer(layer) {
    if (!layer.canvas) return;

    // Capped the same way the WebGL canvases (cosmic-webgl.js, shark-logo.js)
    // already cap theirs.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = window.innerWidth;
    const pageH = pageHeight();
    const viewportHeight = window.innerHeight + TOOLBAR_BUFFER;

    layer.cssWidth = cssWidth;
    layer.viewportHeight = viewportHeight;

    const allStars = buildStars(layer, cssWidth, pageH);
    // split once here so the recurring twinkle redraw never has to touch (or
    // even iterate past) the static majority of stars
    layer.staticStars = allStars.filter((s) => !s.twinkle);
    layer.twinkleStars = allStars.filter((s) => s.twinkle);

    // Canvases are sized to the viewport, not the page — see the comment at
    // the top of this section.
    layer.ctx = sizeCanvas(layer.canvas, cssWidth, viewportHeight, dpr);
    layer.twinkleCtx = sizeCanvas(layer.twinkleCanvas, cssWidth, viewportHeight, dpr);

    redrawStarLayer(layer, performance.now());
}

function regenerateAllStars() {
    STAR_LAYERS.forEach(setupStarLayer);
}

if (STAR_LAYERS.some((layer) => layer.canvas)) {
    regenerateAllStars();

    // One rAF loop redraws whichever layers need it: on every scroll change
    // (position moved), and at least every ~120ms regardless (so twinkle
    // alpha keeps animating even while standing still).
    let lastScrollY = window.scrollY;
    let lastRedrawAt = 0;

    const MIN_SCROLL_REDRAW_INTERVAL = 16; // caps scroll-driven redraw at ~60/sec, even on 120Hz+ displays

    function frameLoop(now) {
        const scrolled = window.scrollY !== lastScrollY;
        const readyForScroll = now - lastRedrawAt >= MIN_SCROLL_REDRAW_INTERVAL;
        const dueForTwinkle = now - lastRedrawAt >= 120;
        if (scrolled && readyForScroll || dueForTwinkle) {
            lastScrollY = window.scrollY;
            lastRedrawAt = now;
            STAR_LAYERS.forEach((layer) => redrawStarLayer(layer, now));
        }
        requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    // Resize only triggers a full regenerate (new star layout, new canvas
    // size) when something actually changed beyoond the toolbar buffer above
    // — a real width change, or a height change bigger than what that
    // buffer absorbs. Ordinary mobile address-bar toggling no longer does
    // anything here at all.
    let starResizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(starResizeTimer);
        starResizeTimer = setTimeout(() => {
            const needsRegenerate = STAR_LAYERS.some(
                (layer) =>
                    layer.canvas &&
                    (window.innerWidth !== layer.cssWidth ||
                        window.innerHeight > layer.viewportHeight)
            );
            if (needsRegenerate) regenerateAllStars();
        }, 250);
    });

    // fonts/images finishing loading can change the page's final height —
    // regenerate once more once everything has settled
    window.addEventListener("load", regenerateAllStars);
}

/* ---------- Business card modal: assembly animation + PNG export ---------- */

const cardModal = document.getElementById("cardModal");
const bizCard = document.getElementById("bizCard");
const showCardBtn = document.getElementById("showCardBtn");
const downloadCardBtn = document.getElementById("downloadCardBtn");

// Longest per-piece transition-delay (0.6s, on .biz-card__tags in style.css)
// plus that piece's own transition-duration (0.7s), plus a small margin —
// this is when the LAST piece has finished landing, so it's the right
// moment to reveal Download. Kept as one constant instead of listening for
// transitionend so it doesn't depend on which piece happens to finish last.
const CARD_ASSEMBLY_DONE_MS = 600 + 700 + 100;

function openCardModal() {
    if (!cardModal || !bizCard) return;
    cardModal.hidden = false;
    bizCard.classList.remove("is-assembling");
    downloadCardBtn?.classList.remove("visible");

    // Force a reflow so the browser commits the "not assembling" (start)
    // state before we add the class that transitions away from it — without
    // this the two class changes can get batched into one style recalc and
    // the pieces would just appear already-assembled, no animation at all.
    void bizCard.offsetWidth;

    requestAnimationFrame(() => {
        bizCard.classList.add("is-assembling");
    });

    setTimeout(() => {
        downloadCardBtn?.classList.add("visible");
    }, CARD_ASSEMBLY_DONE_MS);
}

function closeCardModal() {
    if (!cardModal) return;
    cardModal.hidden = true;
    bizCard?.classList.remove("is-assembling");
    downloadCardBtn?.classList.remove("visible");
}

showCardBtn?.addEventListener("click", openCardModal);
cardModal?.querySelectorAll("[data-card-close]").forEach((el) => {
    el.addEventListener("click", closeCardModal);
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cardModal && !cardModal.hidden) closeCardModal();
});

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Draws the exportable PNG frm scratch on a plain <canvas> — the DOM/CSS
// card above is what plays the assembly animation, this is a separate,
// simpler renderer whose only job is producing a clean static image at real
// business-card proportions (1050x600 = 3,5"x2" @300dpi). Text content is
// read live from the DOM card's own elements rather than duplicated here,
// so it automatically follows the current language and can't drift our of
// sync with what's actually on screen.
async function renderCardToCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = 1050;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    // Same reasoning as the fonts.ready hooks elsewhere: draw text only
    // once the real webfonts are ready, or Orbitron/Inter would silently
    // fall back to a system font in the exported image.
    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#2c1f5c");
    grad.addColorStop(1, "#0b0a1e");
    ctx.fillStyle = grad;
    roundRectPath(ctx, 0, 0, canvas.width, canvas.height, 28);
    ctx.fill();

    ctx.strokeStyle = "rgba(232, 182, 76, 0.45)";
    ctx.lineWidth = 3;
    roundRectPath(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 24);
    ctx.stroke();

    try {
        const logo = await loadImage("icons/icon-512.png");
        ctx.drawImage(logo, 48, 48, 110, 110);
    } catch (err) {
        console.warn("Business card: logo failed to load, skipping it in the PNG:", err);
    }

    const fullName = bizCard.querySelector(".biz-card__fullname")?.textContent || "";
    const handle = bizCard.querySelector(".biz-card__handle")?.textContent || "";

    ctx.textAlign = "right";
    ctx.fillStyle = "#f6d383";
    ctx.font = "700 46px Orbitron, sans-serif";
    ctx.fillText(fullName, canvas.width - 48, 100);

    ctx.fillStyle = "#c9c3e0";
    ctx.font = "400 26px Inter, sans-serif";
    ctx.fillText(handle, canvas.width - 48, 136);

    const contactLines = Array.from(bizCard.querySelectorAll(".biz-card__contact span")).map(
        (el) => el.textContent
    );
    ctx.textAlign = "left";
    ctx.font = "400 26px Inter, sans-serif";
    contactLines.forEach((line, i) => {
        ctx.fillText(line, 48, 360 + i * 36);
    });

    const tags = Array.from(bizCard.querySelectorAll(".biz-card__tags li")).map(
        (el) => el.textContent
    );
    let tagX = 48;
    const tagY = canvas.height - 56;
    ctx.font = "600 20px Inter, sans-serif";
    tags.forEach((tag) => {
        const textWidth = ctx.measureText(tag).width;
        const padX = 16;
        const pillW = textWidth + padX * 2;
        ctx.fillStyle = "rgba(232, 182, 76, 0.12)";
        ctx.strokeStyle = "rgba(232, 182, 76, 0.45)";
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, tagX, tagY - 26, pillW, 40, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e8b64c";
        ctx.textAlign = "left";
        ctx.fillText(tag, tagX + padX, tagY);
        tagX += pillW + 12;
    });
    
    return canvas;
}

downloadCardBtn?.addEventListener("click", async () => {
    downloadCardBtn.disabled = true;
    try {
        const canvas = await renderCardToCanvas();
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "andrzej-kaminski-business-card.png";
            a.click();
            URL.revokeObjectURL(url);
        }, "image/png");
    } catch (err) {
        console.warn("Business card: PNG export failed", err);
    } finally {
        downloadCardBtn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// Footer version — auto-derived from data/changelogs/site.json's highest
// version, so it never has to be bumped by hand across every page again.
// Shared with changelog.js (loaded after this file) instead of duplicated —
// same reasoning as translate()/setLanguage() already being shared.
// ---------------------------------------------------------------------------

// Compares two "x.y.z"-style version strings numerically, part by part —
// safer than a plain string sort, which would put "1.10.0" before "1.9.0"
// (string comparison on "10" vs "9").
function compareVersions(a, b) {
    const partsA = String(a).split(".").map(Number);
    const partsB = String(b).split(".").map(Number);
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
        const diff = (partsA[i] || 0) - (partsB[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

const footerVersionEls = document.querySelectorAll(".footer-version");

async function updateFooterVersion() {
    if (!footerVersionEls.length) return;
    try {
        const res = await fetch("data/changelogs/site.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const versions = Array.isArray(data.versions) ? data.versions : [];
        if (!versions.length) return;

        const highest = versions.reduce((best, v) =>
            compareVersions(v.version, best.version) > 0 ? v : best
        );
        footerVersionEls.forEach((el) => {
            el.textContent = `v${highest.version}`;
        });
    } catch (err) {
        // site.json ships as part of the site's own files, so this should be
        // near-impossible in practice — but if it ever does fail, the footer
        // just keeps its "v—" placeholder instead of showing a stale number.
        console.warn("Failed to load site version:", err);
    }
}

updateFooterVersion();