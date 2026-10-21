# Themed Scripture selection — PR #110 follow-up

This stays on `codex/feature-dark-mode` in the isolated Dark Mode worktree. PR #110 still depends on the unmerged Reader PR #109. Neither PR may be merged or released without owner approval.

## Findings and correction

The desktop Scripture grid stretched its detail section to the Books column's intrinsic height. The long Books list therefore dictated dialog height even for Obadiah. This was not missing Scripture. Columns now align independently; Books uses size containment, a one-target minimum and an independent viewport-limited scrollbar. Chapters/verses determine their natural content height up to their existing scrolling limit. Mobile retains Books → Chapters → Verses and Back navigation. No book-specific heights or hidden choices are used.

Compare's reference and dynamic edition selectors used native popups. Those surfaces are browser/OS owned; `color-scheme` alone cannot guarantee website colors. Existing selects remain the value/change-handler source of truth and native failure fallback. On successful optional runtime loading, themed buttons open one shared modal with searchable names, numbered chapter/verse grids, Whole chapter, selected-state buttons and visible focus. Choices come directly from existing options, without remapping Catholic numbering or changing unavailable-passage rules.

The shared modal lives in the existing lazy `translation-picker.js`. Compare does not await it in its data/render path: native controls remain usable during failure or delay. No new eager script or precache entry is added. A focused native Compare select is not replaced on delayed runtime completion: enhancement waits for blur, without duplicate bindings. Bindings use a WeakMap; discarded columns can be collected. Source options, values and passage context are checked before committing a choice, rejecting stale snapshots. After a column rerender, focus returns to its corresponding replacement trigger without scrolling.

Desktop Reader retains its native-looking controls/layout, but pointer/click and keyboard activation open the same themed modal on demand. The source select receives expanded/dialog semantics and regains focus on close. Failed/timed-out runtime loading leaves native fallback on the next interaction; that degraded popup is necessarily OS-controlled. Mobile Reader keeps its existing translation and Options dialogs, with compact numeric chapter/verse grids. Its four rows, save behavior, fullscreen, speech and Show Controls logic are unchanged.

All dialogs use existing Light tokens and the approved blue Dark tokens. Theme changes update CSS without rebuilding the open dialog or changing passage/focus. Dialog placement supports fullscreen Reader; another open modal prevents nested picker creation.

## Selection audit

| Surface | Behavior |
|---|---|
| Choose Scripture | Existing searchable Books / numeric Chapters and Verses; content-aware geometry |
| Compare Book / Chapter / Verse | Shared themed modal at all widths; Whole chapter retained |
| Compare editions, 2 / 3 / 4 columns | Shared themed modal, all nine editions/DRA; existing duplicate-swap handling |
| Mobile Reader translation / Book / Chapter / Verse / Voice / Speed | Existing lazy themed dialogs; numeric chapter/verse styling |
| Desktop Reader translation / Book / Chapter / Verse / Voice / Speed | Existing appearance; on-demand themed modal, native failure fallback |
| Search translation | Existing custom menu; hidden native backing select is not a visible popup |
| Word Study / dictionary | No native select popup or standalone dictionary dropdown exists; word/sense controls unchanged |

No dictionary, original-language, Bible, alignment or canon dataset changes. Native OS styling is not claimed to be controllable in the deliberately retained no-dialog/runtime-failure fallback.

## Accessibility and performance

Named native modal dialogs contain actual buttons with pressed selection states, searchable names and 44px minimum targets. Arrow keys, Home/End, Enter/Space and both Tab directions are tested; Escape returns focus without scrolling. Touch pressed state clears on release, cancellation and scrolling. Scripture also gains Arrow/Home/End within its independent lists. Light focus uses the existing ink token, not low-contrast gold.

The historical eager byte budget is unchanged. Leading indentation is removed only from the already-edited Scripture picker and Reader controls/loader tail to fund activation/keyboard wiring. Beyond explicit new handlers these hunks are whitespace-only: no executable tokens, data or features are removed. The shared modal stays lazy.

## Offline release strategy

Shell **48**, its **49** exact assets and worker code remain unchanged. Cache 48 is the existing unmerged PR #110 candidate, not a released generation; only already-precached asset bodies change. Do not reuse generation 48 for a post-release update. Production/PR #109 users upgrade from 43–47 to final 48 through the existing accepted-update prompt. Tests compare delivered CSS, Reader, Scripture-picker, Compare and lazy-picker hashes against current source, with offline reload, retained WEB/DRA, saved data, previous-shell cleanup and failed-install retry. No activation policy, Bible cache or visitor data changes.

Production generation 46 and PR #109 generation 47 use their actual historical homepage HTML in these upgrade fixtures; the older compatibility fixtures retain their existing setup. Reviewers who already installed an earlier unmerged cache-48 preview should use the new hash-specific preview origin/fresh profile: an identical worker does not automatically refresh an already-installed same-generation shell. This is not the production 46/47 → 48 upgrade path.

Cache-47 tests formerly asserted Reader/CSS/picker bytes identical to PR #109. That was specific to the earlier theme-only follow-up and is now stale: these are intentionally modified assets. They now require differences, retaining exact speech preservation, app whitespace-transform verification, delivered bytes and cache membership. Existing native-select tests now operate the visible themed picker rather than hidden backing elements; selection, numbering, availability and geometry assertions remain.

## Device acceptance

