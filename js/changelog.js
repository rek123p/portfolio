// [-Bravo-] portfolio — changelog page logic

const changelogList = document.getElementById("changelogList");
const changelogEmpty = document.getElementById("changelogEmpty");
const changelogError = document.getElementById("changelogError");
const projectNameEl = document.getElementById("projectName");

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

function renderChangelog(data) {
    changelogData = data;
    updateProjectName();

    const versions = Array.isArray(data.versions) ? data.versions : [];

    if (versions.length === 0) {
        if (changelogEmpty) changelogEmpty.hidden = false;
        return;
    }

    versions.forEach ((version) => {
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

        // version.categories (array of { name: {en, pl}, changes: {en, pl} })
        // renders each group under its own sub-heading. Older/simpler entries
        // without categories fall back to a single flat version.changes list,
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

        changelogList.appendChild(entry);
    });
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

loadChangelog();