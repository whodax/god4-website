# Header navigation menu and Shell 54 compatibility

Branch: `feature/header-navigation-menu`.
Header implementation baseline: `0011bfe0e5d066601848390f53c8a6b8731595a0`.
Installed production Shell 53 fixture: `5e98b32eddfeaeac6f90beb3a247044b2d610127`.

## Exactly 16 approved destinations

The mobile-header revision explicitly splits the previous combined voice/speed
entry into two real destinations. The menu now contains **16** features. Close
is not counted; Bible Resources remains a single real destination.

* **Read & Study (5):** Bible Reader, Compare Translations, Reading Plan,
  Search Scripture, Word Study.
* **My Bible (3):** Saved Verses, Offline Bibles, Choose Translation.
* **Preferences & Account (6):** Read Aloud, Voice Commands,
  Select Reading Voice, Reading Speed, Light / Dark Theme, Account.
* **Explore (2):** Featured Verse, Bible Resources.

The reusable, declarative configuration now lives in the inert
`#headerMenuTemplateV2` in `index.html`: grouped sections, labels and stable
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

The link and Menu share one slot: the desktop brand row or the mobile second
row. The grouped dialog overlays
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
Read Aloud focuses Play without starting narration. Voice Commands focuses the
existing microphone without starting recognition. Options expands only when
the requested control is actually inside it; mobile toolbar controls preserve
its current expanded/collapsed state.
Select Reading Voice and Reading Speed reveal Options and click the existing
mobile/custom or desktop selector to open its existing picker. Choices and
current selections are preserved until the user chooses a different value. Options and automatic
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

## Shell 54 milestone verification at 7d0384e

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

## Centered mobile-header and voice navigation revision at b33d46d

At 620px and narrower, the unchanged cross/heart artwork and GOD4.us name form
one centered first-row brand group. The second row is Theme, Saved, Account,
Menu, in that order. A four-column grid keeps all controls at least 44 by 44px
with no third row at 320/390/430px, in Light and Blue Dark Mode. Existing fonts,
colors, rounded pill styling and desktop placement are preserved. The same Menu
node moves between its desktop brand position and the mobile action group so
keyboard order follows the visible order; focus is retained across breakpoints.

The CSS layout is scoped to the new header markup. The UI compatibility marker
is `header-2`, paired with the versioned `headerMenuTemplateV2` identifier,
independent of the unchanged Shell 54 version. Old preview code cannot enhance
a template containing an unsupported new action. A mixed old app or
stylesheet retains the real Read fallback; old production and previous Shell 54
preview HTML remain usable without errors. The current unmerged release keeps
all 49 precache paths and user-controlled activation. Only exact reviewed
HTML/CSS/app fingerprints in the current Shell 54 contract are refreshed.

The source changes are limited to `index.html`, `css/components.css`, `js/app.js`,
this document, and the related tests in `tests/header-navigation-menu.spec.js`,
`tests/mobile-translation-upgrade.spec.js`, and `tests/god4.spec.js`.


### Verification of the centered-header revision at b33d46d

All runs used one Chromium worker and zero retries, sequentially:

| Batch | Unique passed tests |
| --- | ---: |
| Header layout, menu, direct voice/speed pickers and mixed-version fallback | 77 |
| Historical source contracts and installed Shell 53 upgrade cases | 20 |
| Compact Reader, reading controls, microphone and Reader/Plan scrolling | 105 |
| PWA, offline management, account, Saved Verses and Android speech | 90 |
| Homepage/header smoke and startup performance | 8 |
| **Total** | **300** |

Final runs had no failures, skips, retries or browser crashes. Results and test
identities are recorded locally in `playwright-report/header-row-summary.json`.
Asset validation, JavaScript syntax, all 66 Isaiah chapter hashes and
`git diff --check` passed. Bible data, manifests, service worker, speech and
Reader source are unchanged.

At 320/390/430px in both themes, the brand group measures 160 by 60px and is
centered exactly on the viewport midpoint. All four second-row controls are
44px high with at least 44px width. The header measures 143px high, including
its existing surrounding spacing; there is no third row or horizontal overflow,
including with a three-digit Saved count. Desktop placement is preserved.

Startup remains 22 scripts, totaling **289,704 canonical LF decoded bytes**,
with **1,210 bytes** below the unchanged 290,914-byte limit. Measured local
Word Study first-use network readiness was 16.3ms. Available physical RAM was
at least 1,414MiB in the recorded between-suite samples, with more than 17GiB
of commit headroom. Shell 54 still has the same 49 asset paths.

Physical Android/TalkBack and VoiceOver acceptance of this revision remains
outstanding. This revision is committed locally only; no push or deployment
is authorized.


## Android destination and independent wordmark-centering correction at a276763