Physical Android/TalkBack, iOS VoiceOver, actual OS font enlargement, native fallback and momentum flings remain manual acceptance items. Browser emulation and enlarged CSS text are not full platform screen-reader or real zoom certification. The OS-managed cream PWA launch-screen limitation in `dark-mode.md` is unchanged. CSP and Cloudflare settings are untouched.

## Follow-up scope and measured geometry

14 files: `css/companion.css`; `js/bible/{compare,reader,scripture-picker,translation-picker}.js`; this document and `docs/dark-mode.md`; `tests/{themed-scripture-pickers,compare-loader,compare-sticky-overlap,catholic-bible,kjv-supplied-words,mobile-translation-upgrade}.spec.js`; `tests/reader-navigation-test-helper.js`.

At 1280×844, Obadiah's dialog falls from **650.875px to 256px**; John is **311px**, Genesis **551px**, Revelation **311px**, and Psalms **620.516px** with an internally scrolling chapter grid. At 320px, Obadiah is **215px**, John **495px**, and long lists cap at **631.625px**. Short grids leave only their **4px** internal bottom padding after the last choice. Both themes produce identical geometry. All 150 Psalms chapters and 176 Psalm 119 verses remain reachable, including keyboard End and selected-item auto-reveal.

Final canonical-LF eager JavaScript is **290,587 bytes**, versus the unchanged **290,914-byte** historical bound: **327 bytes headroom**. There are still 22 eager scripts, cache 48 and 49 precached assets. PR #110's previous reviewed eager total was 290,857 bytes.

## Automated validation

The following are successful per-file runs, with one worker, zero retries and no unrestricted full suite. See the checkpoint below: these counts do not mean that every repeat passed or that final release validation is complete.

| Suite | Passed |
|---|---:|
| New themed-pickers matrix | 26 |
| Compare loader / Compare scroll clearance | 32 / 13 |
| Scripture picker / Reader reference | 16 / 14 |
| Catholic labels / Catholic Bible | 39 / 50 |
| Theme behavior | 34 |
| Mobile translation picker | 32 |
| Four-row Options / Reader Options | 16 / 27 |
| Reading-controls recovery / fullscreen | 42 / 22 |
| Word Study loader / unchanged eager budget | 43 |
| Installed cache upgrades / PWA / offline management | 24 / 17 / 12 |
| KJV browser behavior | 13 |

Total: **472 browser cases**, plus **38 Node checks**: Catholic importer 26, KJV corpus 8, and four read-only Isaiah/protected-shard checks. The latter verify all 66 Isaiah hashes, 1292 verse coordinates, authoritative records and all 87 Genesis/John/Romans shards. Asset validation checks 36 references, 22 JavaScript entries, three manifest icons and nine translation metadata contracts. Modified JavaScript syntax and `git diff --check` pass.

Development iterations corrected new-test fixture mistakes (a mistyped existing Light token, choosing Tobit before its DRA catalog finished loading, a nonexistent legacy DOM class and focusing a hidden native backing control). An existing one-binding assertion exposed redundant per-select synchronization listeners; production now uses one delegated listener and that original assertion remains unchanged. Existing Compare/KJV tests now use visible picker controls while preserving canonical-text, numbering, focus and geometry assertions. No performance bound, source checksum or functional assertion was relaxed.

### Resource checkpoint — resolved on resumed validation

The final desktop activation refinement explicitly focuses the native-looking control for accessibility-generated clicks as well as pointer activation. The updated 26-case picker matrix and unchanged eager-budget gate passed after this change. A further 27-case Reader Options repeat stopped at **7 passed, 1 timeout, 19 not run**: the 390px Dark fullscreen case exceeded its existing 30-second total deadline during keyboard navigation. Its complete log is retained at ignored `test-results/reader-options-timeout.log`. The same case passed unchanged in isolation in **19.4 seconds**, versus much shorter earlier runs. The earlier complete Reader Options run passed all 27; the earlier upgrade run passed all 24.

Host memory was severely constrained: the blocked reading showed **32.71 / 33.61 GiB committed**, **0.91 GiB commit headroom**, and **84 MiB available physical RAM**. Resource contention was a suspected contributor, not a conclusively proven cause of the timeout. No assertion or timeout was changed and no unrelated process was terminated.

After the owner freed memory, live readings showed **28.69 / 33.61 GiB committed**, **4.93 GiB headroom** and **1141 MiB available RAM**. The full Reader Options suite then passed **27/27 in 46.8 seconds**, including the previously timed-out case, with zero retries and unchanged test deadlines. Exact-byte cache upgrades passed **24/24** against the final Reader code.

The resumed sequential run passed **203 browser checks**: Reader Options 27, upgrades 24, PWA 17, offline management 12, reading controls 42, fullscreen 22, Compare 32, themed pickers 26 and the unchanged eager budget 1. These repeat earlier cases and are not added to the distinct-case total above. All **38 Node integrity checks** were repeated successfully, with no skips. Assets, modified JavaScript syntax and whitespace checks also passed.

Before/after-suite guards stopped further launches below **2 GiB commit headroom** or **512 MiB available physical RAM**. Neither threshold was reached: observed boundary readings ranged **4.80–5.23 GiB headroom**, **956–1310 MiB available RAM**, and **28.38–28.81 GiB committed**. The historical timeout remains recorded; it did not recur in the complete resumed run. The exact follow-up commit and fresh hash-specific preview are reported on PR #110. PR #109 remains unchanged and neither PR is approved for production by these checks.
