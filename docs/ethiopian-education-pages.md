# Ethiopian Bible educational pages

This phase reorganizes the educational information from the long homepage section into two standalone pages:

- `/guides/ethiopian-bible.html`: historical canon, distinctive books, source editions, limitations and church-order writings.
- `/books-of-enoch.html`: 1 Enoch's major divisions and historical introductions to 2 and 3 Enoch.

The homepage `#ethiopian` section is intentionally short and links to both pages. Both pages reuse existing GOD4.us variables, fonts and dark-theme handling, with narrowly scoped `css/ethiopian-guide.css`. The educational guide lives under `/guides/`, outside the legacy Cloudflare Worker route `/ethiopian-bible*`. Shell 61 refreshes the cached homepage with the new link. The guides are available online and use the standard offline page when opened without a connection. The Bible Reader, existing nine translations, and manifest are untouched.

## Reading links

The Ethiopian Bible guide links directly to the [existing Ethiopian Bible flipbook](https://online.fliphtml5.com/ekjsx/blhe/), the Bible Society of Ethiopia’s [Ge’ez New Testament at Matthew 1](https://www.bible.com/bible/3177/MAT.1.%E1%88%90%E1%8A%AA%E1%8C%8D), and [Jubilees chapter 1 in R. H. Charles’s translation](https://ccel.org/ccel/c/charles/otpseudepig/files/jubilee/1.htm).

The Books of Enoch guide opens chapter 1 of [1 Enoch in the Charles edition](https://en.wikisource.org/wiki/The_Book_of_Enoch_(Charles)/Chapter_01), [2 Enoch in the Morfill edition](https://scriptura.si/works/enoch-2-morfill-1896/2/), and [3 Enoch in the Odeberg translation transcribed by Margins](https://margins.bible/3-enoch/chapter-1/). All reading links open outside the GOD4.us Reader.

## Checks

Run `node tests/ethiopian-education.test.js` for static markup checks. Before merge, inspect both pages and their return navigation in Cloudflare Pages, keyboard tab order, theme persistence, 320/390/430px layout, TalkBack semantics, browser console and full regression suite. Verify that upgrading from Shell 60 refreshes the offline homepage and preserves downloaded translations, settings, and reading progress.

## Scope and provenance

The guide describes an 81-book canon tradition, but the proposed 84-entry English collection is not an official 84-book Ethiopian canon. Only 1 Enoch among 1–3 Enoch is Ethiopian Orthodox biblical Scripture. The proposed collection has 1 Enoch, but not 2 or 3 Enoch. The 84-entry text file is not deployed. The restricted 4 Baruch CCAT edition is excluded. Some older source editions use related textual traditions and their sentence-based verse numbers are editorial. Keep source/translator metadata available when planning future imports.
