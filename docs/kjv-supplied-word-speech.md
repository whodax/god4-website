# KJV supplied wording: display and Read Aloud

## Source investigation

The unchanged `tools/import-kjv.js` imports eBible's `eng-kjv_vpl.zip`,
removing a leading paragraph marker but preserving verse text and punctuation.
The imported annotation is square brackets, not ordinary round parentheses:

- Genesis 1:2: `darkness [was] upon the face of the deep`.
- Genesis 1:4: `the light, that [it was] good`.
- Genesis 14:8: `(the same [is] Zoar;)` contains both an ordinary aside and
  a supplied word. Only the square brackets around `is` are annotation.
- Genesis 35:18: `(for she died)` is an ordinary aside and remains verbatim.
- 1 John 2:23: `[[but] he that acknowledgeth the Son hath the Father also]`
  is exceptional. USFM marks the entire outer range as supplied; the inner
  `[but]` is literal source punctuation and must remain.

Primary sources inspected, without importing or writing Bible data:

- [KJV VPL source archive](https://ebible.org/Scriptures/eng-kjv_vpl.zip)
- [KJV USFM source archive](https://ebible.org/Scriptures/eng-kjv_usfm.zip)
- [eBible KJV Genesis 1](https://ebible.org/eng-kjv/GEN01.htm)

The read-only USFM audit compared all 21,503 outer bracket ranges in the
repository's 66 books against the source's `\add` / `\+add` wording, in order,
stripping source formatting and trimming range-edge whitespace for comparison.
Every local range matched. Seven additional source-only USFM ranges were not
present in the imported verse strings; they are not added to our data.
The local corpus contains 31,102 verses, 21,504 opening square brackets
(including the literal nested pair), and 222 opening round parentheses.

## Minimal production change

Previously both device speech and the cloud request received raw bracketed
verse text. Those annotation boundaries were consequently handed to the
speech engine as punctuation. Acoustic pause length depends on the voice.

`js/bible/speech.js` now derives a separate speech-only string at the shared
utterance-construction point. Only explicit `kjv` locations unwrap the outer
supplied-word annotation. The substitution is a single pass: nested literal
brackets survive. No words, spacing, ordinary parentheses, sentence punctuation,
verse indexes, playback locations, callbacks or canonical text are changed.
Chapter, single-verse and repeat playback share this point, including cloud
requests, native playback, cloud failure fallback and offline native playback.
WEB, DRA and unknown translation locations remain verbatim.

Reader uses traditional `<i>` styling after escaping and tokenizing the text.
Only KJV rendering receives this presentation transformation. Existing fonts,
sizes, colors, inline wrapping, verse numbers and word-study button names remain
unchanged. The raw `data-verse-text` stays canonical for saved verses and lookup.
Search and Compare are not reformatted. One screen-reader-only explanation
precedes the passage when KJV is displayed; it is outside live status regions
and is not attached to every word or announced on each focus movement.

No additional script, asset, network request or asynchronous dependency is
introduced. The historical eager-JavaScript budget assertion is unchanged.

## Installed users and offline behavior

Shell cache advances from 45 to 46. All 47 existing precached URLs, separate
Bible caches, saved data and explicit user-accepted update activation are
unchanged. The new shell must install completely before an update is offered;
acceptance reloads the updated Reader and speech scripts. HTML and CSS are
unchanged; the explanation is rendered with the Reader's KJV passage, avoiding
mixed-version HTML/CSS dependencies while a worker waits. Failed installation
leaves the old worker usable; retry installs the complete new shell.

The installed-user fixture retains historical cache-43/44 coverage and adds
real cache-45-to-46 upgrades at desktop, 320px and 390px. It compares old/new
asset hashes before acceptance, after acceptance and offline, retains WEB/DRA
and KJV data and saved verses, checks cross-tab behavior, and exercises a failed
speech-script installation followed by a safe retry. Old/new speech payloads
are asserted against real Genesis 1:2, not a changed expected Bible checksum.

## Validation and acceptance limits

`tests/kjv-supplied-words.unit.js` checks every KJV verse, real supplied-word
and parenthetical examples, the nested-bracket exception, escaping and explicit
translation gating. The browser suite covers native/cloud/fallback playback,
repeat, pause/resume, highlighting, navigation, canonical saved text, WEB/DRA,
keyboard Word Study and Escape/focus return at desktop, 320px and 390px in normal
and fullscreen Reader. Existing speech, Reader, Word Study and PWA regressions
remain in force. Bible bytes, manifests, Isaiah hashes and CSP are not changed.

Automated speech uses deterministic device/audio mocks and inspects the exact
cloud request text; it does not establish audible prosody on physical devices.
Physical Android/iOS voice listening and TalkBack/VoiceOver announcement checks
remain release-review acceptance items. Meaningful source parentheses and the
literal `[but]` may still produce appropriate engine-dependent pauses.

## Final targeted results

Each Playwright invocation used one worker and zero retries. Suites ran
sequentially, not as an unrestricted full-suite invocation.

| Gate | Passed |
| --- | ---: |
| KJV browser regressions (12 playback/layout plus 1 Search/Compare) | 13 |
| Existing Reader speech/highlighting | 45 |
| Existing cloud-TTS browser behavior | 44 |
| Reader verse cleanup | 4 |
| Reader tab positioning | 18 |
| Word Study loader, including unchanged historical performance gate | 43 |
| Installed cache 43/44/45 to 46 upgrades | 14 |
| PWA | 17 |
| Offline translation management | 12 |
| Auth vendor cache | 38 |
| Auth loader | 20 |
| Compare loader | 32 |
| Reader empty-verse coordinates | 20 |
| Cloud-TTS endpoint contracts | 97 |
| KJV unit/corpus tests | 8 |
| All 66 Isaiah chapter hashes and byte counts | 1 |
| **Total unique final checks** | **426** |

Final results: no failures, skips or retries. Initial new-fixture errors were
corrected: translation data must be loaded before reference navigation; a repeat
test must await its new audio source rather than end a stale source; and HTML
uses network-first fetching, unlike the cache-first scripts. No production
expectation or historical budget was relaxed to address those fixture errors.

LF-canonical eager script bytes: production baseline **290,529**, proposed
**290,894** across the same 21 scripts. The historical budget remains **290,914**;
the margin is **20 bytes**. This is a deterministic source-byte gate, not a
timing tolerance; future eager additions will require reducing or deferring work.
Asset/translation-manifest validation, syntax checks and `git diff --check`
passed. All canonical Bible files, manifests, CSS, HTML, application/Scripture
Discovery code and CSP remain unchanged.

The 14-file scope is Reader, speech, the shell version, this document, two new
KJV test files, the extended installed-user fixture, and seven existing test
files whose only edits advance their current-shell expectations from 45 to 46.
