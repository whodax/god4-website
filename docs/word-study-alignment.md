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
alignment asset prevents installation. The KJV-only correction requires no eager
script changes or budget increases. Physical device/screen-reader acceptance remains separate from
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
That historical result is not a green release; the Reader follow-up below records
the investigation and the remaining validation blocker.
The initial monolithic run was safely interrupted at 501MiB available RAM after
50 passes; all registered identities were subsequently checked exactly once in
the completed batch inventory, without skips or automatic retries.

### Native Chapter fallback follow-up

The chapter-start helper originally skipped a measured -0.484375px correction.
An outstanding smooth verse-navigation scroll subsequently moved the viewport;
the heading ended 11.484375px above its required sticky boundary. Merely removing
the early return, cancelling at the current position before/after rendering, or
rounding the correction does not reliably retire that later browser update.
Rounding changed a remaining failure to 10.484375px, demonstrating that the
synchronous correction ran but was subsequently invalidated. Passive records
show fonts already loaded and stable final navigation/toolbar geometry; disabling
scroll anchoring did not eliminate the failure. Native Chapter focus is not
required to reproduce the outstanding-animation problem.

Reader positioning now applies its instant correction immediately and revalidates
once at the next rendering frame. The callback is discarded if its heading was
replaced, Reader is no longer active, a verse was selected, or the scroll surface
changed between normal/fullscreen modes. No timer, animation, focus change,
arbitrary spacing or tolerance increase is introduced. Temporary function/scroll
wrappers are removed from the original fallback regression. Cache 50 and its 49
assets remain unchanged; upgrade source-equivalence checks now explicitly include
the changed Reader asset without altering raw-byte delivery assertions.

#### Interrupted checkpoint

The original uninstrumented 320px Dark case passed 100/100 in five sequential
20-case batches, one worker and zero retries. An earlier 100-repeat attempt
completed 59 passes before a physical-memory safety stop. The new 38-case matrix
covers fractional/exact alignment, both scroll surfaces, anchoring, native focus
and superseded navigation. Ten cases completed before a second memory stop;
a five-case restart completed four passes and then crashed creating a page during
critical memory pressure. These partial attempts are not full-suite success.

At that checkpoint, unit/integrity checks passed 35/35, including all 66 Isaiah hashes and all 87 protected
shards; assets and syntax passed. Static canonical-LF eager JavaScript was 290,717
bytes versus the unchanged 290,914-byte limit (197-byte margin). Browser performance,
the remaining matrix, affected Reader/offline suites and the complete 1,655-case
inventory remained pending. Available physical RAM reached 371MiB despite about
9.83GiB commit headroom; only owned test processes were stopped. Release was
NO-GO pending memory-safe browser validation.

#### Memory-safe completion

Expanded coverage exposed a real completion-contract regression: a caller awaiting
`navigateReaderToPassage()` could deliberately scroll before the pending chapter
correction finished, then lose its position. Whole-chapter navigation now resolves
after that rendering frame; selected-verse and failed-navigation results retain
their existing behavior. Four unchanged fullscreen anchor tests reproduced this
and pass after the correction. No geometry assertion was loosened.

The new supersession fixtures now dispatch the real native Verse change event
(which requests focus) and select the actual Plan tab, rather than assuming a
focus-default API or a nonexistent Search tab. Their initial runs failed four,
then two cases before correction. A separate Isaiah 40:31 test captured a loading
placeholder instead of the completed English definition. It now awaits the
existing terminal lookup state before its unchanged exact preservation assertion.
The initial 10-pass/1-fail Isaiah report is retained separately from its corrected
11/11 result. No application dictionary behavior or Bible data changed.

Final Playwright coverage passes all **1,655 distinct identities**, with zero
failures, skips, flakes, automatic retries, duplicates or missing identities,
across 113 sequential batches of at most 20 cases. This includes the complete
38-case scroll matrix, Whole Chapter 14, Reader navigation 18, shell upgrades 34,
PWA 17 and offline translation management 12. Earlier failed/interrupted attempts
are preserved and are not counted as successful final coverage.

Assets, syntax, 35 unit/integrity checks, all 66 Isaiah hashes and all 87 protected
shards pass. Shell 50 keeps the same 49 assets, accepted-update activation,
verified critical cached-asset SHA-256 bytes, offline WEB/DRA and saved data.
Browser-measured canonical-LF eager JavaScript is **290,882 / 290,914 bytes**:
the unchanged budget passes with only **32 bytes** of headroom.

The completed inventory recorded a minimum 1,451MiB available physical RAM and
16.89GiB commit headroom, with no browser crashes or memory-safety stops. Both PRs
remain draft/unmerged, and all local changes remain uncommitted. Automated gates
are GO for owner review, not authorization to merge or deploy. Physical Android
and screen-reader acceptance remains device-only; the narrow eager-script margin
requires continued strict enforcement.

No Bible text, original-language shards, manifests, numbering or source provenance
is regenerated or modified. The original layout/controller release used
`compact-reader-43`; the KJV source-offset correction uses `compact-reader-50`
as described above, retaining the alignment module for offline use.
