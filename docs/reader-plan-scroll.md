# Reader and Compare to Plan scroll positioning

## Root cause

Normal Reader, Compare and Plan use the document scroll surface
(`document.scrollingElement`, the HTML element), not `#view-reader.scrollTop`.
Reader uses its own scroll surface only while fullscreen. Its saved verse anchor
is intentionally restored when returning to Reader and must not be cleared when
leaving for Plan.

Switching from a long Reader/Compare passage to the shorter Plan clamps the
document's existing scroll position. The old navigation correction only made the
sticky tab row visible. Because that row was already visible, no correction ran
even though the Plan heading and first day were above the viewport. Scrolling
upward revealed the existing content; no Plan rendering or data failure occurred.

## Narrow fix

After activating Plan and updating the sticky stack, `switchView` measures
`#planHeading` against `readerVisibleTop()` and adjusts `window.scrollBy` with
`behavior: 'instant'`. It changes neither other destination tabs nor Reader's
saved anchor, selected verse, translation or fullscreen restoration. Rounding
the scroll delta downward avoids placing a fraction of the heading underneath
the sticky tabs. No animation, deferred callback, fixed height, extra padding,
new focus target or styling change is introduced.

Existing journey-session returns still choose and reveal the next day using their
existing focus logic. Late Compare readiness is canceled by the existing loader
when leaving its tab; the new regression checks that completion does not move Plan.

## Reproduction and measurements

Before the fix, Reader and Compare to Plan both reproduced at all three widths.
The first baseline used a 900px viewport height. Desktop/mobile final checks use
1280x900, 390x720 and 320x720 respectively. Coordinates are CSS pixels:

| Width | Before: heading top | After: heading top | Sticky lower edge |
| --- | ---: | ---: | ---: |
| 1280 | -348.53125 | 187.46875 | 187 |
| 390 | -378.53125 | 246.46875 | 246 |
| 320 | -625.15625 | 246.84375 | 246 |

After switching, the heading and first day pass pointer hit testing, stay inside
the visible viewport below the sticky tabs, and need no subsequent manual scroll.
The tab retains focus and its selected accessibility state. Touch and keyboard
activation, repeated Reader/Compare/Plan cycles, Reader-anchor restoration and
late Compare completion are covered in `tests/plan-tab-scroll.spec.js`. All 12
focused checks passed; the six pre-fix failures are intentional reproduction
evidence, not failures suppressed by relaxed assertions.

## Final validation

Each Playwright file ran separately and sequentially with one worker and zero
retries. Final complete runs passed without failures, skips or flakes:

| File | Passed |
| --- | ---: |
| plan-tab-scroll.spec.js | 12 |
| word-study-loader.spec.js | 43 |
| plans-readiness.spec.js | 18 |
| plans-focus-visibility.spec.js | 18 |
| offline-plan-back-pointer.spec.js | 36 |
| reading-journey.spec.js | 26 |
| shared-reader-fullscreen.spec.js | 22 |
| compact-reader-controls.spec.js | 12 |
| compare-loader.spec.js | 32 |
| final-reader-hardening.spec.js | 7 |
| pwa.spec.js | 17 |
| mobile-translation-picker.spec.js | 32 |
| Total | 275 |

These totals exclude reproduction runs and diagnostic reruns of the older
offline test. That test initially failed against the hidden native selector;
subsequent diagnostics exposed the optional ASV subtitle and empty caption
assumptions described below. Production code was not changed to accommodate
those assumptions.

The unchanged eager-JavaScript comparison passes at 290,529 decoded LF-normalized
bytes versus the historical 290,914 bytes (385 bytes of headroom; 21 scripts).
Asset validation, syntax checks for all three changed/new JavaScript files, all
66 Isaiah hashes and byte counts, shard equality to HEAD, and git diff --check
passed. The focused screenshots were also inspected at 320px.

## Release scope

Only Reader navigation logic, its focused regression file, the existing offline
Plan-return test and this document are changed. The older test selected the now
hidden native translation control at mobile width; it now uses the existing
mobile picker. Its ASV placement assertion follows the heading directly because
ASV has no optional subtitle. The return-button identity and visibility checks
remain, with an additional assertion that the caption element follows the row
(ASV's caption is empty, so structural presence rather than visible dimensions is
appropriate). No production translation or rendering change was needed.

Fonts, colors, CSS, Bible data, manifests and service worker are unchanged.
The worker still uses cache 44. Before releasing this separate fix to installed
users, include an approved shell-cache update so cache-first Reader assets refresh;
this branch does not silently advance the separately approved cache version.

The smallest proposed production update is a shell-cache version bump from 44 to
45, retaining the exact 47-asset list. Reader JS is already precached and served
cache-first, so changing that file without changing worker bytes does not reliably
refresh an installed user's copy. Preserve installation via the existing complete
shell precache, waiting-worker notification and explicit visitor acceptance before
activation/reload. Existing shell cleanup can retire cache 44 after activation;
Bible translation caches, vendor migration, saved data and registration behavior
must stay unchanged. No cache-busting query parameters or forced activation are
needed.

Before production approval, update the focused cache-version expectations and add
an installed 44-to-45 upgrade case using the actual old Reader asset: verify old
bytes remain before acceptance, new Reader bytes arrive after acceptance, offline
reload works, retained WEB/DRA and saved data survive, another tab remains safe,
and a failed installation leaves cache 44 usable until a successful retry. This
is a release proposal only; `sw.js` remains unchanged at version 44 in this PR.
