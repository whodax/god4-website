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

## Initial Reader/Plan validation

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

The initial Reader/Plan change covered navigation logic, its focused regression
file, the existing offline Plan-return test and this document. The older test selected the now
hidden native translation control at mobile width; it now uses the existing
mobile picker. Its ASV placement assertion follows the heading directly because
ASV has no optional subtitle. The return-button identity and visibility checks
remain, with an additional assertion that the caption element follows the row
(ASV's caption is empty, so structural presence rather than visible dimensions is
appropriate). No production translation or rendering change was needed.

Fonts, colors, CSS, Bible data and manifests are unchanged. The initial review
commit kept cache 44; the approved P1 follow-up advances only the shell cache name
to 45 and updates its test consumers. The exact 47-asset list, Bible-cache protocol,
vendor migration, saved data, registration and activation implementation remain
unchanged. No cache-busting query parameters or forced activation are introduced.

## Approved installed-user delivery: cache 44 to 45

Reader JS is already precached and served cache-first. Changing Reader bytes alone
does not refresh an installed cache-44 client. The cache-name change alters worker
bytes and causes the existing installation flow to acquire the complete shell in
cache 45. The old worker continues serving cache 44 while the new worker waits.
Only visitor acceptance activates the waiting update and reloads the accepting
tab. Existing activation cleanup then retires superseded shell caches without
clearing retained Bible data or saved verses.

`tests/mobile-translation-upgrade.spec.js` retains 43-to-current coverage and adds
44-to-45 coverage using the actual deployed cache-44 worker and Reader from main
commit `301b36f3b2bed4fdac5eadf5bde231a42b0c454b`. The Git object must be available
to the test fixture. Desktop 1280px and mobile 320px/390px checks verify:

- Exact old Reader/CSS/app response hashes remain before acceptance, including
  after an online reload while the new worker is waiting.
- The cache-44 Reader reproduces the hidden Plan heading; after acceptance the
  new Reader's exact response hash matches the reviewed source and Plan is visible.
- The 47 cache URLs, including existing query strings, are unchanged.
- Retained WEB/DRA revisions, saved verses, selected translation and vendor cache
  survive. The new Reader and Plan correction work after an offline reload, and
  both translations remain selectable using the appropriate desktop/mobile UI.
- Another tab is not automatically reloaded and safely receives new assets after
  activation and normal reload.
- A failed Reader installation leaves cache 44 active and usable offline. Retrying
  successfully offers the normal accepted update without data loss.

Strict worker-source guards allow only the cache-name change relative to cache
44. Source-only equivalence checks normalize Git/Windows LF/CRLF differences;
installed/new HTTP-response hash checks still compare exact bytes. The initial
expanded fixture exposed that line-ending distinction and a desktop test using
the mobile control; both fixture assumptions were corrected without production
behavior changes. Deployment and merging still require approval.

## Cache-45 follow-up validation

Final runs used separate sequential Playwright invocations, one worker and zero
retries. No final failures, skips or flakes remained:

| File | Passed |
| --- | ---: |
| mobile-translation-upgrade.spec.js | 9 |
| word-study-loader.spec.js | 43 |
| plan-tab-scroll.spec.js | 12 |
| pwa.spec.js | 17 |
| auth-loader.spec.js | 20 |
| auth-vendor-cache.spec.js | 38 |
| compare-loader.spec.js | 32 |
| offline-translation-management.spec.js | 12 |
| reader-empty-verse.spec.js | 20 |
| mobile-translation-picker.spec.js | 32 |
| plans-readiness.spec.js | 18 |
| plans-focus-visibility.spec.js | 18 |
| offline-plan-back-pointer.spec.js | 36 |
| reading-journey.spec.js | 26 |
| shared-reader-fullscreen.spec.js | 22 |
| Total | 355 |

The original eager-JavaScript assertion remains unchanged: 290,529 decoded
LF-normalized bytes against 290,914 historical bytes, leaving 385 bytes of
headroom with 21 eager scripts. Asset validation, syntax checks for all 12
changed/new PR JavaScript files, all 66 Isaiah hashes/byte counts and unchanged
manifest/shards, exact 47-asset membership, and git diff --check passed. The
production worker differs from cache 44 only in the shell cache version.