Baseline: `b33d46d6fb94a5f6bf86fbb77aebbc584b94e77e`. The menu still
contains exactly 16 destinations in groups of 5/3/6/2.

The prior grid centered the artwork and wordmark together, leaving the text
34px right of the viewport center. The wordmark now defines the centered grid
item. The original 60px cross-heart button is absolutely positioned 8px to its
left on the same line; its artwork, colors and typography are unchanged. The
header remains 143px tall with exactly two rows. Theme, Saved, Account and Menu
remain on the second row, in that order, with 44px minimum targets. Account,
Menu and Browse Resources use the existing primary-button palette, including
the existing Blue Dark surfaces and hover/focus states. Desktop brand placement
is unchanged; the explicitly requested blue button treatment applies there too.

The baseline 320px probe measured the toolbar at 422.94px below a 143px site
header. The menu previously centered an offscreen tab only when the entire
Reader view was offscreen. Initial Reader availability also precedes completion
of the optional compact-control runtime, so positioning before its reparenting
can use obsolete toolbar geometry. Reader and Word Study now await the existing
deduplicated runtime request (with its existing bounded failure/native fallback),
then use existing Reader handlers. For an offscreen Reader, chapter-start or
selected-verse positioning uses the Reader's own scroll helpers. Returning to an
already visible passage preserves its reading cursor. No passage is reloaded or
changed. Layout-frame handoffs are guarded by the menu navigation revision so
superseded actions cannot later steal focus or open a picker.

At 320px, the corrected site navigation ends at 143px, the existing Reader tab
row ends at 196px, and the Reader toolbar starts at 196px. The chapter heading
starts at approximately 313.5px, 16px below the full sticky stack (297px).
No extra preceding Companion heading or blank space is brought into view.

Search previously used `innerHeight` and had no keyboard viewport listener.
The baseline field remained at 395.94–447.94px after the visible height shrank
to 320px. The menu now reveals Search within `visualViewport` bounds and the
sticky site header. Focus-scoped resize/viewport-pan listeners coalesce work
into one animation frame, scroll only when obscured, and are removed on blur.
Targets taller than the available area align at the top instead of alternating
between incompatible top/bottom bounds. There is no timer, smooth animation or
persistent resize loop. Query contents
are retained. Automated reduced-visual-viewport coverage is representative;
actual Android IME panning and TalkBack remain device acceptance items.

Word Study's old `.verse-selected` selector did not match Reader's actual
`.verse-focused` state, so it could focus the chapter's first word instead of a
word in the selected verse. The selector now matches existing Reader state.
The existing visible Reader status provides a concise instruction, also attached
as an accessible description to the focused word. That word has an explicit
focus outline even for programmatic touch navigation. No word is automatically
opened, and Scripture selection and original-language alignment stay unchanged.

Read Aloud and Voice Commands reveal Options, wait one layout frame, then focus
the actual Play/microphone control. They do not start audio or recognition.
Select Reading Voice and Reading Speed open the original respective pickers.
The physical Android focus failure was not reproduced in desktop Chromium;
the cold-runtime and synchronous focus handoffs are now explicitly guarded and
tested, including recovery from a concealed toolbar and failed optional loading.

Shell 54, vendor cache 24, all 49 asset paths, update acceptance, Bible caches
and local data are unchanged. Only the three exact current-shell fingerprints
for HTML/components CSS/app JavaScript change. The Menu trigger intentionally
does not carry `btn-primary` in HTML: old Shell 53 CSS defines that class with
an explicit display value, which overrides the native hidden attribute and
would expose an inert Menu before enhancement. Its blue appearance is applied
only by the matching new stylesheet; historical fallback tests protect this.

Only the existing header module's indentation was compacted to retain startup
headroom. No other startup module or feature was deferred or removed.


The backdrop-dismissal fixture now explicitly awaits
`ReaderTranslationLoader.ensure()` before recording its starting cursor, in
addition to its existing font/layout readiness. Previously it could capture an
intermediate startup layout; one run moved by 2px. The exact equality assertion
is preserved, and the corrected fixture passed ten consecutive repetitions
with one worker and zero retries. No scroll assertion or performance limit was
relaxed.


### Final Android-header correction validation

All browser batches ran sequentially, with one worker and zero retries:

| Gate | Unique passes |
| --- | ---: |
| Header/menu and new Android destination cases | 97 |
| Compact Reader, recovery, microphone, Reader/Plan scrolling | 105 |
| Native/cloud Android speech | 32 |
| Historical contracts and installed Shell 53-to-54 upgrades | 20 |
| PWA, offline Bible management and Saved Verses | 42 |
| Homepage/header/Reader/search smoke and browser performance | 8 |
| **Total** | **304** |

