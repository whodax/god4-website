# god4-website
Bible website

## Automated testing

This project has a small Playwright safety net for the existing static site. Run
`npm test` to check local CSS/JavaScript references and JavaScript syntax, then
run browser tests against a temporary local web server.

The browser tests protect the homepage, navigation, hero verse rotation,
save/tray behavior, search, reader controls, highlighting, fullscreen,
translation comparison, reading-plan progress, and switching between study
views. They also fail on browser console errors and page errors encountered
during the homepage check.

This foundation does not yet cover every responsive layout, accessibility
criterion, external resource, or future persistence/API behavior.

## Phase 2, Step 1: Bible data foundation

The Bible reader now uses the data-access layer in `js/bible/data.js` instead
of reading the raw library structure directly. That layer can list
translations and books, report chapter counts, return chapters or individual
verses, and provide a simple search interface for future Scripture search
features.

The current Scripture content remains in `js/bible/library.js`. It is clearly
treated as the current local/demo dataset only; it is not a complete Bible.
The repository does not document its original source, copyright status, or
permission for reuse, so those details remain unknown and require verification.

## Phase 2, Step 2: World English Bible

The World English Bible Protestant Edition (WEBP, `engwebp`) is included as a
complete 66-book local dataset in `js/bible/web.js`. It was generated from the
official eBible.org HTML archive at https://ebible.org/engwebp/. The WEB text is
public domain; “World English Bible” is a trademark of eBible.org, so the
application preserves the source and attribution metadata in `js/bible/data.js`.

WEB is registered alongside the legacy demo provider and supports the same
book, chapter, verse, and search methods. It is available in the Reader and
Compare translation selectors. The existing demo and legacy comparison data
remain in place for compatibility.

## Phase 1 foundation and workflow

GOD4.us remains a static site served from `index.html`. Presentation is split
across the CSS files in `css/`, while the Bible library and companion behavior
are separated into the plain JavaScript files in `js/bible/`; general homepage
behavior lives in `js/app.js`. No framework or build step is required.

Development work starts from `development` on a feature branch. Changes are
validated with `npm test`, reviewed in a pull request targeting `development`,
and checked in a Cloudflare Preview deployment before production review.
The `main` branch is reserved for production and is not used for experimental
work.
