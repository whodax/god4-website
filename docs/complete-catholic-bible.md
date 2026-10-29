# Complete Catholic Bible

Current display contract: **CTH — Catholic Bible (Douay-Rheims)**. The internal ID
remains `dra`; historical DRA references below identify the same source edition.
See [Catholic simplification](catholic-bible-simplification.md).

Branch: `feature/complete-catholic-bible`. Baseline: `27952a4be229a7f324e75a5e985093774e6df2d3`.
Changes are uncommitted and unpushed.

## Source and reproducible import

The translation is **Douay-Rheims American Edition of 1899**, eBible.org edition
`engDRA`, shown in GOD4.us as **DRA — Douay-Rheims 1899** (`dra`).
eBible explicitly designates the Bible text Public Domain, both on its
[rights page](https://ebible.org/engDRA/copyright.htm) and in the archive's `copr.htm`.
Attribution: Douay-Rheims American Edition of 1899, eBible.org.
This identifies the selected American edition; it is not a claim that this is the
original, unrevised sixteenth-century Douay-Rheims.

Source: [engDRA_usfm.zip](https://ebible.org/Scriptures/engDRA_usfm.zip).
Retrieved/imported October 15, 2026. Underlying source date: November 3, 2022.
Archive SHA-256: `5cde28923f69015ac56c081e8732d9c8bc30ba5be843d70a7c1cab5677ebaa93`.
Machine-readable provenance is in `data/dra-provenance.json`; SHA-256 checksums of
all 73 original USFM files are in `data/dra-source-checksums.json`.

To reproduce, download that archive, verify the archive digest above, and extract
it into a local source directory outside the deployable site. Then run:

```sh
node tools/import-dra.js /absolute/path/to/extracted/usfm
node tools/generate-translation-manifest.js
node --test tests/catholic-import.unit.js
npm run test:validate
```

The source archive and raw USFM files are not included in the site or shell.
Import output is deterministic: no current timestamp is embedded in the bundle.
Original source checksums and provenance dates identify the reviewed source snapshot.
No Scripture wording is editorially corrected. USFM presentation and word attributes
are removed, whitespace fragments are joined, and application book display names/order
are applied. In particular, eBible Strong's attributes are not treated as verified
word alignment for this Vulgate translation.

## Canon and import architecture

`js/bible/canon.js` is a shared Node/browser module defining stable application IDs,
USFM IDs, names, aliases, testament, canon membership, and per-canon display order.
Existing Protestant editions retain their 66 IDs and ordering. DRA alone uses the
specified 46-book Catholic Old Testament order followed by the existing 27-book NT.
`song-of-solomon` remains its application ID; DRA displays **Song of Songs**.
DRA adds `tobit`, `judith`, `wisdom`, `sirach`, `baruch`, `1-maccabees`, `2-maccabees`.
Aliases include Tobias, Wisdom of Solomon, Ecclesiasticus, Song of Songs/Canticles,
and Psalm. Available books still come from each loaded translation, not the global
catalog; aliases cannot expose an absent book in a Protestant edition.

`tools/usfm.js` provides common cleaning, book parsing and directory import.
DRA uses strict contiguous numeric coordinates and rejects unexpected/missing books,
duplicate IDs/chapters/verses, coordinate suffixes/ranges, gaps and empty verse text.
Existing USFM import scripts share the parser while retaining their explicit legacy
gap and empty-text policies. VPL importers share the identity map with source-format
identifier aliases. Existing Protestant generated corpora are not regenerated.

The DRA chapter inventory is an explicit edition-specific inventory: existing common
book chapter counts plus Esther 16, Daniel 14 and the seven Deuterocanonical counts.
Its book membership agrees with eBible's independently published online index.
This inventory is not generated from the just-imported library. Full verse text is
checked structurally against all source files, rather than claimed as an independent
scholarly proofread of every source verse.

Manifest generation validates exact configured membership/order for each edition,
then derives chapter and verse totals, LF-normalized byte length, SHA-256 revision
and SRI. Runtime `BibleData` retains library-owned chapter and verse coordinates.
The eight previous manifest entries and their Bible asset bytes remain unchanged.

## Source structure and numbering

The archive has 73 USFM files and three auxiliary files. Its source ordering groups
the seven Deuterocanonical books after Malachi; display order deliberately follows
the Catholic ordering specified for this milestone.

Total imported: **73 books, 1,334 chapters, 35,811 verse coordinates**.
All strict source coordinates are contiguous, unique, and contain nonempty text.

| Book | USFM file | Chapters |
|---|---|---:|
| Tobit | 41-TOBengDRA.usfm | 14 |
| Judith | 42-JDTengDRA.usfm | 16 |
| Wisdom | 45-WISengDRA.usfm | 19 |
| Sirach | 46-SIRengDRA.usfm | 51 |
| Baruch | 47-BARengDRA.usfm | 6 |
| 1 Maccabees | 52-1MAengDRA.usfm | 16 |
| 2 Maccabees | 53-2MAengDRA.usfm | 15 |

Esther is one `EST` book, `18-ESTengDRA.usfm`, with 16 chapters. Verse counts:
`22,23,15,17,14,14,10,17,32,13,12,6,18,19,19,24`.
Catholic additional material occupies 10:4–16:24. It is not a separate book.

Daniel is one `DAN` book, `28-DANengDRA.usfm`, with 14 chapters. Verse counts:
`21,49,100,34,31,28,28,27,27,21,45,13,65,42`.
The furnace addition is 3:24–90; Susanna occupies 13:1–64 with a transition at 13:65;
Bel and the Dragon occupies chapter 14 (the dragon appears at 14:22), ending at 14:42.
No `SUS`, `BEL` or `S3Y` book is synthesized. Baruch 6:1–72 contains the Letter of Jeremiah.

DRA uses Vulgate Psalm numbering. Identical numeric references in another tradition
must not be treated as equivalent. This milestone supplies no conversion table.
Conservatively, **all mixed DRA/Protestant Old Testament comparisons are gated**;
the other column explains that equivalence has not been established. Same-edition
and existing Protestant comparisons retain their behavior; common NT comparison
uses the existing coordinate-based behavior and is not an asserted scholarly mapping.

## Reader, Search, Saved, speech and plans

The existing Reader and picker render all 73 DRA books, including long chapters and
the integrated additions. DRA Previous/Next crosses configured Catholic book boundaries.
Protestant chapter navigation behavior is preserved. Picker filtering, typed Search
and spoken references use the central aliases. Neither Search nor the picker loads
DRA merely to populate a book catalog.

Switching away from a Catholic-only book uses the existing John 1 fallback with an
accessible explanation. Switching between DRA and a Protestant OT book resets to
chapter 1 and clears verse selection with a numbering notice. No equivalent passage
is invented. Compare shows an accessible unavailable state for absent books.

The More controls contain a **Save verse** action for the displayed selected/spoken
verse. New saved passages retain `{translationId,bookId,chapter,verse}` in an optional
`location` field alongside their existing reference and text. Legacy `{ref,text}`
entries retain their shape. Saved **Open** verifies availability, intentionally loads
the saved edition, then uses existing Search/Reader navigation. It never reinterprets
a Catholic reference in the currently active Protestant edition.

Narration uses existing chapter arrays, playback callbacks, highlighting and stop/session
guards. No speech engine or voice-profile change is introduced. Original-language
alignment is explicitly unavailable for DRA; generic dictionary fallback remains.
Existing plans, plan references and completion storage are unchanged. Their shared
readiness and navigation paths continue to operate with DRA's common books.

## Offline, cache and performance

DRA uses the current optional translation protocol: on-demand script acquisition,
SRI and structural validation, retain/promote, offline active scripts, and Remove.
It is included in approved translation lists, never in `SHELL_ASSETS` or an eager
startup script tag. Existing Bible and auth-vendor cache namespaces stay unchanged.
Shell changes once: **compact-reader-37 → compact-reader-38**. Upgrade validation
uses the actual baseline shell from commit `27952a4be229a7f324e75a5e985093774e6df2d3`.

DRA decoded bundle: 4,761,720 bytes; gzip level 9: 1,407,527 bytes;
Brotli default: 1,059,758 bytes. Compression figures are local estimates, not measured
Cloudflare response sizes. Startup-shell byte deltas and final test results are
recorded in the accompanying validation report. No production latency claim is made.

## Validation

See `complete-catholic-bible-validation.md` for final commands, exact counts, reruns,
measurements, changed files and release recommendation. Browser speech tests use
deterministic native/cloud mocks; actual device audio and assistive-technology behavior
still require manual release checks. No commit, push, PR or deployment is performed.
