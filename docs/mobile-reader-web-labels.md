# Mobile WEB Reader labels

Baseline: `de16c05e8f330202e15168b693d7c8fb929b1af1` on
`feature/mobile-reader-compact-controls`. The approved `781ebf5f` preview's Reader
and companion CSS match that baseline after LF normalization.

`renderPassage()` renders the chapter's `subtitle` and `title` as separate blocks.
All 1,189 imported WEB chapters contain the same pair: “World English Bible
Protestant Edition” and “World English Bible”. The subtitle reserves 22px below its
line box; the caption reserves another 20px. The Book/Chapter heading is separate.

The renderer now marks only these exact WEB metadata labels with
`reader-web-edition-label`. The existing mobile breakpoint (620px and below)
applies the site's screen-reader-only styling pattern: absolute positioning,
clipping and a 1px box outside document flow. Labels remain in the accessibility
tree. No empty label margins remain in the reading layout. Desktop retains its
original static positioning, fonts, colors and margins.

Exact metadata matching protects meaningful subtitles. A caption with a canon
notice is never marked redundant. Other editions, including DRA Catholic, keep
their visible metadata. The translation control and its full picker names,
selection state and nine choices remain unchanged. Compare, Search and shared
canon/translation data are untouched. No Scripture data is regenerated.

Measured at 320, 360, 390 and 430px in both themes:

| Reader mode | Heading-to-first-verse gap before | Gap after | Reclaimed space |
| --- | ---: | ---: | ---: |
| Normal | 104.78125px | 11px | 93.78125px |
| Fullscreen | 110px | 12px | 98px |

The regression compares the compact layout with the original styling on the same
page and verifies that the entire measured label line-box/margin space is
reclaimed. Remaining spacing belongs to the unchanged heading and Scripture line
box. It also checks accessible label text, full WEB picker identity, all nine
editions, DRA notices, meaningful subtitles, the responsive boundary and desktop
spacing.

Only four files change: `js/bible/reader.js`, `css/companion.css`,
`tests/mobile-reader-web-labels.spec.js` and this document. The three-row toolbar,
Options, scroll-to-hide, Show Controls, speech, service worker and asset paths are
unchanged. Installed-user release delivery still needs the separately planned
cache update before production; this local change does not deploy an update.

## Validation

All browser runs used one worker and zero retries, sequentially. Final results:

| Coverage | Unique passes |
| --- | ---: |
| New label/space/accessibility/edition tests | 21 |
| Strict Reader navigation and scroll positions | 18 |
| Compact mobile controls and shared fullscreen | 43 |
| Catholic Compare/Search distinctions | 11 |
| Offline Bible management and PWA | 29 |
| Approved native/cloud Android speech isolation | 4 |
| Startup JavaScript budget | 1 |
| **Total** | **127** |

Zero remaining failures, skips or automatic retries. A test fixture initially
attempted to overwrite a frozen canon API; it now supplies an isolated copy and
retains the exact canon-notice visibility assertion. No existing test expectations
were changed. The ignored `playwright-report/mobile-web-labels-summary.json`
reconciles every identity without double-counting reruns.

Asset validation, explicit changed/new JavaScript syntax checks, all 66 Isaiah
hashes/byte counts and `git diff --check` pass. Shell 52 retains the same 49 assets;
Bible data, manifests and CSP are unchanged. Startup remains 22 scripts with
**270,842 decoded bytes**, leaving **20,072 bytes** below the unchanged
290,914-byte limit. The eager JavaScript increase is 327 bytes. Word Study network
readiness measured 17.8ms in one run; this is not a comparative latency benchmark.
