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

## Phase 2, Step 4: King James Version

The King James Version (`kjv`) is included as a complete 66-book local dataset
in `js/bible/kjv.js`. It was imported from the official eBible.org
`eng-kjv_vpl.zip` archive using `tools/import-kjv.js`. The source identifies
the standardized 1769 KJV text as public domain outside the United Kingdom and
credits eBible.org and the CrossWire Bible Society. The source archive also
contains Apocrypha; the importer retains only the canonical 66 Protestant
books in the repository's existing order.

To regenerate the library from the official archive, extract the VPL archive
and run `npm run import:kjv -- path/to/eng-kjv_vpl.txt`.

## Phase 2, Step 5: Young's Literal Translation

The Young's Literal Translation (`ylt`) is included as a complete 66-book
local dataset in `js/bible/ylt.js`. It was imported from the official
eBible.org `engylt_usfm.zip` archive using `tools/import-ylt.js`, which keeps
the source book, chapter, and verse records and removes only USFM formatting
markers. eBible.org identifies YLT as public domain.

To regenerate the library from the official archive, extract the USFM archive
and run `npm run import:ylt -- path/to/extracted/usfm`.

## Phase 2, Step 6: Darby Translation

The Darby Translation (`dby`) is included as a complete 66-book local dataset
in `js/bible/dby.js`. It was imported from the official eBible.org
`engDBY_usfm.zip` archive using `tools/import-dby.js`. The importer filters to
the canonical 66 book IDs, preserves source chapter and verse positions, and
removes only USFM formatting markers. eBible.org identifies the translation,
*The Holy Scriptures, a New Translation from the Original Languages by J. N.
Darby*, as public domain.

To regenerate the library from the official archive, extract the USFM archive
and run `npm run import:dby -- path/to/extracted/usfm`.

## Phase 2, Step 7: Webster Bible

The Webster Bible (`webster`) is included as a complete 66-book local dataset
in `js/bible/webster.js`. It was imported from the official eBible.org
`engwebster_vpl.zip` archive using `tools/import-webster.js`. VPL was selected
because it provides one unambiguous book/chapter/verse record per line, so the
conversion requires no inline markup parsing. eBible.org identifies the
Webster Bible, with amendments by Noah Webster, as public domain.

To regenerate the library from the official archive, extract the VPL archive
and run `npm run import:webster -- path/to/engwebster_vpl.txt`.

## Phase 2, Step 8: Revised Version

The Revised Version (`rv`) is included as a complete 66-book local dataset in
`js/bible/rv.js`. It was imported from the official eBible.org
`eng-rv_usfm.zip` archive using `tools/import-rv.js`. The importer filters to
the canonical 66 Protestant book IDs, preserves chapter and verse positions,
and removes only USFM formatting markers. eBible.org identifies the Revised
Version as public domain. The larger distribution includes Apocrypha, which
is excluded from this application.

To regenerate the library from the official archive, extract the USFM archive
and run `npm run import:rv -- path/to/extracted/usfm`.

## Phase 2, Step 9: Geneva Bible 1599

The Geneva Bible 1599 (`gnv`) is included as a complete 66-book local dataset
in `js/bible/gnv.js`. It was imported from the official eBible.org
`enggnv_usfm.zip` archive using `tools/import-gnv.js`. The importer uses an
explicit canonical 66-book allowlist, preserves source chapter and verse
positions, and removes only USFM formatting and note markers. eBible.org
identifies this digital copy as public domain and notes that its original
historical spelling is intentionally retained.

To regenerate the library from the official archive, extract the USFM archive
and run `npm run import:gnv -- path/to/extracted/usfm`.

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
