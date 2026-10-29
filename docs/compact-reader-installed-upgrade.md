# Compact mobile Reader: installed-user upgrade

**Current status: RESOLVED, awaiting review.** Final focused validation passes: 318 unique tests, zero failures/skips, plus 20 repeated runs of the two original regressions. No commit, push, merge or deployment. The prior NO-GO section below is retained as historical evidence.

Approved Reader: `253885e96e0b5edf13fec3ecd2185aec6c1bc28f`, with owner-reported Android/TalkBack acceptance 6/6. Branch: `feature/mobile-reader-compact-controls`.

## Minimum production change

Live production `https://god4.us/sw.js` was checked read-only on 2026-10-28 and still reports shell 52. Advance `god4-shell-compact-reader-52` to `god4-shell-compact-reader-53`. This is the only service-worker code change. The same 49 shell assets already include Reader HTML/CSS, speech, cloud TTS, settings, the lazy picker/compact-control runtime and voice-navigation code. A new cache name forces a complete fresh shell rather than reusing installed cache-first responses. No asset path, translation manifest, Bible data, CSP or design changes in this upgrade. The follow-up adds only the legacy-document capability guard described below.

Installation still uses atomic `cache.addAll`. It does not call `skipWaiting`; an installed update waits while the existing application is controlled. The Update button sends the existing `ACTIVATE_UPDATE` message. Only that message calls `skipWaiting`, and the accepting tab reloads after controller change. Other open tabs retain their in-memory state until their normal reload. Normal browser service-worker lifecycle when all clients close remains unchanged.

Activation preserves the vendor migration policy and the special legacy shell-24 fallback. Cleanup still targets obsolete shell/vendor cache names, never Bible-ready/candidate cache namespaces. No local storage or IndexedDB is cleared. Existing Saved Verses, translation selection, valid voice/speed preferences, reading position, plans, Compare preferences and themes remain. The accepted Reader's existing maximum-speed migration to 200% remains part of the approved release; this worker update adds no settings migration.

## Upgrade coverage

Historical workers and their shell assets are served directly from committed Git snapshots, not a mix of old Reader and current settings/speech files. Shells 43–51 retain their original commit fixtures. Shell 52 uses production main `ca0d623f87d9f85a9cb4c515acbb5ea69796ff15`. New application assets are independently pinned to the physically accepted Reader commit; raw SHA-256 tests verify cached and served responses, and all 49 required assets are checked after recovery. Canonical LF comparisons are used only for source equivalence across Windows/Git; cache byte checks use actual served bytes.

Every baseline covers acceptance gating, old responses while waiting, multi-tab behavior, offline WEB/DRA use and unchanged saved records. Shells 51/52 additionally compare voice/speed, plans, journey, Compare, reading position, theme and a local marker before/after. The immediate 52→53 path runs at 1280px, 320px and 390px and checks the compact microphone, accessible listening state and offline spoken WEB/DRA reference navigation. No new Bible downloads occur during upgrades.

For each baseline, an HTTP 503 and a dropped connection during a late precache request reject installation. Tests require no waiting update, no responses in the failed new cache, the old shell working offline with retained data, and an explicit retry that succeeds. A dropped network connection is modeled; OS/browser process termination and storage eviction cannot be forced by these browser tests.

Current-version cache references in PWA, offline management, account/vendor, empty-verse and Word Study tests advance to 53; historical fixture versions remain unchanged. The earlier upgrade suite's KJV post-update expectation now includes the already-approved Book/Chapter introduction while retaining exact verse text, canonical brackets and supplied-word italics checks.

## Release boundaries

No push, merge or deployment is included. The accepted UI/device checks precede this cache-only update; physical installed-PWA update acceptance on the future shell-53 preview remains a release smoke check. Browser recognition and platform-controlled microphone tones are unchanged.

## Prior validation result — NO-GO, uncommitted (superseded by follow-up below)

315 unique passing test identities and two unresolved failing identities; one worker, zero automatic retries. Normal historical upgrades from 43–52: 59 passed. All-client-close/offline-relaunch recovery: one passed. Account/vendor/PWA/offline/manifest/Word Study/performance: 158 passed. Reader/mobile accessibility/fullscreen/voice navigation: 97 passed. Two old-idle-tab cases time out waiting for the accepting page to reload. Initial stale KJV chapter-introduction and generic hidden-proxy navigation expectations were corrected with exact behavior assertions preserved.

Blocking case: keep a controlled shell-52 tab open without initializing Reader; accept 53 in another tab. The waiting worker receives `ACTIVATE_UPDATE` and invokes `skipWaiting`, but its promise stays pending, 52 remains active, 53 remains installed/waiting and the accepting page does not reload. Foregrounding tabs, waiting for registration and closing completed test status MessagePorts did not resolve it. Closing only the unused tab also did not recover activation. Closing all GOD4.us clients after acceptance and relaunching offline does recover 53 with all 49 asset hashes, saved data/preferences and downloaded WEB/DRA intact. The underlying old-worker/browser lifecycle cause is not yet isolated; do not present this as a proven application-code diagnosis or a safe release.

Temporary worker/message diagnostic wrappers are removed from the regression source; their observations remain in ignored `compact-release-late-worker.log`. The rejected `event.waitUntil(skipWaiting())` experiment did not fix activation and was removed. The final worker diff remains the single cache-version line; no activation-policy or runtime changes were retained. Both failing regressions remain asserted (not skipped, loosened or given extra sleeps).

