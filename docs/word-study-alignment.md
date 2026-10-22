# Word Study layout and exact alignment

The selected English verse stays in the same Word Study panel. Its reference,
Original Language heading and alignment status share one measured context block.
The Close header remains above that block; original tokens and lexical definitions
flow below it. Both header and context stay in normal flow, so they scroll with
the word rows rather than covering unfocused words. The excerpt remains in the same
panel but is not guaranteed to stay onscreen while later rows are studied.
The existing page or fullscreen Reader remains the sole scrolling surface.

The compact layout keeps the original fonts and colors, with a 16px Scripture
excerpt and 18px Hebrew/Greek chips. The secondary labels are not reduced below
11px. Panel padding is 14px by 16px, and the duplicate separator and 27px gap
between context and chips are replaced by 4px clearance. Wrapped rows use a 4px
gap and a 1.5 line-height to leave room for vowel points and accents. Chips have
32px minimum dimensions for fine pointers and 44px minimum dimensions for touch;
these are minimums, not fixed heights. Definitions and wrapped words remain free
to grow on the normal scroll surface. Tab focus, not only word activation, checks
the complete sticky stack and viewport edges and makes only necessary clearance
adjustments. Delayed definitions do not initiate scrolling. Shell cache 43 carries
these CSS/controller updates; Bible data and manifests are unchanged.
The Close control is not pinned over content. Pointer users can scroll back to
its original position; keyboard focus reveals it below the Reader chrome, with
its full focus ring visible. Escape still closes and restores the activating word.
Only the existing Reader/site chrome reserves sticky clearance; Word Study
header/context inset variables are zero, without extra spacing or nested scrolling.
Compact-layout tests cover 320px, 390px and desktop/fullscreen layouts, as well as
200%-zoom-equivalent reflow at 2x device scale with half-size CSS viewports. This
models text size, pixel scale and available layout space; it does not operate a
browser's native zoom menu. Tests check full focused-button hit areas, keyboard
clearance, text contrast, large targets, text-spacing overrides, long words and
delayed long definitions. They are targeted accessibility checks, not a complete
WCAG conformance audit of the site.

## Available data

The 60,663 retained Genesis, Isaiah, John and Romans token records contain 15
lexical/reference fields. None supplies translation-specific English word spans.
Strong's numbers/definitions and verse-number compatibility do not establish word
alignment. There are **no verified production word alignments** shipped here,
including for DRA. Original-language tokens and lexical definitions remain usable;
the panel explicitly reports that exact word alignment is unavailable.
If the optional alignment module cannot load, English dictionary and verse-level
original-language lookup still work with the same unavailable-alignment notice.
The module is requested once, lazily, without delaying normal Word Study readiness.
Its load attempt has a three-second deadline. Errors, missing APIs and timeout keep
the fallback for the page lifetime; reloading the page permits another attempt.
Removing a timed-out script cannot guarantee cancellation of browser execution,
so any completion after the deadline is ignored by the controller.
Successful loading within the deadline is used on the next word activation, never
to rebuild an already open excerpt, change focus or repeat provider lookups.

## Reviewed alignment contract

`js/word-study/alignment.js` keeps an empty, code-reviewed production catalog.
Future catalog additions require a separately reviewed alignment source, including
title, source reference, revision and reviewer. A `verified` label received from
an arbitrary external source is not sufficient: there is no runtime external
catalog ingestion or inference service.

Entries pin the exact translation ID, canonical Reader book/chapter/verse, complete
English verse text, and every original token's canonical book/chapter/verse, index
and surface. Any mismatch, incomplete provenance, invalid range, non-authoritative
token record, or duplicate matching catalog entry makes alignment unavailable.

Each group contains arrays `english: [{start, end}, ...]` and
`original: [tokenIndex, ...]`. English ranges are half-open UTF-16 offsets into the
exact published verse text; surrogate pairs cannot be split. Multiple English
spans can identify multiple original tokens, including noncontiguous phrases and
overlapping groups. Exact Reader word offsets distinguish repeated occurrences.
Offsets come from DOM ranges only after the complete displayed Reader verse agrees
with its published text. Text drift clears stale offsets and disables alignment.
No matching against definitions, similar text, Strong's numbers or translations
is performed. Unmapped selections remain explicitly unavailable.

