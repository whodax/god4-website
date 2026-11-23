# Ethiopian Bible educational pages

This phase reorganizes the educational information from the long homepage section into two standalone pages:

- `/guides/ethiopian-bible.html`: historical canon, distinctive books, source editions, limitations and church-order writings.
- `/books-of-enoch.html`: 1 Enoch's major divisions and historical introductions to 2 and 3 Enoch.

The homepage `#ethiopian` section links to both pages. Both pages reuse existing GOD4.us variables, fonts and dark-theme handling, with narrowly scoped `css/ethiopian-guide.css`. The educational guide lives under `/guides/`, outside the legacy Cloudflare Worker route `/ethiopian-bible*`. The guides are available online and use the standard offline page when opened without a connection. Shell 62 delivers the independently scrollable Study Desk passage to installed users. Fullscreen uses its existing scroll surface.

## Reading links

The Books of Enoch guide opens chapter 1 of [1 Enoch in the Charles edition](https://en.wikisource.org/wiki/The_Book_of_Enoch_(Charles)/Chapter_01), [2 Enoch in the Morfill edition](https://scriptura.si/works/enoch-2-morfill-1896/2/), and [3 Enoch in the Odeberg translation transcribed by Margins](https://margins.bible/3-enoch/chapter-1/). All reading links open outside the GOD4.us Reader.

Both guides link to `/guides/ethiopian-readings.html`. The Enoch guide links directly to the chosen book. The standalone page loads a catalog and one book at a time, with Read Aloud using an installed English voice. Its offline ZIP includes a self-contained HTML reader, the source notes, the original 84-entry dataset, and the two Enoch companion readings. Open the HTML file from the extracted ZIP for offline reading.

The standalone web and offline readers use a keyboard-focusable reading pane that scrolls independently of their book and chapter controls.

## Checks

Run `node tests/ethiopian-education.test.js` for static markup checks. Before merge, inspect both pages and their return navigation in Cloudflare Pages, keyboard tab order, theme persistence, 320/390/430px layout, TalkBack semantics, browser console and full regression suite. Verify that upgrading from Shell 60 refreshes the offline homepage and preserves downloaded translations, settings, and reading progress.

## Scope and provenance

The guide describes an 81-book canon tradition. The 84-entry historical English collection includes 1 Enoch, which belongs to the Ethiopian Orthodox biblical tradition. The standalone collection adds 2 Enoch from Rutherford H. Platt Jr.’s 1926 edition (68 chapters, via Wikisource) and 3 Enoch from Hugo Odeberg’s 1928 edition (54 sections, via Margins) as companion works. The restricted 4 Baruch CCAT edition is excluded. For 1–3 Meqabyan, the page links to the publisher’s English samples. Some older source editions use related textual traditions and their sentence-based verse numbers are editorial.
