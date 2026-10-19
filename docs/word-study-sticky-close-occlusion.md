# Word Study Close-header occlusion

Baseline: main at `06242babedb76ae8c4fa3c06598300ced71591ec`.

## Confirmed cause

Live desktop John 1:1 Greek had a word button at 250.09375–283.09375px,
fully covered by the sticky header at 240–293px (33px overlap). At 320px
fullscreen, Isaiah 64:1 Hebrew had a button at 119.375–163.375px beneath
the header at 115–168px (44px overlap). These buttons were inside the readable
Reader viewport, not legitimately scrolled above the Reader toolbar. Center hit
tests returned wordStudyWord or wordStudyClose instead of the word buttons.
The verse context was already static; the retained sticky Close header was the
remaining overlay. Document scrolling and fullscreen Reader scrolling both
reproduced it. Local baseline regressions separately reproduced both failures.

The old scroll tests placed rows below the entire Word Study header before
checking visibility. They therefore never checked the problematic band and
could pass while the production defect remained. New measurements use the
Reader/site chrome as the readable boundary and explicitly place every row in
the former header band before focus or pointer activation can repair scrolling.

## Fix and Close-access trade-off

The header now remains in normal flow with the context, original words and
definitions. No overlay, extra padding, fixed content height, hidden overflow or
new scrolling container is introduced. Typography, colors, Scripture, Hebrew/
Greek line height, wrapping and 44px touch targets are unchanged. The existing
document/fullscreen scroll-anchoring protection remains active while study is open.

Close remains the same native 44px-minimum button at the same location and in the
same keyboard order, but it no longer stays onscreen during long scrolling.
Pointer/touch users can scroll back to it. Tab/Shift+Tab focus exposes the entire
button and focus ring below the Reader chrome. Escape closes from anywhere in
the study panel and restores the activating Scripture word. No duplicate or
floating Close control is added. Normal viewport clipping above the actual
Reader toolbar is distinct from a Word Study header covering readable words.

A strict Close-focus test exposed fractional scroll rounding: the 2px outline
plus 3px offset needed 5px clearance, but Chromium produced only 4.5625px after
the requested fractional correction. Corrective scrolling now rounds outward
(floor for upward movement, ceil for downward movement) so integer scroll-position
rounding cannot undershoot the existing clearance. No padding or extra clearance
constant is introduced, and the computed full-outline assertion remains strict.

Obsolete header unpinning, height observation and injected context-inset logic
are removed from the controller. Panel-local header/context inset variables are
zero so the shared Reader's header measurement cannot reserve a phantom inset.
The existing focus-visibility and async request guards remain. Optional alignment
loading, verified-only alignment, DRA lookup and Bible data are unchanged.

Shell cache 43 refreshes CSS/controller bytes without changing shell membership
or Bible-cache protocols. Its seven existing cache-consumer tests follow the bump;
warm offline Word Study additionally checks hit targets in the former header band.

## Assertions and scope

The old sticky-Close tests required the header to remain pinned during scrolling.
That expectation conflicts with removing its overlay and is intentionally replaced
by exact natural-flow movement, the same single Close control, full computed
focus-ring clearance, pointer/touch closure, Escape and focus-return checks.
320px fullscreen is added. Reduced motion uses the browser context option rather
than the unsupported top-level fixture; no sleeps or relaxed overlap tolerances
are added. Unfocused-row tests check center/corner hits, zero geometric header
overlap and real pointer activation across Greek, Hebrew and DRA rows at desktop,
320px and 390px, normal and fullscreen.

The runtime-loading tests also previously required position sticky. Before changing
that obsolete assertion, a stalled-script diagnostic confirmed Close was already
fully visible and hittable at 390px and 320px while WordStudyController was still
undefined. The tests now require normal flow plus full computed focus-ring and
viewport clearance, retaining the Escape/cancel/late-readiness assertions. The
Close-access matrix also checks pointer-only scroll-back and Shift+Tab followed
by Enter, so access is not established solely by programmatically focusing Close.

No Bible data, publication/translation manifests, CSP, Cloudflare settings or
deployment configuration is changed. The separately documented Cloudflare inline
bootstrap CSP violation remains out of scope and unresolved. No commit, push,
merge, deployment or PR is part of this work.

## Files and final validation

Working branch: `fix/word-study-sticky-close-occlusion`; HEAD remains the baseline
above. The 14 intended files are 13 modified files and one new document:

