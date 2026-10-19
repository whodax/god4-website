# Mobile Bible translation picker

The Reader's traditional native select remains the source of translation options
and the desktop control. Its closed face uses the site's cream/ink theme, but the
opened Android picker and option interaction states are browser/OS UI. Scoped
`color-scheme: only light` and option colors affect computed CSS in Chromium;
they do not reliably control traditional Android popup rendering or geometry.
The reported Android screenshot was not available for device-level verification.

At widths up to 620 CSS pixels, browsers supporting modal dialogs progressively
enhance that select with a compact button and a themed dialog. All nine options,
including DRA Catholic, come from the same native select, without duplicate
translation metadata. Desktop and unsupported-dialog browsers keep the native
select. Resizing to desktop dismisses the dialog and restores native-control focus.

Native buttons expose the current selection with aria-pressed and a visual check.
Arrow keys and Home/End move focus without committing; Enter, Space or a tap
selects. Tab stays within the modal. Close and Escape restore trigger focus;
Escape does not also exit fullscreen Reader. Selection uses changeTranslation,
including its persistence, load-failure rollback and concurrent-request guards.
Loading errors retain the previous selection and permit retry. Dismissing an
already-started load does not cancel the existing Reader translation operation;
late completion does not reopen the picker or move focus back into it.

Existing cream/gold/ink variables and fonts are retained. The selected row has a
check and highlighted background; keyboard focus has an ink outline; mouse hover
is restricted to hover-capable devices; a held press has its own scoped style.
Pointer feedback clears on release, cancellation, leaving the button or scrolling.
Only picker buttons suppress the platform tap overlay in favor of this feedback.
Rows wrap with 44px minimum targets. Only the option list scrolls inside a
viewport-bounded modal, leaving its Close button available without a sticky
overlay over translations. Background Reader controls are inert while modal.

## On-demand loading and unchanged performance budget

The picker and existing translation-application operation now live in
`js/bible/translation-picker.js`. Reader retains only a lightweight loading boundary
and the immediate manual-navigation cancellation/validation behavior. The app
prepares the runtime after the mobile Reader becomes ready; desktop loads it only
when a translation changes. The homepage and initial desktop Reader do not request
or execute it. No new eager script tag is added.

Requests share one readiness promise. Network errors, missing globals and a bounded
10-second load timeout remove the failed script and allow retry. Native controls
and normal Reader/Word Study remain available during pending preparation. If the
native select is focused, enhancement waits for blur rather than hiding it under
an open platform picker. Late/repeated evaluation retains the runtime singleton,
preventing duplicate controls or replacing the active modal's state. Desktop and
unsupported-dialog browsers retain their native control.

The unchanged historical performance test first reproduced 297,852 eager decoded
LF-normalized JavaScript bytes against its 290,914-byte budget. After modularizing,
the same assertion measures 290,277 bytes: 7,575 fewer eager bytes, 637 below budget.
There are still 21 eager scripts. The comparison and budget were not loosened or
rebaselined. The new runtime is downloaded on demand by the page; the service
worker also precaches it during shell installation for offline use. These eager
measurements do not claim a reduction in total shell-install transfer bytes.

No manifest, Bible-data, CSP, design-token or unrelated-menu changes are required.
The approved worker cache version remains 44. Changing Reader/CSS server bytes
alone would not refresh installed cache-first entries. Fresh-install offline
coverage is complemented by installed-user upgrade, failed-install/retry and
multi-tab tests.

Playwright mobile viewports are Chromium emulation, not physical Android or
TalkBack certification. Real Android/browser and assistive-technology acceptance
remains recommended before release.
Injected touch dragging/cancellation is covered. Native momentum flings and the
first tap during/after inertia remain device-acceptance checks: Chromium's raw
injected-fling path suppressed a subsequent compatibility click and did not emit
scrollend. No production gesture interception or timing workaround was added.

## Approved installed-user update — shell 44

The previous worker uses `god4-shell-compact-reader-43`; this update uses
`god4-shell-compact-reader-44`. Both
`/js/bible/reader.js` and `/css/companion.css` were already in its 46 shell assets.
All 46 existing assets remain; the sole addition is the lazy translation runtime,
giving shell 44 exactly 47 assets.
Navigation is network-first, but these asset requests use cache-first delivery.
Registration uses `updateViaCache: 'none'`; that checks worker/import bytes,
not every precached Reader asset. With unchanged worker/import bytes there is
no new worker installation to refresh this shell. A normal reload is therefore
not a reliable update strategy for previously installed users.

