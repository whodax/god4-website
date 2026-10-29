# Verified Ruth 2:2 Compare compatibility

Base: 5526714bbd652844bf27a6af32fa5d45787f2c46.

The physical Android report reproduced on desktop and Android-emulated Chromium:
CTH Reader Ruth 2:2 handed to Compare retained internal dra as its reference
origin. Selecting YLT and GNV then hid both loaded verses because the existing
book-level policy gates Catholic/Protestant Old Testament comparisons. Fresh,
warm and persisted contexts reproduced it; translation downloads were successful.

## Reviewed equivalence

| Reference origin | Target | Approved source and target coordinate |
| --- | --- | --- |
| dra (CTH) | ylt | Ruth 2:2 -> Ruth 2:2 |
| ylt | dra (CTH) | Ruth 2:2 -> Ruth 2:2 |
| dra (CTH) | gnv | Ruth 2:2 -> Ruth 2:2 |
| gnv | dra (CTH) | Ruth 2:2 -> Ruth 2:2 |

This is a reviewed identity correspondence for one verse, not a general numbering
conversion. All three imported editions have 23 verses in Ruth chapter 2. Verse 2
contains Ruth's request to glean and Naomi's permission, with the same verse
boundaries. The upstream source editions confirm the correspondence:

- [Douay-Rheims Ruth 2](https://ebible.org/engDRA/RUT02.htm), verse 2.
- [Young's Literal Translation Ruth](https://ebible.org/pdf/engylt/engylt_RUT.pdf#page=3), printed page iii, verse 2.
- [Geneva Bible 1599 Ruth 2](https://ebible.org/enggnv/RUT02.htm), verse 2.

No other verse, chapter, translation pair or whole chapter receives a new
approval. In particular, equal verse counts do not establish chapter-wide
or book-wide equivalence. WEB/ASV and other unreviewed Catholic pairings remain
gated even at Ruth 2:2. Existing Protestant comparisons retain their old policy.

## Implementation boundaries

Only the lazy Compare runtime changes. Its canComparePassage helper first uses
the unchanged BibleCanon.comparable policy, then adds the four exact directed
pairs above. Both getCompareVerses and warning rendering use this helper.
Missing chapters, absent verses and empty verse strings still produce an
unavailable message; approval never invents or substitutes text. Empty selected
verses now receive the same unavailable handling as absent selected verses.

Changing editions never changes the retained reference origin or stored reference
format. The shared canon policy, Reader/voice switching, Scripture text, Bible
files, all nine translation IDs and labels, storage keys and saved data remain
unchanged. Psalms numbering safeguards and Catholic-only Esther, Daniel and Tobit
restrictions remain in place. There are no design or accessibility changes.

Shell 53 and its 49 precache paths remain unchanged. The upgrade fixture adds the
new Compare SHA-256 to its reviewed-source list; every other source checksum,
historical fixture and actual cached-byte assertion remains intact.

## Regression coverage

The independent unit matrix checks all 81 directed pairs among the nine editions
at eleven coordinates (891 decisions), plus strict coordinate types and the
unchanged shared Reader/voice canon policy.

Desktop and Android-sized browser fixtures cover the real edition selectors,
exact imported verse text, all four approved directions, persisted selections
and Reader reference after reload, independently delayed YLT/GNV loading, a
coordinate changed while loading, retained-offline relaunch under Shell 53,
adjacent unreviewed Ruth verses and whole chapter, unreviewed translation pairs,
Psalms numbering, Catholic-only Esther/Daniel/Tobit passages, and missing/empty
passage data. Browser runs use one worker and zero automatic retries.


## Validation results

| Coverage | Passing distinct cases |
| --- | ---: |
| New Ruth compatibility browser matrix | 18 |
| Compare loader, CSP, focus, timing and offline behavior | 32 |
| Catholic Bible canon, navigation, Search, Compare and saving | 50 |
| Catholic labels, additions, legacy saved data and Search | 42 |
| Compact Reader layout, controls and focus | 21 |
| Saved Verses navigation across reloads and editions | 8 |
| Voice navigation, CTH and legacy DRA aliases | 65 |
| Historical Shell 43–52 upgrades, cache bytes and recovery | 63 |
| Startup budget and first-use readiness | 1 |
| Node equivalence, canon labels and translation voice aliases | 46 |

Final outcomes: 300 distinct browser cases and 46 Node tests pass. Browser runs
used --workers=1 --retries=0; Node used --test-concurrency=1.

The first new browser run passed 17/18; one fixture selected the second edition
before the first edition's render completed. An explicit render wait in the new
fixture resolved the race, and the complete 18-case run passed. The wider run
passed 217/218 and exposed an existing offline Compare fixture still reading
Shell 50 rather than Shell 53. Updating only that cache reference preserved its
49-asset and offline assertions; the explicit verification passed. No unresolved
failures remain, and neither verification used automatic retries.

Asset validation passed for 36 references, 22 startup syntax checks, three icons
and nine translation metadata entries. Changed-file JavaScript syntax and git diff
whitespace checks passed. Protected-file comparisons confirm the shared canon,
CTH metadata, Reader/voice runtime, controls, Scripture assets, storage module,
manifest, application shell, CSS and service worker are unchanged.

Performance: 22 startup scripts / 281,934 canonical LF decoded bytes, unchanged
from the supplied base. The historical 290,914-byte budget leaves 8,980 bytes.
The lazy Compare module adds 580 decoded LF bytes. Local Word Study first-use
network readiness measured 23.2ms; this is not a latency benchmark.

This correction has not been pushed, merged or deployed. Physical Android and
TalkBack acceptance require device verification; browser fixtures emulate the
viewport/input and inject speech rather than running Android accessibility.