- `css/companion.css`
- `js/word-study/controller.js`
- `sw.js`
- `docs/word-study-alignment.md`
- `docs/word-study-sticky-close-occlusion.md` (new)
- `tests/word-study-scroll.spec.js`
- `tests/word-study-sticky-close.spec.js`
- `tests/word-study-loader.spec.js`
- `tests/auth-loader.spec.js`
- `tests/auth-vendor-cache.spec.js`
- `tests/compare-loader.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/pwa.spec.js`
- `tests/reader-empty-verse.spec.js`

Every file ran separately and sequentially with one browser worker, zero retries
and bounded timeouts. Final complete runs, without counting diagnostic reruns:

| Test file | Passed | Failed |
| --- | ---: | ---: |
| word-study-scroll.spec.js | 24 | 0 |
| word-study-sticky-close.spec.js | 54 | 0 |
| word-study-compact.spec.js | 49 | 0 |
| word-study-verse-context.spec.js | 10 | 0 |
| word-study-alignment.unit.js | 23 | 0 |
| word-study-reference-mapping.unit.js | 48 | 0 |
| isaiah-original-language-data.unit.js | 6 | 0 |
| word-study-alignment.spec.js | 34 | 0 |
| word-study-dra.spec.js | 15 | 0 |
| word-study-loader.spec.js | 43 | 0 |
| auth-loader.spec.js | 20 | 0 |
| auth-vendor-cache.spec.js | 38 | 0 |
| compare-loader.spec.js | 32 | 0 |
| offline-translation-management.spec.js | 12 | 0 |
| pwa.spec.js | 17 | 0 |
| reader-empty-verse.spec.js | 20 | 0 |
| csp-styles.spec.js | 5 | 0 |
| security-headers.spec.js | 3 | 0 |
| csp-report-only.spec.js (enforcing policy) | 8 | 0 |
| Total | 461 | 0 |

There were 77 unit and 384 browser passes, with no final skips or flakes.
The Isaiah regeneration case was deliberately excluded; no data was generated.
The 24 scroll cases produced 280 measurements with zero Word Study header overlap,
successful corner hits for all visible buttons and no horizontal overflow. All
336 actual pointer activations passed, including Greek, Hebrew and DRA words
inside the former header band at 1280px, 390px and 320px, normal and fullscreen.

| Case | Word button before and after | Header before | Header after | Overlap before / after | Center hit before / after |
| --- | --- | --- | --- | --- | --- |
| Desktop John 1:1 | 250.09375–283.09375px | 240–293px | 52.5625–105.5625px | 33px / 0px | false / true |
| 320px fullscreen Isaiah 64:1 | 119.375–163.375px | 115–168px | -141–-88px | 44px / 0px | false / true |

The word positions were not padded away from the failing band. The header now
scrolls above that band naturally. The minimum measured top clearance in the
36 logged Close-focus samples was 5.5625px, exceeding the 5px outline extent;
all center hits passed. Additional pointer-return and reverse-Tab cases passed.
Delayed long definitions preserve exact page/Reader offsets and focus. The compact
matrix preserves equivalent-reflow checks; it is not native zoom certification.

All 66 Isaiah raw hashes and byte counts match the publication manifest, and every
shard and the manifest are byte-identical to HEAD. Git reports no Bible data,
manifest, js/bible or _headers changes. Asset validation passed (34 references,
21 referenced JavaScript files, three icons/service worker, nine translations).
Separate syntax checks passed for all 11 changed JavaScript files, and git diff
--check passed with only Git's future LF-to-CRLF warnings.

Diagnostic failures are retained: both baseline header-band tests failed as
expected; the first Close-access run exposed fractional focus-ring clipping; the
first loader run stopped at its obsolete position-sticky expectation after 36
passes. Each was investigated before continuing. The production focus correction
was fixed rather than relaxing its computed outline check. Full logs, JSON,
geometry and screenshots are ignored under `test-results/close-occlusion/`, with
baseline red logs at `test-results/close-occlusion-before-desktop.log` and
`test-results/close-occlusion-before-mobile.log`. Production-before screenshots
are outside the repository under the task's visualization directory.

The fix remains local and unstaged for review. Production and the known CSP issue
are unchanged. No commit, push, merge, deployment, PR or Cloudflare change occurred.
