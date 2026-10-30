# Header navigation menu and Shell 54 compatibility

Branch: `feature/header-navigation-menu`.
Header implementation baseline: `0011bfe0e5d066601848390f53c8a6b8731595a0`.
Installed production Shell 53 fixture: `5e98b32eddfeaeac6f90beb3a247044b2d610127`.

## Exactly 15 approved destinations

The owner clarified that there are **15**, not 16, destinations. Close is a
navigation-panel control, not a feature. Bible Resources is already included.
No feature is added or duplicated to inflate this count.

* **Read & Study (5):** Bible Reader, Compare Translations, Reading Plan,
  Search Scripture, Word Study.
* **My Bible (3):** Saved Verses, Offline Bibles, Choose Translation.
* **Preferences & Account (5):** Read Aloud, Voice Commands,
  Voice & Reading Speed, Light / Dark Theme, Account.
* **Explore (2):** Featured Verse, Bible Resources.

The reusable, declarative configuration now lives in the inert
`#headerMenuTemplate` in `index.html`: grouped sections, labels and stable
`data-destination` action keys. The app clones it once, on first open, and
delegates clicks to existing feature handlers. This removes unnecessary startup
JavaScript for constructing static markup. No new asset or eager script is added.

## Confirmed mixed-version defect and correction

Shell 53 serves navigation HTML network-first and shell CSS/JavaScript
cache-first. New HTML could therefore expose a Menu button with no handler in
cached production JavaScript. The assessment reproduced zero dialogs after a
click, with `aria-expanded="false"`, both with an unchanged worker and with a
version-only Shell 54 update waiting for acceptance.

New HTML now renders a real **Read** link (`#headerMenuFallback`) to the existing
Scripture Companion section. It uses existing button styling and an accessible
name of "Open Bible Reader". The enhanced Menu button starts hidden.
Cached Shell 53 code can use the link through its existing anchor initializer;
it need not understand any new menu implementation.

New app code enables Menu only when the HTML template and fallback exist,
modal dialogs are supported, and the matching components stylesheet advertises
its compatibility marker at the end of the stylesheet. A truncated stylesheet
without that marker retains Read. Its handler is attached before Menu is revealed.
Missing/old CSS retains the native link. A successful stylesheet load/retry can
enable the enhanced menu once; duplicate initialization is guarded. Focus on
Read transfers to Menu during enhancement; other focus is left untouched. Old production
HTML remains usable with new JavaScript because absence of the new markup
leaves its original links untouched. No forced activation or extra runtime is
used to bypass the installed user's update choice.

The link and Menu occupy the existing brand row. The grouped dialog overlays
Scripture without reflow, uses existing cream/navy/gold and Blue Dark tokens,
and scrolls within the viewport. Menu controls have 44 by 44 CSS pixel minimum
targets. Tab wrapping reveals the focused control; Escape, Close and backdrop
dismissal return focus to Menu. Backdrop wheel/touch scrolling is contained.
An already-open Saved tray is dismissed through its existing toggle to avoid
competing focus traps; saved entries remain untouched.

## Existing feature behavior

Reader/Compare/Plan reuse their existing view handlers and loaders. Reader menu
returns reuse its saved scroll cursor. Search preserves its input. Word Study
focuses a studyable word in the current selected/spoken verse or passage; it
never changes Scripture, opens an unrelated dictionary or infers alignments.
Audio destinations reveal/focus existing controls without starting speech or
listening. Voice/speed settings stay unchanged. Options and automatic
scroll-to-hide/Show Controls remain independent.

Saved, Offline, Account and theme actions use their existing handlers. Translation
selection uses the existing mobile picker or desktop selector. All nine editions
remain available, including CTH Catholic (internal ID `dra`). Bible Resources
focuses the real `#resources` section. Existing unavailable footer features are
still labeled honestly; no destination or implementation is invented.

## Shell 53 to 54 release contract

Only `SHELL_CACHE` advances from `compact-reader-53` to `compact-reader-54`.
All 49 precached paths are preserved. `PREVIOUS_SHELL_CACHE` stays at 24 for
legacy vendor migration. Installation, cleanup, translation-cache protocols and
user-controlled `ACTIVATE_UPDATE` behavior are unchanged. There is no install-time
skipWaiting, forced reload loop, automatic tab close or new clients.claim policy.
Bible caches, Saved Verses, plan progress, theme and voice settings remain protected.