The approved update advances the cache name from `compact-reader-43` to
`compact-reader-44`; the performance correction adds only the required runtime
asset. Previous-shell-24 vendor migration, Bible-cache protocol, manifests and
registration code remain intact. Existing cache consumers expect 44. A source
assertion compares the worker against the prior commit and permits exactly the
cache-name change and the one added runtime URL, preserving all other worker code.

The changed worker then precaches the complete shell during installation. A
failed install leaves the existing worker active. Preserve the existing update
notification and user-accepted activation path (`ACTIVATE_UPDATE` / skipWaiting
and controllerchange reload), rather than forcing an immediate activation.
Activation removes superseded shell caches while preserving the separate Bible
translation caches and local selection/Saved Verse storage. Do not clear site
storage or ask users to delete downloaded translations.

The installed-user regression fixture serves the actual old worker, Reader JS,
app JS and CSS from commit `a051890a7d04aac53b937e62d909e284b0101f4d`. The test environment must
include that Git object, as the fixture reads it with git show. Tests at 320px and
390px verify that old asset SHA-256 hashes and the old native UI persist before
acceptance, even after reload. The new worker precaches the complete new shell
while waiting. Explicit acceptance activates it and reloads the accepting tab;
executed Reader/app JS, delivered CSS and the lazy runtime match their new source
hashes. The old 46 cached URLs, including query strings, are preserved exactly;
the runtime URL is the only addition.

Retained WEB/DRA revisions, selected DRA, Saved Verses and the existing vendor
cache survive. Offline reload serves the new assets and both retained translations
remain selectable. Another open tab does not reload automatically, can fetch new
assets after activation, and receives the new picker on its next normal reload.
An injected CSS-install failure leaves shell 43 serving the old UI and assets
offline; correcting the server response and retrying then offers a normal accepted
update without data loss. These four focused upgrade tests passed with one worker
and zero retries. No automatic activation, storage clearing or registration-code
change was introduced.

## Outstanding physical-device acceptance checklist

Record Android/browser version, device, viewport, text scaling and TalkBack
version, plus screenshots or recordings and pass/fail for each item:

- Chrome Android and, if supported, Samsung Internet: 320px/390px-equivalent
  widths, portrait/landscape, normal/fullscreen Reader and light/dark OS themes.
  Verify cream/gold styling, wrapped labels, no clipped rows or horizontal overflow,
  visible Close, and readable enlarged text.
- Tap all nine translations, including DRA Catholic; verify actual passage loading,
  selected check/highlight, persistence after reload/restart, and retained-DRA
  offline selection. Failed loads must keep the previous selection and allow retry.
- TalkBack: trigger name/current translation, dialog title, available-translations
  group, each full option name and pressed state, loading/error announcements,
  logical swipe order, background isolation, double-tap activation, Close/Back
  dismissal and focus return to the translation trigger.
- External keyboard: Tab/Shift+Tab containment, arrows/Home/End without selection,
  Enter/Space activation, visible focus, Escape dismissal and focus return.
  Closing the picker must not also exit fullscreen Reader.
- Slow touch drags and uninterrupted fast flings in both directions: no accidental
  selection or stuck pressed highlight; all rows remain reachable; Close remains
  visible/hittable; the first tap on Close or a translation during and after inertia
  behaves correctly. Specifically reproduce the injected-fling click suppression
  on a physical device before deciding whether it is a browser-fixture limitation
  or a production defect. Record any consumed first tap, not just a successful retry.
- Opening, scrolling, selecting, dismissing and delayed loading must not cause
  unexpected Reader scroll jumps or late focus theft. Test background/foreground
  interruption and gesture cancellation as well as a fresh page load.

These checks are outstanding, not implied by automated test passes.

## Accessibility remediation and timeout regression

The independent review found that the picker buttons' gold focus outline had only
2.868:1 contrast against the cream dialog. Picker buttons and the mobile trigger
now use the existing `--ink` token for their 2px keyboard-focus outline. Selection,
hover and touch colors, typography, desktop native controls and other panels are
unchanged. Computed-style tests check focus visibility, outline color, width,
style and offset, and require at least 3:1 contrast against both the surrounding
surface and the button background. Ink contrast is 12.723:1 against the cream
surface, 11.239:1 against vellum and 12.971:1 against the selected highlight.
Selected/unselected rows, Close and focus return to the trigger are exercised at
320px and 390px, normal/fullscreen and light/dark emulation, with hover and held
press coverage as well.

