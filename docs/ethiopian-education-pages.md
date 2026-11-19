# Ethiopian Bible educational pages

This phase reorganizes the educational information from the long homepage section into two standalone pages:

- `/ethiopian-bible.html`: historical canon, distinctive books, source editions, limitations and church-order writings.
- `/books-of-enoch.html`: 1 Enoch's major divisions and historical introductions to 2 and 3 Enoch.

The homepage `#ethiopian` section is intentionally short and links to both pages. Both pages reuse existing GOD4.us variables, fonts and dark-theme handling, with narrowly scoped `css/ethiopian-guide.css`. The Bible Reader, existing nine translations, manifest, and service worker are untouched.

## Checks

Run `node tests/ethiopian-education.test.js` for static markup checks. Before merge, inspect both pages and their return navigation in Cloudflare Pages, keyboard tab order, theme persistence, 320/390/430px layout, TalkBack semantics, browser console and full regression suite.

## Scope and provenance

The guide describes an 81-book canon tradition, but the proposed 84-entry English collection is not an official 84-book Ethiopian canon. Only 1 Enoch among 1–3 Enoch is Ethiopian Orthodox biblical Scripture. The proposed collection has 1 Enoch, but not 2 or 3 Enoch. The 84-entry text file is not deployed. The restricted 4 Baruch CCAT edition is excluded. Some older source editions use related textual traditions and their sentence-based verse numbers are editorial. Keep source/translator metadata available when planning future imports.