The 20 new destination cases were also run in the Reader batch; they are counted
once above. The backdrop-dismissal case additionally passed 10/10 repetitions.
Final gates have zero failures, skips or retries. Earlier development failures
were investigated, including the test-startup readiness issue; no assertions were
loosened. There were no browser crashes. Local identity/count evidence is in
`playwright-report/header-android-summary.json`; screenshots are in
`playwright-report/header-android-release-artifacts`.

Browser performance measured **22 startup scripts, 290,517 canonical decoded
bytes**, leaving **397 bytes** below the unchanged 290,914-byte limit. No extra
startup script was introduced. Local Word Study first-use network readiness was
17.4ms. The small remaining startup margin is a maintenance constraint.

Asset validation, JavaScript syntax, all 66 canonical Isaiah hashes/sizes and
`git diff --check` passed. The service worker, manifests, security policy, Bible
and Reader/speech/storage source files remain unchanged. Recorded between-suite
physical availability was at least 2,456MiB with at least 18.27GiB commit
headroom; no memory guard was triggered.

Physical Android keyboard/viewport, TalkBack and touch acceptance of this new
revision remain outstanding. This is a local commit only; no push, merge or
production deployment is authorized.


## Destination visibility ownership and Reader Options correction

Baseline: `a276763848b75e7d7f4eba961a1b96bd2cf6519e`.

### Reproduced failure and complete handoff

The first touch-driven idle probes finished with the requested DOM control
focused, although the controls could sit near the viewport bottom. These did
not reproduce a literal Options-focused DOM state. The investigation does not
attribute the owner's report to TalkBack.

Both active-narration probes failed after native dialog close, animations and
queued layout completed. They ended with `headerMenuTrigger` focused, the
Reader toolbar inert/hidden, Options expanded, and narration still playing.
Opening the modal temporarily exposed the toolbar through the visibility
controller's modal guard. Closing it removed that guard without recording an
intentional control-reveal request. Playback could conceal the toolbar again;
`getClientRects()` still returned rectangles for its visibility-hidden children,
so the menu's subsequent focus call could not focus an inert descendant.
The previous tests largely covered idle playback and intermediate focus calls.

The corrected sequence is:

1. Resolve the existing Bible and optional control loaders, preserving their
   request deduplication and existing failure/native fallback.
2. Close the menu and await its actual native `close` event. Cancellation and
   reopening invalidate the old request; no arbitrary timer or extra focus
   retry is used. Manual Escape/Close/backdrop still return focus to Menu.
3. Activate Reader through existing navigation, without changing its passage.
4. Tell `ReaderReadingControls.reveal()` to restore visibility and clear stale
   reading-gesture intent. This is an explicit request owned by the existing
   visibility controller, rather than a synthetic click on Show Controls.
5. Resolve the actual target. Expand Options only if the target is a descendant
   of Options. Mobile Play, microphone, voice and speed are already outside it.
   Desktop/native microphone or settings inside Options still reveal it.
6. The same controller positions an offscreen target through existing Reader
   chapter/verse scroll helpers, focuses it, and records the current scope and
   scroll cursor. Active/preparing narration keeps intentional access until a
   new reading gesture; idle navigation does not suppress a subsequent playback
   auto-hide. Manual Show Controls recovery preserves its existing behavior.

The two original active-narration reproductions then finished with Play or the
microphone focused, the toolbar visible/non-inert, Options collapsed, and
narration still playing. Focus alone neither invokes synthesis nor recognition.
No observer continuously refocuses controls. Options state remains independent
of scrolling/recovery and is retained if already expanded.

### Necessary Stop function and mobile layout

The Stop button is **not redundant**. The compact primary button intercepts
playing/paused clicks to Pause/Resume and stops propagation before the core
Stop handler. It can Stop during preparation, but that is not a replacement
for Stop during normal playback. Removing the separate mobile Stop would remove
a necessary touch/keyboard Stop action. It is therefore retained, with its
existing handler and accessible name. Desktop playback controls are unchanged.

Mobile Options now places Save Verse and Fullscreen side by side on row 2,
under detailed Book/Chapter/Verse navigation. The necessary Stop spans row 3.
All buttons retain a 44px minimum target. The older Options-layout test expected
the microphone inside Options; it now checks the actual Save/Fullscreen/Stop
rows while microphone coverage retains the single existing toolbar control.
Saved and Account labels are centered in both axes without changing their
handlers, palette, wordmark, artwork or the two-row header.

### Regression and release scope

