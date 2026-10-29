# Catholic Bible simplification

The user-facing abbreviation is CTH. The full display name is Catholic Bible
(Douay-Rheims). The stable internal identifier remains dra.

| Concern | Value / behavior |
| --- | --- |
| Reader, Compare, Search and other abbreviation labels | CTH |
| Full translation name, including offline lists | Catholic Bible (Douay-Rheims) |
| Voice names | Catholic, Catholic Bible, CTH, C T H |
| Backward-compatible voice names | DRA, D R A, actual Douay-Rheims names |
| Experimental phonetic aliases | Removed |
| Temporary voice diagnostics | Removed, including fragment activation and styles |
| Internal translation ID / Bible file | dra / js/bible/dra.js |
| Stored selection / Saved Verses location | dra / translationId: dra |
| Existing saved (DRA) reference | Render (CTH); preserve original storage identity |
| New saved reference | (CTH), with internal translationId: dra |
| Catholic canon, source attribution and numbering protections | Unchanged |
| Other eight translations | Unchanged |
| Offline keys, manifests, assets and Bible downloads | Unchanged |
| Service-worker release / precache asset count | Shell 53 / 49 |

No data migration or asset rename is required. Existing saved data with or without
location metadata keeps its stored reference and text. Located legacy saves still
open in dra and are recognized as already saved; removal uses their original
reference. Legacy references without location metadata receive the same display
replacement without inventing passage coordinates.

Runtime changes are confined to Catholic catalog display metadata, saved-reference
rendering, the explicit Catholic voice-name list and removal of diagnostics.
Shared catalog consumers supply labels consistently across Reader, Compare, Search,
offline management, save feedback and speech status. No UI layout, focus behavior,
Android microphone-turn boundary, speech provider or canon data is changed.

Regression coverage includes CTH and legacy DRA commands, compound Tobit navigation,
retired-phonetic rejection, ambiguity safeguards, primary/alternative conflicts,
diagnostic removal, legacy saved-data preservation and all existing canon and
numbering protections. Browser checks run with one worker and zero automatic retries.


## Validation results

| Coverage | Passing cases |
| --- | ---: |
| Voice navigation and simplified Catholic commands | 65 |
| Catholic labels, legacy saved data and Search display/navigation | 42 |
| Catholic canon, numbering, Search, Compare and saving | 50 |
| Compact Reader | 21 |
| Mobile/desktop WEB labels and Catholic display | 21 |
| Translation picker and accessibility | 32 |
| Offline translation management | 12 |
| Android native/cloud/fallback speech | 32 |
| Android command-turn isolation | 82 |
| Historical Shell 43–52 upgrades and cached-byte verification | 63 |
| Historical startup budget and first-use readiness | 1 |
| Node alias and Catholic-canon tests | 36 |

421 distinct browser checks and 36 Node tests pass. Browser runs used one worker
and zero automatic retries; Node used test-concurrency=1. The initial focused run
passed 106 checks and exposed one typo in the new Search fixture (#searchResults
instead of #results). Correcting that selector and explicitly verifying its
CTH label and internal dra navigation passed. No failures remain unresolved.

Asset validation passed for 36 references, 22 startup syntax checks, three icons
and all nine translation metadata entries. Changed JavaScript syntax and git diff
whitespace checks pass. Direct comparisons confirm the eight other catalog
entries, Bible asset dra.js, canon data, storage module, translation manifest,
speech providers and sw.js are unchanged from d7fc643.

The existing browser performance check measured 22 startup scripts / 281,934
canonical LF decoded bytes, versus 282,861 before this simplification (-927).
The unchanged historical budget is 290,914 bytes, leaving 8,980 bytes. Local Word
Study first-use network readiness measured 22.4ms; this is not a latency benchmark.

No push, merge or deployment was performed. Physical Android acoustic recognition
and TalkBack acceptance remain manual checks; browser recognition fixtures inject
transcripts and do not substitute for device testing.
