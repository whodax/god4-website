# Word Study Sources

The Word Study importer accepts locally supplied source files and never downloads source material.

## Webster's Unabridged Dictionary

- Project Gutenberg eBook #29765: https://www.gutenberg.org/ebooks/29765
- Project Gutenberg identifies this edition as public domain in the United States.
- The importer uses only parsed dictionary content. Project Gutenberg headers, footers, and trademark references are removed from generated data.

## Moby Thesaurus II

- Project Gutenberg eBook #3202: https://www.gutenberg.org/ebooks/3202
- Main thesaurus source: https://www.gutenberg.org/files/3202/files/mthesaur.txt
- Its included documentation states: "Public Domain material by grant from the author, January, 2001."
- Project Gutenberg identifies the eBook as public domain in the United States.

Public-domain status may differ outside the United States. Raw Gutenberg source files are not deployed and should not be committed unless their retention and distribution requirements are reviewed.

## Conservative contextual sense selection

`js/word-study/sense-selector.js` selects only among the existing Webster
definitions for the exact/stemmed headword already resolved by the dictionary
provider. The corpus, candidate order, definition text and existing Moby related
words are unchanged. Exact lookup, inflection fallback and Dictionary → Local
provider order are unchanged. The provider exposes `senseSelection` metadata:
`selectedIndex` (zero-based), `confidence`, `reasons`, and `ambiguous`.
The panel/controller is unchanged and does not render this metadata.

This module is synchronous, deterministic, dependency-free and performs no
network calls. It is usable offline once the normal dictionary shard is loaded;
this change does not add persistent dictionary caching or guarantee dictionary
availability after an offline reload. The module is loaded before the dictionary
provider and included in shell cache `compact-reader-16`, a single bump from 15.

### Signals and confidence

| Signal | Weight / bound |
| --- | --- |
| Explicit `[Obs.]`, `Obs.`, `obsolete` or `archaic` | −1.5; soft penalty, never automatic exclusion |
| Empty/non-letter text or grammar-only markers such as `pl.` | −6 |
| Obvious dangling continuation punctuation | −3 |
| Long compound blob: over 1,000 characters with compound/domain markers | −0.75 and cannot be confidently promoted |
| Distinct meaningful verse/definition token overlap | +1.25 per match, capped at two matches (+2.5) |
| Generic `Name [headword] of Place` frame plus explicit human-role language in a noun/blank-POS definition opening | +3 |
| Noninitial capitalized display word plus a title-case phrase in a noun definition opening | +0.25 |

Context overlap ignores function words and clicked/matched headword tokens.
Feature-only suffix folding handles common endings, including `created`/`Creator`;
it does not change dictionary key normalization or headword lookup. No English POS
tagger is introduced. The role frame uses generic human-role cues in definitions,
never a word/book/verse-specific override. Capitalization alone cannot promote a
candidate. Hebrew/Greek tokens, morphology, Strong's glosses and alignment guesses
are not used at all.

Evidence is taken from at most the first 420 characters of the opening definition
sentence, after removing double-quoted examples. Repetition and definition length
do not increase the overlap score; trailing citations/compound material cannot
dominate it. Original array index is the final tie-breaker.

Promotion requires a score lead of at least **1.5**, positive evidence of at least
**1.5**, and a substantive candidate that is not flagged as a compound blob.
Insufficient evidence/close scores preserve candidate zero and expose ambiguity.
The exception is a grammar-only/non-definition artifact at index zero: the best
substantive candidate replaces it, but close alternatives still remain ambiguous.
A single substantive candidate needs no competition test.

Confidence is **0 when ambiguous**, otherwise `min(1, scoreMargin / 3)` (1 for a
single candidate). This is a rule-strength indicator, not a calibrated probability
of semantic correctness. Reasons record the applied signals and ambiguity policy.
No new ambiguity message, sense chooser, focus behavior or visible layout is added.

### Real-corpus regressions and limits

- Genesis 14:1 `king`: candidate 1 (Chinese instrument) → candidate 2 (ruler/sovereign),
  using the generic named-role frame.
- Genesis 1:1 `God`: candidate 1 (obsolete adjective) → candidate 3 (existing noun),
  using lexical context overlap and weak capitalization evidence.
- John 1:1 `word`: candidate 1 retained with ambiguity; the long contaminated
  compound candidate is not promoted. The theological text remains inside its
  existing compound entry and is not rewritten/extracted by this phase.
- `beginning`: the sensible first candidate remains selected.

Tests use real deployed candidates, contrasting local contexts, obsolete senses,
artifacts, blank POS, ties, quotations, untouched arrays/text, exact/possessive
lookup, shard reuse, browser panel behavior and existing original-language tests.
Generic role frames can mistake capitalized things/places for people; suffix
folding can conflate words; obsolete-label penalties can be inappropriate for old
translations; unquoted examples inside an opening sentence can still add noise.
Sparse context and missing English/original-language alignment remain limitations.
Future work should evaluate false positives and restore corpus sense boundaries
with provenance before broadening these signals. No corpus regeneration occurs here.