A regression advances Playwright's clock through the actual production timer:
the runtime remains pending at 9,999ms and fails at 10,000ms. No shorter timeout or
arbitrary sleep is substituted. The failed script is removed, native controls
retain WEB, and a retry selects and persists DRA. Chromium coalesces the retry's
network fetch with the still-pending original request; the test verifies the new
script/readiness promise rather than requiring a second network request. Late
execution of the expired script does not revive its rejected ASV operation or
duplicate picker controls. After recovery, a deliberately delayed ASV translation
completion cannot overwrite a newer WEB selection, steal focus or replace the
active picker. The runtime implementation required no changes.

The first draft expected two independent network requests and failed two cases
because Chromium shared the in-flight fetch. This fixture assumption was corrected
without changing production loading behavior or weakening the timeout/state
assertions. Final focused and complete regression results are recorded below;
physical-device acceptance remains outstanding.

## Final validation and review readiness

The failing historical performance case was reproduced first, then rerun unchanged
after modularization, before the affected regression files. After accessibility
remediation, 10 focused checks passed before rerunning the complete files below.
Each file ran separately and sequentially with one worker and zero retries. Final
complete runs exclude diagnostic reruns, the focused checks and the separately
repeated performance case:

| Test file | Passed | Failed |
| --- | ---: | ---: |
| mobile-translation-upgrade.spec.js | 4 | 0 |
| mobile-translation-picker.spec.js | 32 | 0 |
| compact-reader-controls.spec.js | 12 | 0 |
| shared-reader-fullscreen.spec.js | 22 | 0 |
| final-reader-hardening.spec.js | 7 | 0 |
| pwa.spec.js | 17 | 0 |
| word-study-loader.spec.js | 43 | 0 |
| translation-loader.spec.js | 21 | 0 |
| offline-translation-management.spec.js | 12 | 0 |
| auth-loader.spec.js | 20 | 0 |
| auth-vendor-cache.spec.js | 38 | 0 |
| compare-loader.spec.js | 32 | 0 |
| reader-empty-verse.spec.js | 20 | 0 |
| catholic-labels.spec.js | 39 | 0 |
| csp-styles.spec.js | 5 | 0 |
| security-headers.spec.js | 3 | 0 |
| Total | 327 | 0 |

The existing word-study-loader.spec.js performance assertion is unchanged. Its
final full-file run confirms 290,277 bytes versus the same historical 290,914-byte
budget, resolving the prior 6,938-byte excess without a larger budget or relaxed
comparison. All final runs have zero failures, skips and retries. Earlier vendor
asset-list/install-accounting assertions still expected 46 assets; they now
require the exact 47-asset list and include the runtime's exact file size in the
strict vendor-savings equality, without a byte tolerance.

Asset validation passed (34 references, 21 referenced JS files, three icons and
nine translation metadata entries). All 16 changed/new JavaScript files passed
syntax checks, and git diff --check passed. All 66 Isaiah hashes and byte counts
match their manifest; every shard and that manifest are byte-identical to HEAD.
The extracted translation-application body matches its prior body exactly.
The worker changes only the cache name and adds the one required runtime asset.
Data, manifests, design variables, CSP, registration and the Bible-cache protocol
remain unchanged.

The automated performance blocker is resolved. Physical Android/TalkBack and
momentum-fling acceptance remain outstanding before production release. The work
remains uncommitted for review; no push, PR, merge or deployment occurred.

## Changed-file scope relative to a051890

- css/companion.css
- js/app.js
- js/bible/reader.js
- js/bible/translation-picker.js (new)
- sw.js
- docs/mobile-translation-picker.md (new)
- tests/auth-loader.spec.js
- tests/auth-vendor-cache.spec.js
- tests/compact-reader-controls.spec.js
- tests/compare-loader.spec.js
- tests/final-reader-hardening.spec.js
- tests/offline-translation-management.spec.js
- tests/pwa.spec.js
- tests/reader-empty-verse.spec.js
- tests/shared-reader-fullscreen.spec.js
- tests/word-study-loader.spec.js
- tests/mobile-translation-picker.spec.js (new)
- tests/mobile-translation-upgrade.spec.js (new)
