// [-Bravo-] portfolio — changelog page logic

const changelogList = document.getElementById("changelogList");
const changelogEmpty = document.getElementById("changelogEmpty");
const changelogError = document.getElementById("changelogError");
const projectNameEl = document.getElementById("projectName");

const versionToggle = document.getElementById("versionToggle");
const versionMenu = document.getElementById("versionMenu");
const versionCurrent = document.getElementById("versionCurrent");
const versionSearch = document.getElementById("versionSearch");
const versionList = document.getElementById("versionList");
const versionSearchEmpty = document.getElementById("versionSearchEmpty");

const params = new URLSearchParams(window.location.search);
const projectSlug = params.get("project");

// Builds a matched pair of EN/PL spans, following the same data-lang
// pattern used everywhere else on the site.
function bilingualSpan(className, en, pl) {
    const wrapper = document.createElement("span");
    if (className) wrapper.className = className;

    const enSpan = document.createElement("span");
    enSpan.setAttribute("data-lang", "en");
    enSpan.textContent = en;

    const plSpan = document.createElement("span");
    plSpan.setAttribute("data-lang", "pl");
    plSpan.hidden = true;
    plSpan.textContent = pl;

    wrapper.appendChild(enSpan);
    wrapper.appendChild(plSpan);
    return wrapper;
}

let changelogData = null; // set once loadChangelog() succeeds, reused on language switches

// `project` is the one language-neutral display name (used as a fallback
// and for things like console warnings). `projectDisplay: { en, pl }` is
// optional per-language wording — e.g. "Portfolio Site" vs "Stron
// portfolio" — most projects (proper names like "Virtual Hell") won't need
// it and can just rely on `project`.
function projectTitleFor(data, lang) {
    const display = data.projectDisplay;
    return (display && (display[lang] || display.en)) || data.project || projectSlug;
}

function updateProjectName() {
    if (!changelogData) return;
    const lang = document.body.getAttribute("data-lang") || "en";
    const projectTitle = projectTitleFor(changelogData, lang);

    if (projectNameEl) projectNameEl.textContent = projectTitle;
    document.title = `${projectTitle} Release Notes - Andrzej Kamiński`;
}

document.addEventListener("languagechange", updateProjectName);

// Builds one <ul class="changelog-changes"> from a pair of EN/PL change arrays
// — shared by both the categorized and flat (legacy) render paths below.
function buildChangeList(changesEn, changesPl) {
    const list = document.createElement("ul");
    list.className = "changelog-changes";

    const changeCount = Math.max(changesEn.length, changesPl.length);
    for (let i = 0; i < changeCount; i++) {
        const li = document.createElement("li");
        li.appendChild(bilingualSpan(null, changesEn[i] || "", changesPl[i] || ""));
        list.appendChild(li)
    }

    return list;
}

// compareVersions() now lives in app.js (loaded before this file) — shared
// with the footer-version auto-derive feature instead of duplicated here.

// Builds one <article class="changelog-entry"> for a single version — the
// same markup the old flat renderChangelog() loop used to build per
// iteration, just factored out so the version switcher can render one at
// a time instead of the whole list at once
function buildVersionEntry(version) {
    const entry = document.createElement("article");
    entry.className = "changelog-entry";

    const heading = document.createElement("h2");
    heading.appendChild(
        bilingualSpan("changelog-version", `Version ${version.version}`, `Wersja ${version.version}`)
    );

    if (version.date && version.date !== "YYYY-MM-DD") {
        const dateEl = document.createElement("span");
        dateEl.className = "changelog-date";
        dateEl.textContent = version.date;
        heading.appendChild(dateEl);
    }

    entry.appendChild(heading);

    // version.categories ( array of { name: {en, pl}, changes: {en, pl} })
    // renders each group under its own sub-heading. Older/simpler entries
    // without categories fall back to a single flat version.change list,
    // same as before — so this stays compatible with any changelog file
    // that doesn't use categories.
    const categories = Array.isArray(version.categories) ? version.categories : null;

    if (categories) {
        categories.forEach((category) => {
            const categoryName = category.name || {};
            const categoryHeading = document.createElement("h3");
            categoryHeading.className = "changelog-category";
            categoryHeading.appendChild(
                bilingualSpan(null, categoryName.en || "", categoryName.pl || "")
            );
            entry.appendChild(categoryHeading);

            const changesEn = (category.changes && category.changes.en) || [];
            const changesPl = (category.changes && category.changes.pl) || [];
            entry.appendChild(buildChangeList(changesEn, changesPl));
        });
    } else {
        const changesEn = (version.changes && version.changes.en) || [];
        const changesPl = (version.changes && version.changes.pl) || [];
        entry.appendChild(buildChangeList(changesEn, changesPl));
    }

    return entry;
}