`tests/header-menu-focus-lifecycle.spec.js` contains 36 final-state cases for
320/390/430px, both themes, idle/playing/paused speech, expanded/collapsed
Options, fullscreen recovery, necessary Stop, delayed cancelled loading and
rapid repeated touch navigation. It awaits actual menu close, resource readiness,
Reader animation completion and queued layout, then checks final focus,
non-inert visibility, viewport bounds and pointer hit targets. Temporary
focus-call/stack instrumentation is absent from the committed test and app.

The existing header tests now assert that focusing controls outside Options does
not expand it. The real focus, state preservation and picker assertions remain.
Current-shell fingerprints allow exactly the five reviewed HTML/CSS/app/control
runtime assets. Every other precached asset remains protected, historical source
fixtures are unchanged, and Shell 54 still retains 49 paths and explicit update
acceptance. No Bible data, manifests, speech code or security policy changes.


Responsive reparenting was a second concrete focus owner. Its old microphone
fallback explicitly focused `readerMoreTrigger` when the focused microphone
moved into collapsed desktop Options. Returning to mobile could also reset the
active-playback reveal state and conceal Play. Both layout-transition cases
failed before correction and passed afterwards. The reparenting handler now
reveals Options when needed for the focused microphone, preserves that actual
control, and hands Play/microphone visibility back to the same controller.
This is a correction at the layout owner, not a delayed corrective focus call.

Cloud-specific lifecycle cases cover both playing and preparing states; provider
start after the menu handoff must not hide the target or restart narration.
Native/cloud playback and Android one-command isolation remain unchanged.


The legacy microphone breakpoint test explicitly required the former Options
focus fallback. Its contract now requires the actual microphone to remain
visible/focused with Options revealed, followed by manual closing returning
focus to Options. The original single-node identity, listener/capture count,
permission-release, keyboard and command behavior checks are retained.


The Options layout fixture also now waits for compact-control initialization
before positioning and uses `scrollReaderStartIntoView()` with a strict 2px
readiness assertion. Its previous raw `scrollIntoView()` could run before
reparenting and leave the panel at the viewport bottom. Scripture visibility,
point-hit tests, clipping, panel-height and scroll-preservation assertions are
unchanged; the fixture now enters the same usable Reader geometry as navigation.


Reparenting preservation is scoped to the explicit menu-requested control, not
to every focused Play button. That ownership expires on real pointer, keyboard
or reading gestures. A valid pre-existing regression caught an initial overly
broad implementation that suppressed normal playback auto-hide after resize;
the production state handling was corrected and that assertion was left intact.
New cases also check ownership expiry after menu navigation, ordinary Play and
new reading gestures. Manual Stop, new playback auto-hide and Show Controls
therefore retain their independent behavior.


### Final visibility-ownership validation

All gates used one browser worker, zero retries and sequential test processes:

| Gate | Unique passed |
| --- | ---: |
| Existing header/menu and mixed-version compatibility | 77 |
| Final lifecycle, cloud, responsive ownership and compact Reader | 57 |
| Options geometry, Save/Fullscreen/Stop and enlarged text | 16 |
| Independent recovery and microphone behavior | 54 |
| Android destinations, Reader/Plan navigation and scrolling | 50 |
| Native/cloud Android speech and continuous chapter playback | 32 |
| Homepage/header/Reader/search smoke and performance | 8 |
| Historical contracts and installed Shell 53-to-54 upgrades | 20 |
| PWA, offline Bibles, Saved Verses and Account | 58 |
| **Total** | **372** |

Final selected identities have no failures, skips or retries. Identity evidence
is in `playwright-report/header-focus-final-summary.json`. The four failure
reproductions (active narration and responsive handoff) are fixed. The initial
application auto-hide regression was corrected without weakening its existing
test. Intentional contract/fixture changes are explained above.

One earlier runner ended without a Playwright failure report after 22 completed
tests. Its log was preserved; no leftover test processes or confirmed browser
crash report were found. The paused case passed in isolation with a trace, and
all test identities completed in the final gates. No interrupted test was
counted as passed. Validation also paused before a browser launch at 910MiB
physical availability and resumed after memory recovered. Recorded final-gate
physical availability was at least 1,264MiB and commit headroom at least
16.70GiB. No unrelated application was terminated.

Performance: **22 scripts, 290,741 canonical decoded startup bytes**, **173 bytes
below the unchanged 290,914-byte budget**. Word Study first-use network readiness
was 17.5ms locally. This margin remains narrow. No eager dependency was added;
the ownership implementation uses the existing optional control runtime.

Asset validation, JavaScript syntax, all 66 canonical Isaiah hashes/sizes and
`git diff --check` pass. Shell 54, 49 paths, vendor cache 24, explicit update
acceptance, downloaded Bibles, manifests, CSP and core Reader/speech/storage
sources are preserved. Physical Android acceptance of this revision is still
required. Changes are committed locally only; no push, merge or deployment.