Verified groups highlight both the verse excerpt and Reader words, plus all linked
original chips. Enter/Space activate mapped excerpt phrases and original chips;
selection never moves focus automatically. Escape clears highlights, closes the
panel and restores the activating Reader word. Delayed English definitions do not
replace the excerpt or move keyboard focus.
Whitespace-only segments created by overlapping ranges retain their text but are
never keyboard-focusable phrase controls; accessible phrase names are trimmed.

## Verification

`word-study-alignment.unit.js` checks provenance/identity rejection, ambiguity,
range validation and bidirectional many-to-many selection. Browser tests cover
Hebrew, Greek, DRA, no alignment, dictionary-only definitions, keyboard activation,
desktop, mobile, fullscreen and short viewport layouts. Synthetic alignment
fixtures exist only inside tests and explicitly identify themselves as test-only;
they make no linguistic claim and are never published as production mappings.
Layout checks configure reduced motion through browser `contextOptions` and assert
the actual media-query state before navigating. This avoids measuring an active
passage-navigation animation as though Word Study had jumped or overlapped after
navigation settled. Geometry and scroll-offset assertions retain exact bounds;
there are no rounding tolerances or time-based settling sleeps in these checks.

## KJV source offsets and supplied-word typography

KJV keeps imported bracket markers in canonical verse text while the Reader renders
confirmed supplied wording in italics. Offset extraction walks the existing DOM,
reintroducing bracket positions around KJV italic elements only for source-coordinate
verification. The reconstructed text must exactly equal `data-verse-text`; every
word's source slice must also equal its displayed token. Modified wording or missing
italic markers fail closed and clear stale offsets. WEB/DRA text remains exact and
unchanged. Ordinary parentheses and nested literal brackets are not stripped.

These offsets identify English occurrences, not Hebrew/Greek equivalence. The
production alignment catalog remains empty; provenance, exact verse text and token
identity checks still gate any verified mapping. Tests use explicitly synthetic
mapping fixtures only, never inferred definitions or approximate wording.

The KJV correction is stacked on test-only PR #113 so its diff contains the actual
application fix separately. Shell cache 50 delivers the changed precached alignment
runtime after explicit update acceptance. The same 49 assets, translation/vendor
caches, Saved data and activation lifecycle are preserved. Upgrade tests include
production shell 49, exact alignment asset bytes, offline reload and retry when the
alignment asset prevents installation. No eager script changes or budget increases
are required. Physical device/screen-reader acceptance remains separate from
Chromium regression coverage.

Post-release remediation validation: all eight original KJV failures reproduce
before this correction and pass afterwards. The full alignment suite passes 41
cases; installed-user upgrade coverage passes 34. The 23 alignment unit checks,
eight KJV corpus checks and four read-only Isaiah/protected-shard checks pass.
Eager JavaScript remains 290,587 bytes against the unchanged 290,914-byte baseline.

Full Playwright inventory coverage (1,617 cases, one worker, zero retries) completed
in resource-bounded batches: 1,616 passed and one additional native-fallback scroll
case failed. All 25 originally reported failures pass. The remaining 320px Dark
fallback case also failed once in ten unchanged diagnostic repetitions; it is not
silently counted as passing and its geometry tolerance is not relaxed. The KJV
alignment module and service worker are not exercised by that fallback case.
Its scroll/readiness cause remains unresolved and is a release-review blocker.
The initial monolithic run was safely interrupted at 501MiB available RAM after
50 passes; all registered identities were subsequently checked exactly once in
the completed batch inventory, without skips or automatic retries.

No Bible text, original-language shards, manifests, numbering or source provenance
is regenerated or modified. The original layout/controller release used
`compact-reader-43`; the KJV source-offset correction uses `compact-reader-50`
as described above, retaining the alignment module for offline use.