Startup: 22 scripts, 279,241 decoded/canonical LF bytes; unchanged 290,914-byte strict limit, 11,673-byte headroom. Word Study network readiness measured 19.6ms and shell-hit readiness 13.3ms (single observations). Asset validation passes: 36 references, 22 startup syntax checks, three icons and all nine translation metadata entries. All changed JavaScript syntax, all 66 Isaiah hashes/byte counts and `git diff --check` pass. No browser crashes or memory interruptions occurred.

No release commit was made because validation is blocked. HEAD remains `253885e96e0b5edf13fec3ecd2185aec6c1bc28f`. Eight files are modified and this report is new; all remain unstaged. No push, merge or deployment occurred. Exact test identities and logs are in ignored `playwright-report/compact-reader-release-summary.json`.

Exact change scope:

- `sw.js`
- `tests/auth-loader.spec.js`
- `tests/auth-vendor-cache.spec.js`
- `tests/mobile-translation-upgrade.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/pwa.spec.js`
- `tests/reader-empty-verse.spec.js`
- `tests/word-study-loader.spec.js`
- `docs/compact-reader-installed-upgrade.md` (new)

## Follow-up: activation and legacy-tab diagnosis

The apparent activation stall was a test-fixture resource-lifetime error. `installOld()` awaited only headers from the 218,180-byte auth-vendor warm-up fetch, leaving its response body unread in the accepting tab. That kept an old-worker fetch event pending. `skipWaiting()` does not cancel in-flight old-worker fetches. Closing the unrelated idle tab could not release the accepting tab’s stream; closing all clients canceled it and allowed activation. Completing `vendor.arrayBuffer()` fixes the fixture without sleeps, GC forcing, extra reloads or production activation changes.

A dedicated causal test deliberately holds an old-worker vendor response body, accepts the update, verifies the worker remains installed/waiting, then consumes that body. The normal lifecycle completes immediately afterward with saved data intact. It uses no worker/prototype overrides. Chromium lifecycle observation verifies installing → installed → activating → activated for the replacement and redundant for the previous worker. The surviving old tab receives exactly one controllerchange, points at registration.active, and retains its marker without an automatic reload. `clients.claim()` is absent and unnecessary for replacing the controller of these already-controlled clients; no uncontrolled clients are forcibly adopted. See the [service-worker activation algorithm](https://www.w3.org/TR/service-workers/#try-activate-algorithm).

Once the fixture stopped blocking activation, a genuine compatibility defect became visible: shell-52 HTML has no `#readerVoiceCommands`. First loading the shell-53 lazy runtime in such an old document called `move(null, ...)`, throwing while reading `element.before`. The smallest production correction is an early `ReaderCompactControls.initialize()` markup-capability guard, before any compact DOM changes. Legacy documents retain their existing layout, controls and settings until their normal reload; fresh shell-53 documents still receive the physically accepted compact layout. No speech/navigation behavior is removed or deferred.

The response-body fix is test-only. The lifecycle assertion helper observes Chromium’s ServiceWorker domain and normal controller events; temporary diagnostic wrappers were removed. The accepted source-asset pin permits exactly the intentional guard/comment delta in the lazy runtime and continues verifying every other approved asset. Shell 53, all 49 paths, user acceptance, skipWaiting handling, vendor migration and Bible-cache cleanup rules remain as prepared. There is no actual restart requirement in these scenarios after correction, so no misleading restart notice or forced-tab policy was added.

### Final follow-up validation

| Group | Unique passes |
| --- | ---: |
| Historical upgrades 43–52, failures/interruption, lifecycle and old-tab compatibility | 63 |
| Account/vendor migration, offline/PWA, manifest, Reader fallback and Word Study/performance | 158 |
| Mobile Reader/accessibility, fullscreen and spoken Scripture navigation | 97 |
| **Total** | **318** |

Both original regressions additionally passed 10/10 each (20 consecutive repetition-run executions), one worker and zero automatic retries. These repetitions and the standalone causal probe are not double-counted in the unique total. Final failures/skips: zero. Before correction, the fixture-induced stall and the subsequently exposed null-element exception were reproduced and logged; no tolerance, required assertion or timeout was relaxed.

Browser budget: unchanged 22 startup scripts / 279,241 decoded LF bytes, 11,673 below the 290,914-byte limit. Network Word Study readiness was 27.3ms and shell-hit readiness 17.3ms in this run, not a comparative benchmark. Assets, changed JavaScript syntax, all 66 Isaiah hashes/byte counts and formatting validation pass. No browser crash or memory-related interruption occurred. The earlier NO-GO is superseded by these passing results.

Changes in this follow-up are limited to `js/bible/translation-picker.js` (one capability condition plus comment), `tests/mobile-translation-upgrade.spec.js` (body drain, explicit lifecycle/controller assertions, independent guard pin and held-stream causal regression), and this report. Seven other files from the prepared shell-53 change remain byte-for-byte as received. Current worktree: nine modified files plus this new report, all unstaged. HEAD is still `253885e96e0b5edf13fec3ecd2185aec6c1bc28f`. The complete scope is the nine files listed earlier plus `js/bible/translation-picker.js`.

No update restart requirement remains in the corrected scenarios. Existing tabs intentionally retain their older document layout until normal reload; explicit acceptance reloads the accepting tab once. No clients.claim, forced tab closure, reload loop, Bible-cache deletion or new activation protocol was added. Owner-provided UI/TalkBack acceptance remains 6/6; physical installed-PWA upgrade smoke testing after an authorized preview remains the release acceptance item. A full unrestricted browser suite was not run.

Final test identities and repetition logs are indexed by ignored `playwright-report/activation-resolution-summary.json`. All earlier investigation logs and the original uncommitted checkpoint are preserved under ignored `playwright-report/activation-investigation-baseline/` and the `activation-*.log` files.