let sortedVersions = []; // newest-first, (re)built once per loadChangelog() call

// Renders exactly one version's entry into #changelogList (replacing
// whatever was there) and syncs the dropdown's button label + selected state.
function showVersion (index) {
    const version = sortedVersions[index];
    if (!version) return;

    changelogList.innerHTML = "";
    changelogList.appendChild(buildVersionEntry(version));
    if (versionCurrent) versionCurrent.textContent = version.version;
    if (versionList) {
        versionList.querySelectorAll("button").forEach((btn) => {
            btn.setAttribute("aria-selected", Number(btn.dataset.versionIndex) === index ? "true" : "false");
        });
    }

    // Newly injected spans need to match whatever language is currently
    // active — same reasoning as loadChangelog()'s finally block below.
    const currentLang = document.body.getAttribute("data-lang") || "en";
    if (typeof setLanguage === "function") {
        setLanguage(currentLang);
    }
}

// Live-filters the dropdown's <li> items by version number / date against
// the search box's current value, and shows/hides the "no matches" note.
function filterVersionList(query) {
    if (!versionList) return;
    const normalized = query.trim().toLowerCase();
    let visibleCount = 0;

    versionList.querySelectorAll("li").forEach((li) => {
        const match = !normalized || li.dataset.searchText.includes(normalized);
        li.hidden = !match;
        if (match) visibleCount++;
    });

    if (versionSearchEmpty) versionSearchEmpty.hidden = visibleCount !== 0;
}

function buildVersionMenu() {
    if (!versionList) return;
    versionList.innerHTML = "";

    sortedVersions.forEach((version, index) => {
        const li = document.createElement("li");
        li.dataset.searchText = `${version.version} ${version.date || ""}`.toLowerCase();

        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "option");
        btn.dataset.versionIndex = String(index);
        btn.textContent = version.date && version.date !== "YYYY-MM-DD"
            ? `${version.version} — ${version.date}`
            : version.version;
        
        li.appendChild(btn);
        versionList.appendChild(li);
    });
}

function renderChangelog(data) {
    changelogData = data;
    updateProjectName();

    const versions = Array.isArray(data.versions) ? data.versions : [];

    if (versions.length === 0) {
        if (changelogEmpty) changelogEmpty.hidden = false;
        return;
    }

    // Newest first — sorted numerically, not trusted to already be in that
    // order in the JSON file (versions get added by hand; one added out of
    // order should still land in the right place here).
    sortedVersions = versions.slice().sort((a, b) => compareVersions(b.version, a.version));

    const versionSwitch = document.querySelector(".version-switch");
    if (versionSwitch) versionSwitch.hidden = sortedVersions.length < 2;

    buildVersionMenu();
    showVersion(0);
}

async function loadChangelog() {
    if (!projectSlug) {
        if (changelogError) changelogError.hidden = false;
        return;
    }

    try {
        const response = await fetch(`data/changelogs/${projectSlug}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        renderChangelog(data);
    }   catch (err) {
        console.warn("Failed to load changelog:", err);
        if (changelogError) changelogError.hidden = false;
    }   finally {
        // Newly injected spans need to match whatever language is currently
        // active (app.js defines setLanguage globally, loaded before this file).
        const currentLang = document.body.getAttribute("data-lang") || "en";
        if (typeof setLanguage === "function") {
            setLanguage(currentLang);
        }
    }
}

// Version switcher — the same open/close/click-outside pattern as
// the language switcher in app.js, plus a live search filter thrown in.
function updateVersionSearchPlaceholder() {
    if (!versionSearch || typeof translate !== "function") return;
    versionSearch.placeholder = translate("changelog.versionSearchPlaceholder", "Search versions...");
}

document.addEventListener("languagechange", updateVersionSearchPlaceholder);
updateVersionSearchPlaceholder();

versionToggle?.addEventListener("click", () => {
    const expanded = versionToggle.getAttribute("aria-expanded") === "true";
    const opening = !expanded;
    versionToggle.setAttribute("aria-expanded", String(opening));
    if (versionMenu) versionMenu.hidden = !opening;
    if (opening && versionSearch) {
        versionSearch.value = "";
        filterVersionList("");
        versionSearch.focus();
    }
});

versionList?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-version-index]");
    if (!btn) return;
    showVersion(Number(btn.dataset.versionIndex));
    if (versionMenu) versionMenu.hidden = true;
    versionToggle?.setAttribute("aria-expanded", "false");
});

versionSearch?.addEventListener("input", () => {
    filterVersionList(versionSearch.value);
});

document.addEventListener("click", (event) => {
    if (!versionMenu || versionMenu.hidden) return;
    if (event.target.closest(".version-switch")) return;
    versionMenu.hidden = true;
    versionToggle?.setAttribute("aria-expanded", "false");
});

loadChangelog();