## Interaction-loaded runtime (shell 26)

The six classic Word Study scripts previously loaded from the homepage before
DOMContentLoaded. The homepage now loads only the small same-origin
`js/word-study/loader.js`; Reader, Search, Compare, Plans and Saved Verses work
without any Word Study runtime globals. Focus alone does not start readiness.
Click, touch-generated click, Enter or Space on a Reader word starts one shared
readiness promise. The exact dependency order is provider, original-language
provider, local provider, sense selector, dictionary provider, then controller.
Each script must expose its required methods before the next is requested.

The loader owns delegated Reader activation and the existing Close/Escape
controls. The controller initializes its original-token handler once and exposes
`openFromWord(word, context, isCurrent)` for explicit replay without synthetic
clicks. English and verse-level original-language lookups still start in parallel;
there is no new Original Language tab or delayed activation requirement.
Provider code, ranking, inflections, fallback definitions and JSON are unchanged.

The loader captures a frozen verse/word context plus an activation generation.
Only the latest still-connected, context-matching word can replay. Rerender,
chapter navigation, translation intent and dismissal invalidate pending work.
Leaving Reader cancels pending runtime activation; already-loaded panel content
retains its existing Reader-return lifecycle. Invalidations also reach a loaded
controller, whose request IDs and current-context guard reject stale callbacks.

Runtime loading and failure use the existing panel, definition and polite status
DOM. Close and Escape remain available before the controller exists and restore
focus only to a connected activating word. Readiness cannot reopen a dismissed
panel. A small additional controller guard prevents result updates from moving
focus back from Search or another control outside the panel. Sticky Close, panel
markup, CSS, typography and colors are unchanged.

Failed scripts or missing globals reject readiness and remove the failed script.
A later word activation retries while reusing validated dependencies. This does
not change failed-JSON promise memoization: reconnecting may still require a
reload before a previously failed shard can be requested again.

Reader tokenization uses the loader's eager normalization helper, which is
verified against the unchanged standalone provider for punctuation, Unicode,
apostrophes and all ASCII characters. After readiness the provider shares that
same function, so page tokenization and lookup use one canonical implementation.
Programmatic provider callers explicitly await `WordStudyLoader.ensure()`.

All six runtimes remain in SHELL_ASSETS, with the loader added, and the shell
version changes once from 25 to 26. This optimizes document startup and execution,
not shell installation traffic. On a controlled offline reload, first word
activation loads the runtime from shell cache even if Word Study was never used.
Dictionary/original-language JSON remains outside Cache Storage. Successful data
can be reused from in-memory shard promises in the same page; an offline reload
can lose it and fall back to local notes. There is no new durable JSON caching.

Loading uses fixed same-origin external classic-script URLs and the current
`script-src 'self'` policy. No inline script, eval, module conversion, new origin
or _headers change is required.

### Measurements

The Windows checkout's eager application references drop from 24 to 19 and
299,528 to 268,431 JavaScript bytes (31,097 bytes, 10.38%). The loader is 7,498
bytes. Gross deferred baseline runtime is 38,607 checkout / 37,633 LF bytes;
subtracting the loader gives 31,109 checkout bytes before the 12-byte net Reader
integration increase. LF-normalized eager JavaScript totals 260,788 bytes after
the change, versus 290,914 before. These count application scripts, excluding
Cloudflare-injected analytics and service-worker precache requests.

A local uncompressed HTTP measurement serving baseline and current files with
the same LF normalization recorded 298,114 → 266,488 transfer bytes and
290,914 → 260,788 decoded JavaScript bytes, with service workers blocked.
That is 31,626 transfer / 30,126 decoded bytes in this measured context.
In the focused and full runs, first-use readiness measured 15.6–26.7 ms from
the installed shell and 15.9–18.1 ms from the local network. These are desktop
local observations, not mobile/CDN latency predictions.

The shell remains complete and grows from 40 / 446,323 checkout bytes to
41 / 452,280 bytes. New production compressed transfer, Lighthouse and real-device
results require a hosted preview; no score improvement is claimed. The focused
loader tests print measured local uncompressed before/after transfer/decoded
totals and first-use readiness latency for both a shell hit and local network.

`tests/word-study-loader.spec.js` covers initial independence, exact loading
order, normalization parity, click/touch/keyboard, deduplication, every script's
failure and missing-global retry, partial reuse, latest activation, cancellation,
focus, parallel lookups, English/Hebrew/Aramaic/Greek, sticky Close and cold/warm
offline behavior. Existing provider-level browser tests explicitly await optional
runtime readiness rather than assuming startup globals.

An already-controlling older worker can continue serving older cached runtime
files until its waiting update is accepted. The new loader validates the explicit
controller API and fails accessibly rather than replaying against an incompatible
controller. Hosted acceptance must include update acceptance/reload, as well as
fresh-context, real-device and cold/warm offline checks before release.