Before acceptance, an installed Shell 53 tab may receive new HTML but continues
using its old shell: Read remains functional and the enhanced Menu stays hidden.
The waiting Shell 54 cache holds the complete new assets. After explicit
acceptance and the existing reload, matching new CSS/app code enable Menu.
Offline relaunch serves its cached HTML, template, CSS and app. Failed or
interrupted installation must leave no responses in the failed new shell and
preserve the old working shell; retry follows the same acceptance process.

Historical fixtures for shells 43 through 52 retain their original commits.
Shell 53 is added from the actual production commit. Current-release source
contracts move to Shell 54, retaining exact byte/hash checks for all 49 assets;
only the three reviewed HTML/CSS/app sources differ from the header baseline.
The old frozen-source gate is not bypassed by weakening assertions or repinning
the contents of historical Shell 53 fixtures.

## Validation and remaining device acceptance

Run focused menu, mixed-asset, historical upgrade, PWA/offline, Reader, account,
Compare, Saved and performance regressions sequentially: one worker, zero retries.
Coverage includes normal/fullscreen controls, 320/390/430px and desktop, both
themes, keyboard focus, native fallback, failed/delayed styles, delayed app code,
old HTML/new app, update acceptance, multiple tabs and offline WEB/CTH retention.
Preserve the strict 290,914-byte startup budget and all Isaiah hashes.

The existing Reader scroll-hide fixture was found to issue a synthetic wheel
before prior Options/anchor scroll work had settled. The same failure reproduced
on approved application baseline `0011bfe` on repetition 3. Its scroll helper now
uses the one-animation-frame synchronization already used by the compact Reader
suite. No Reader production code, geometry tolerances, visibility assertions or
hit-target assertions changed. The synchronized baseline passed 50/50 repetitions.

Physical Android/TalkBack and iOS VoiceOver acceptance remains necessary on a
future approved preview. Test browser-controlled momentum scrolling and focus
announcements on actual devices. Automated semantic/focus tests are not a claim
of physical-device acceptance. This milestone is local only: no push, merge or
production deployment is authorized.

## Final local verification

| Focused batch | Unique passing identities |
| --- | ---: |
| Menu, fallback, accessibility and responsive layouts | 62 |
| Historical shells 43–53 upgrading to 54 | 73 |
| PWA, offline management, auth loader/vendor and empty verses | 107 |
| Compare, CTH/Ruth and Word Study | 93 |
| Compact Reader, microphone, recovery, positioning and Plan | 105 |
| Saved Verses and Account | 29 |
| Homepage/header and Reader-state smoke | 7 |
| **Total** | **476** |

There are no remaining failures, skips or automatic retries. The baseline
50/50 and candidate 20/20 diagnostic repetitions are additional repetitions of
one identity and are not added to the unique total. All 73 upgrade identities
were reconciled against Playwright's current test inventory.

Two background-runner interruptions produced no assertion/crash report; their
logs were preserved. Completed pass lines were retained, unfinished cases were
not counted, and the remaining Shell 52/53 cases completed in a bounded batch.
No Windows application crash event was found. Separate elevated monitoring was
avoided while runners were active; later memory checks ran within each runner's
own shell. This is an execution limitation, not a waived application failure.

The browser measured 22 startup scripts and **289,103 canonical LF decoded JS
bytes**, saving **867 bytes** versus the approved header implementation and
leaving **1,811 bytes** below the unchanged 290,914-byte limit. Local Word Study
readiness measured 15.3 ms network-first and 13.5 ms for a shell hit; these are
local measurements, not production latency guarantees.

Asset validation, syntax checks for all modified JavaScript, all 66 Isaiah
SHA-256 hashes/byte lengths and `git diff --check` passed. Bible data, manifests,
security policy, Reader/speech implementations and storage providers are unchanged.
Sampled physical RAM remained at least 2,099 MiB and commit headroom exceeded
18 GiB. Physical Android/TalkBack and VoiceOver acceptance is still outstanding.

## Exact milestone file scope

Runtime and markup:

* `index.html`
* `css/components.css`
* `js/app.js`
* `sw.js`

Documentation: `docs/header-navigation-menu.md`.

Tests:

* `tests/header-navigation-menu.spec.js`
* `tests/mobile-translation-upgrade.spec.js`
* `tests/mobile-reader-reading-controls.spec.js`
* `tests/auth-loader.spec.js`
* `tests/auth-vendor-cache.spec.js`
* `tests/compare-loader.spec.js`
* `tests/offline-translation-management.spec.js`
* `tests/pwa.spec.js`
* `tests/reader-empty-verse.spec.js`
* `tests/ruth-compare-compatibility.spec.js`
* `tests/word-study-loader.spec.js`
