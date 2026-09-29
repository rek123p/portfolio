# Known Issues

A running list of things that are known not to work as well as they should — mostly performance-related, mostly on mobile. This isn't a full bug tracker, just an honest account of what's rough around the edges and why, so it doesn't come as a surprise.

## Mobile performance

Observed 2026-09-29 testing the live site on a phone, on both Firefox and Chrome. Page load time itself is excluded below (that testing session had a weak signal, unrelated to the site) — this is about stutter/rendering once the page is actually loaded.

### Firefox (mobile)
- Parallax starfield stutter - **expected**. Firefox doesn't support native scroll-linked CSS animations (`animation-timeline: scroll()`), so the starfield parallax falls back to a JS/`requestAnimationFrame` implementation (see `js/app.js`), which is inherently heavier than the CSS-driven path Chromium browsers get. Some stutter here is a known tradeoff of that fallback, not a bug in itself.
- Light stutter on the WebGL Sun/Moon/Earth cosmic background — **partially expected**. Running a WebGL-rendered rotating body is real GPU work; some cost on mobile is expected, though the degree observed is being tracked.
- Slightly stronger stutter on the WebGL Hero badge (spinning shark logo) — **partially expected**, same reasoning as above.

### Chrome (mobile)
- Severe stutter specifically on the sections showing the WebGL planets (Sun/Moon/Earth cosmic background) — **not expected**, noticeably worse than Firefox's equivalent stutter. Not yet understood why Chrome fares worse here than Firefox, given Chrome otherwise gets the lighter native-CSS parallax path.
- The page doesn't render correctly during fast scrolling — scrolling briefly shows a black background, and after releasing the scroll gesture there's a delay of up to ~2 seconds before content re-renders. **Not expected**, and likely a distinct bug from the stutter above rather than the same root cause. Suspected (unconfirmed) connection: the cosmic background's IntersectionObserver-driven pause/resume-when-scrolled-out-of-view logic interacting badly with Chrome mobile's scroll/repaint behavior.

**Conclusion:** mobile optimization, especially around the WebGL cosmic background, needs real work. Likely candidates once this gets picked up: reducing the number of concurrent WebGL contexts (Hero logo + Sun + Moon + Earth = up to 4 running at once), a more conservative mobile-specific pixel ratio / FPS cap, and confirming whether the Chrome-specific render bug really is the IntersectionObserver pause/resume path before touching anything else.

## Other known limitations

- **Currency rate refresh can lag by hours.** `data/rates.json` is refreshed by a GitHub Actions scheduled workflow (`update-rates.yml`). GitHub's own `schedule:` trigger has had an ongoing, platform-wide reliability problem since around August 2026 — confirmed by GitHub staff on the GitHub Community forum — where scheduled workflow runs get delayed by hours or dropped outright, independent of how the cron expression is written. The site's currency-conversion UI always stays functional (it just reads whatever's currently in the static rates file), but the "last updated" timestamp can occasionally be much older than the configured schedule suggests. A hard fix means triggering the refresh from outside GitHub's own scheduler (e.g. an external cron service calling `workflow_dispatch`) — tracked separately as an "Outside-trigger" backlog item, since it needs new external infrastructure rather than a code change.
- **Firefox's starfield parallax runs a heavier code path than Chromium.** See above — an architectural tradeoff of Firefox lacking `animation-timeline: scroll()` support, not something a quick fix resolves.