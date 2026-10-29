# Spoken translation and Scripture navigation

Voice Commands uses the existing Reader navigation and translation loaders. All nine installed editions remain available: WEB, ASV, KJV, YLT, DBY, WBS (Webster), RV, GNV and DRA Catholic. Recognized names come from the translation registry and curated aliases, including spelled abbreviations such as “A S V”. No approximate matching or new Scripture data is used.

Examples: “American Standard Version”, “Switch to ASV”, “Matthew chapter 1 verse 2”, “John 1:16”, “John one sixteen”, “John chapter 3”, “Verse 16”, “Next chapter”, and “King James Version, Romans chapter 8 verse 28”. Numbered books accept first/second/third. Spoken numbers support hundreds. For a single-chapter book, “Jude five” means Jude 1:5.

Every destination is validated in the requested edition before selection or persistence changes. Missing books, chapters, empty verses, unavailable downloads and unsupported translations leave the current passage intact and produce accessible feedback. Ambiguous numbers require explicit chapter/verse wording: “John twenty one” can mean chapter 21 or 20:1, so neither is silently chosen. Ranges are not supported. A translation-only switch across Catholic/Protestant Old Testament numbering traditions requires an explicit reference; matching numeric labels are not assumed equivalent. Explicit references always use the requested edition’s own numbering.

Android retains explicit command turns: tapping Voice Commands pauses narration; one final transcript is accepted; recognition must end before any audio action. Navigation preserves the prior playing or paused intent at the new passage, without briefly resuming the old verse. Same-chapter navigation preserves the existing chapter announcement; a new chapter or translation receives its own introduction. Verse numbers are never announced. New commands, manual navigation and a new Android microphone turn invalidate pending voice destinations. Delayed loads and errors cannot override newer navigation.

Existing downloaded editions work offline through the existing loader. An unavailable edition requires downloading while online; there is no silent fallback or new automatic Bible download protocol. Saved Verses, normal picker fallbacks and desktop controls are unchanged. No shell-cache or asset-list change is included; installed-user release delivery must follow the project’s normal approved cache-update process.

Automated coverage uses controlled recognition/native speech/cloud audio callbacks. Real Android recognition accuracy, microphone release, platform tones and TalkBack announcements still require physical-device acceptance. Browser-controlled recognition sounds cannot be suppressed by application code.

## Earlier navigation implementation validation

398 unique Playwright identities passed, with zero failures, skips, automatic retries or browser crashes. Suites ran sequentially with one worker:

- Android speech and command isolation: 114.
- Spoken navigation (42), cloud TTS (44), KJV supplied words (13), speech highlighting (47), and voice profiles (12): 158.
- Compact Reader, shared fullscreen, picker cascade and mobile translation picker: 87.
- Offline translation management and PWA: 29.
- Existing desktop voice-command contracts: 9.
- Startup budget / Word Study readiness: 1.

The existing isolation matrix now expects valid navigation during playback to continue at the destination, rather than stop. Exact passage text, chapter announcements, cursor and microphone-release checks remain. The initial 39-case navigation run also passed; it is superseded by the final 42-case run and is not double-counted.

Browser measurement: 22 startup scripts, 279,241 decoded/canonical LF bytes versus this task’s 270,842-byte baseline (+8,399). The historical 290,914-byte limit is unchanged, leaving 11,673 bytes. Word Study first-use network readiness measured 16.3ms in this run; this is not a latency benchmark.

Asset validation passed: 36 references, 22 startup syntax checks, three manifest icons and all nine translation metadata entries. Explicit syntax checks pass for all five changed/new JavaScript files. All 66 Isaiah hashes and byte counts are unchanged; formatting validation passes. The six-file scope contains no CSS, markup, Bible data, manifest, service-worker or CSP changes. Existing shell 52 / 49 assets remain unchanged.

Sampled available physical RAM stayed above 1,324MB; sampled commit headroom stayed above 18.5GB. No unrelated applications were terminated. Ignored local logs and `playwright-report/voice-scripture-navigation-summary.json` retain test identities and measurements.


## Natural translation aliases (shell 53 follow-up)

The deployed `66bf2c3` parser already accepts the literal ASCII transcript “Douay-Rheims Catholic.” Reproductions against that source instead fail for spaced/Unicode hyphens, “Douay Rheims Catholic Bible,” “Catholic Bible,” “American Standard,” and “Read Geneva.” The exact physical Android transcript was not captured, so its particular spelling cannot be confirmed. These are confirmed parser gaps rather than a Bible-download or canon problem.

Alias construction now uses the nine-edition catalog for its full titles, abbreviations, first distinctive word and first two words. A small explicit table adds common names (Authorized, Young, Noah Webster, Catholic), letter-name transcripts and enumerated Douay/Rheims spellings. Bible, Version, Translation and Edition suffixes work with these names. Examples include “Switch to Catholic Bible,” “Read Geneva,” “Change to American Standard,” and “Douay Rheims Catholic, Tobit chapter 1 verse 2.” WEB, ASV, KJV, YLT, DBY, WBS, RV, GNV and DRA remain separate editions.

Normalization handles capitalization, Unicode compatibility characters, whitespace, punctuation, apostrophes and ASCII/Unicode hyphens. Numeric range separators remain ranges and are rejected; they are never converted into a different reference. Matching requires an exact normalized alias boundary, takes the longest explicit title and rejects equally specific aliases belonging to different editions. Generic names such as “English Bible” require clarification. Book names and reserved playback words cannot become short translation aliases. No edit distance, phonetic similarity or inferred translation selection is used. Enumerated recognition spellings are deterministic accepted inputs, not evidence of what this phone transcribed.

The existing translation selector, loaders and validated navigation executor perform the action. Unavailable passages, Catholic/Protestant numbering safeguards, Saved Verses, Android one-final-command microphone turns, native/cloud narration and accessible status feedback remain intact. Recognition accuracy and TalkBack still require physical Android acceptance; an unsupported transcript produces feedback rather than guessing.

No service-worker source, cache version or asset path changes are needed for this follow-up to the unmerged shell-53 release. The shell-upgrade source-scope test pins all assets and Reader code outside the alias-parser region to the approved shell-53 commit, and pins the reviewed alias block with its own SHA-256. Dedicated unit/Android tests exercise that region. Upgrade tests continue checking actual cached byte hashes, explicit acceptance, historical shells, offline WEB/DRA retention and failed/interrupted installation recovery. Their post-upgrade command now exercises the natural Catholic name.


### Alias follow-up validation

365 unique final test identities passed: 24 Node unit tests and 341 Playwright tests. Browser suites ran sequentially with one worker and zero automatic retries; no failures, skips or crashes remain.

| Focused group | Passed |
| --- | ---: |
| Spoken navigation, all nine editions, new aliases and Android compound commands | 57 |
| Android speech (32) and microphone/command isolation (82) | 114 |
| Compact controls (12), adjacent microphone (12), shared fullscreen (22) | 46 |
| Three-row mobile layout (21), offline Bible management (12), PWA (17) | 50 |
| Historical shell 43–52 upgrades to shell 53, acceptance, cache bytes and recovery | 63 |
| Existing desktop voice contracts (10) and browser startup measurement (1) | 11 |
| Parser units, including every generated alias and every catalog book alias | 24 |

The startup measurement is 22 scripts / 281,594 canonical LF decoded bytes, compared with 279,241 at `66bf2c3` (+2,353). The unchanged historical limit is 290,914 bytes, leaving 9,320. Word Study first-use network readiness measured 17.5ms; this is not a latency benchmark. Asset validation passed for 36 references, 22 startup syntax checks, three icons and all nine translation metadata entries. Explicit syntax checks passed for the four changed/new JavaScript files. All 66 Isaiah SHA-256 values and byte counts, shell-53 source and 49 asset paths remain unchanged. Formatting validation passed.

The five-file scope is Reader alias parsing, its unit/browser regressions, the exact upgrade-source expectation and this document. No CSS, markup, Bible data, manifest, speech lifecycle, service worker or CSP changes are included. Available physical RAM samples fell to 337MiB during browser validation; sampled commit headroom remained above 15.7GiB. No unrelated processes were terminated. Physical Android transcript accuracy and TalkBack acceptance remain outstanding. Local output logs and `playwright-report/voice-translation-aliases-summary.json` retain the final test identities and measurements.


## Temporary physical-Android transcript investigation (voice-trace-1)

Physical testing of preview `0ec2f703` reports “Douay Rheims,” “Douay Rheims Catholic,” and “Douay-Rheims Bible” failing while Catholic/DRA and other short names work. The preview's fetched Reader source matches `9b54d3f` exactly after line-ending normalization. All reported literal phrases parse to their intended editions. No exact phone transcript has been supplied; the physical root cause is therefore unconfirmed. Do not infer that the phrase spoken is the text returned by Android.

The callback currently accepts the first nonempty final result in an Android command turn, reads `result[0].transcript`, releases recognition, then passes that unchanged string to the command handler on `onend`. Command normalization and exact catalog matching follow. Alternative results never select a translation. Existing Catholic/Protestant Old Testament numbering safeguards and passage validation still apply. For example, a translation-only command while viewing a Protestant Old Testament passage may correctly require an explicit reference; use WEB John 1:2 as the neutral diagnostic starting point.

The requested example hypotheses are distinguishable without adding aliases: Dewey Rheims, Do way Rheims and Douay Reims are already supported; Dooay Rheims and Douay Rames are not. These are code-level probes, not verified physical transcripts. The alias catalog is deliberately unchanged pending evidence. In particular, no broad phonetic/fuzzy matching or automatic choice of a lower recognition alternative has been introduced.

### Opt in and collect one result

After the diagnostic build is approved for preview, open its **new hash-specific preview URL** with `/#voice-debug` appended. The old `0ec2f703` preview does not contain this panel. Wait for “Local Voice Commands diagnostics” and the `voice-trace-1` build tag. The URL fragment is not sent in HTTP requests. Do not clear installed Bible data or Saved Verses to troubleshoot a missing panel.

1. Start at WEB John 1:2, open Voice Commands and say “Douay Rheims.”
2. Read the exact final transcript, including JSON-escaped punctuation/whitespace, normalized text, parser decision and selected passage. Capture only this nonpersonal test command before the automatic 60-second clear.
3. Repeat with “Douay Rheims Catholic,” “Douay-Rheims Bible,” and the known-working “Catholic Bible”/“DRA” controls. Use a separate microphone turn for each.
4. Check “Douay Rheims Catholic, Tobit chapter 1 verse 2.” A supported transcript should select DRA Tobit 1:2; an unsupported transcript must not guess.
5. Report the exact displayed text and parser/selection outcome voluntarily. Nothing is automatically uploaded. The microphone-release stage remains visible if dispatch has not occurred.

A panel without a captured final points to callback/release stages rather than an alias correction. A captured final that differs from the spoken name identifies a recognition output needing review. A matching translation plan followed by an unavailable/numbering message identifies selection validation rather than recognition. If the panel/build tag is absent, the executing page is not the diagnostic build; using a fresh hash-specific preview avoids confusing an installed older shell with the new code.

### Privacy, safety and scope

Diagnostics is disabled by default and runs in the existing optional picker module, not a new startup script or asset. It requests up to three alternatives only while opted in; Android may return fewer. Only the accepted final is displayed, not interim speech or audio recordings. Diagnostic text stays in transient page DOM, never console, URL, analytics, storage or network logging. The browser's normal speech-recognition service may itself process audio remotely; this feature does not change or claim to localize that service.

Text is cleared after 60 seconds, at the next command turn, when the page is hidden, on pagehide, by Clear, or by Disable. Late callbacks cannot restore cleared/hidden transcript fields. There is no transcript history, transcript array or storage-backed opt-in. Disable removes the fragment and returns focus to the existing microphone. Ordinary command status messages are now generic instead of echoing raw transcripts. Failures in the optional trace hooks cannot interrupt command execution. The display is explicitly diagnostic and may occupy reading space while enabled; ordinary/mobile/fullscreen layouts are unchanged when disabled.

No aliases, Bible data, manifests, speech provider protocols, microphone turn boundaries, shell version or cache paths change. Shell 53 retains its 49 assets; exact reviewed source checksums and actual cache-byte assertions cover the three intentionally changed runtime assets. The existing desktop status assertion now checks the generic acknowledgment or exact completed destination as appropriate, while retaining every navigation and speech check. Its original transient-acknowledgment assumption also fails with the original `9b54d3f` Reader and test: a completed “read John 3” reports “WEB selected. John 3.” Physical acceptance remains blocked until an actual Android transcript and outcome are captured and reviewed. No preview push or production deployment is part of this local diagnostic preparation without approval.


### Diagnostic-build validation

390 unique final identities passed: 366 Playwright tests and 24 parser unit tests. Browser groups ran sequentially with one worker and zero automatic retries. There are no remaining automated failures, skips or browser crashes in this focused inventory.

| Group | Passed |
| --- | ---: |
| Existing navigation (57) plus local diagnostic/privacy/pipeline regressions (24) | 81 |
| Android speech (32) and command isolation (82) | 114 |
| Compact controls, mobile microphone and shared fullscreen | 46 |
| Three-row mobile layout, offline Bible management and PWA | 50 |
| Historical shell 43–52 upgrades to shell 53 | 63 |
| Desktop voice/status contracts (11) and startup performance (1) | 12 |
| Parser units (all generated aliases and catalog book aliases) | 24 |

An initial new test incorrectly used a helper that waited for microphone release while its fixture intentionally held release open; it now asserts the accurate closing/busy state before delivering `onend`. The separate legacy acknowledgment failure was reproduced with the original committed Reader and original test before updating its exact completed-reference expectation. Both investigations and superseded runs remain in ignored local logs; they are not double-counted as final passes. `playwright-report/voice-debug-summary.json` records all 366 final browser identities.

Default startup remains 22 scripts, now 282,410 canonical LF decoded bytes versus 281,594 at `9b54d3f` (+816). The unchanged 290,914-byte limit leaves 8,504 bytes. The diagnostic display itself stays in the existing optional module. Word Study first-use network readiness measured 20ms, not a latency benchmark. Asset validation passed for 36 references, 22 startup syntax checks, three icons and all nine translation metadata entries; explicit syntax checks passed for all five changed JavaScript files. All 66 Isaiah SHA-256 values/byte counts are unchanged. The entire translation-alias/normalization/validated-navigation block is byte-identical to the baseline after LF normalization. The service worker is unchanged: shell 53 and the same 49 precache assets.

The seven changed files contain only diagnostic hooks/UI/styles, privacy-preserving acknowledgment, focused tests, reviewed runtime source fingerprints and this document. No Bible data, manifest, CSP or service-worker changes are included. Available physical RAM samples fell to 364MiB, while sampled commit headroom remained above 14.4GiB. No unrelated applications were terminated. Formatting validation passed. Automated readiness is for an opt-in diagnostic preview only; the Android production release blocker remains unresolved until the actual phone transcript and outcome are reviewed.


## Verified Android transcript correction

The owner subsequently supplied actual final transcripts from physical Android testing: “do a rings,” “do a Reigns,” and “do we Reems” had no translation match; “Dewey reams” selected DRA. This resolves the earlier uncertainty about the phone's output. Android returned spellings absent from the exact alias catalog; punctuation was not the established cause. A pre-change unit run reproduced all three misses and the successful Dewey control (25 passed, three failed among 28 cases).

Only three full phrases are added to the existing DRA alias table: `do a rings`, `do a reigns`, and `do we reems`. Existing normalization handles their case and punctuation. Existing command prefixes and Bible/Version/Translation suffixes continue to apply. Each phrase also supports an explicit target, for example “do a Reigns, Tobit chapter 1 verse 2.” DRA, Catholic, Catholic Bible, Douay-Rheims and Dewey reams remain intact. No standalone `do`, `we`, `rings`, `reigns` or `reems` alias is added, and no unobserved word recombinations are inferred. Whole-token boundaries, longest exact alias matching, catalog ambiguity rejection and edition-specific reference validation are unchanged.

The complete reported transcript is still passed through the same Android one-command turn, microphone release, existing translation loader and Reader navigation. The correction changes no speech provider or lifecycle code. The optional `/#voice-debug` display and its clear/expiry/privacy behavior are preserved byte-for-byte for final physical confirmation. Unsupported alternatives remain diagnostic-only and never automatically select a Bible.

Regression coverage injects each owner-reported final transcript through the actual recognition callback, starts from WEB before each DRA selection, and verifies both ordinary selection and DRA Tobit navigation with diagnostics enabled and disabled. It also covers capitalization, natural command/suffix forms, ordinary-word collisions, unsupported recombinations, a deliberate catalog ambiguity, Saved Verses/offline Bibles and native/cloud playback. The post-upgrade check now uses the observed “do a Reigns” transcript, preserving exact cached-byte and source-checksum assertions. The historical fixtures, shell-53 worker and all 49 asset paths are unchanged.

Physical Android confirmation of the updated build remains the release acceptance step. No preview push, merge or production deployment is authorized by this local implementation task.


### Verified-transcript correction validation

298 unique final test identities passed: 268 Playwright and 30 Node parser units. Browser groups ran sequentially with one worker and zero automatic retries; final runs have no failures, skips or browser crashes.

| Focused group | Passed |
| --- | ---: |
| Translation/navigation and diagnostics, including 13 new real-transcript regressions | 94 |
| Android speech and command-turn isolation | 114 |
| PWA and offline Bible management | 29 |
| Historical asset contracts (43–52) plus Shell 52-to-53 upgrade/activation/recovery | 19 |
| Desktop voice/status and startup performance | 12 |
| Parser units, including four observed transcripts and collision/ambiguity guards | 30 |

The initial pre-fix unit run reproducing the three missing aliases is retained separately. A new browser fixture initially expected “Tobias 1”; the existing canonical heading is “Tobit 1.” Only that new fixture's exact heading/introduction expectation was corrected; application data and display behavior were preserved. The 13-case focused pass is superseded by the final 94-case run and is not counted twice. `playwright-report/dra-observed-summary.json` records all final browser identities.

Startup remains 22 scripts, now 282,451 canonical LF decoded bytes versus 282,410 at `99bdcde`: exactly 41 added bytes. The unchanged historical 290,914-byte limit leaves 8,463 bytes. Word Study first-use network readiness measured 19.4ms, not a latency benchmark. Asset validation passed (36 references, 22 startup syntax checks, three icons and all nine translation metadata entries). Explicit syntax checks passed for all four changed JavaScript files. All 66 Isaiah hashes/byte counts and shell-53 source/49 asset paths are unchanged. A source comparison verifies that the complete Reader differs only by the three literal aliases; the diagnostic runtime and CSS are identical to `99bdcde`.

The five-file scope is the Reader alias table, parser/browser regressions, reviewed Reader cache checksum and post-update transcript fixture, and this documentation. There are no CSS, markup, Bible data, manifest, service-worker, CSP, microphone lifecycle or speech-provider changes. Formatting validation passed. Memory was monitored between groups; sampled available physical RAM remained at least 769MiB and sampled commit headroom above 11.7GiB. No unrelated applications were terminated. Final physical Android acceptance of the updated build remains pending; no push, merge or deployment was performed.


## Expanded Douay-Rheims Android transcription aliases

Based on the owner's follow-up list, all twenty exact phrases now select DRA:
Douay Rheims; Douay Reims; Douay Rames; Dewey Rheims; Dewey Reams; Dewey Rames;
Do Way Rheims; Do Way Reams; Do We Reems; Do We Reams; Do A Rings; Do A Reigns;
Do A Reams; Do A Rains; Dewey Reigns; Dewey Rains; Do Away Reams; Do Away Reigns;
Do We Rains; Do We Rings.

The existing deterministic normalizer and complete-phrase parser handle case,
Unicode punctuation, apostrophes, hyphens and spacing. Each phrase supports Bible,
Catholic, Catholic Bible, Version and Translation suffixes, with Switch to,
Change to and Read prefixes and explicit Scripture references such as
“Dewey Reams Catholic, Tobit chapter 1 verse 2.” Existing aliases remain.
Catholic qualifiers are generated only for DRA catalog entries. No fuzzy matching,
common-word aliases, recognition-alternative fallback or parser precedence changes
were introduced. Browser alternatives remain diagnostic-only and cannot override
any primary command, including ambiguous primary speech.

The unit matrix independently specifies all twenty names, six suffix forms,
four prefix forms and six normalization forms, checking both edition selection
and Catholic compound navigation (5,760 parser invocations). Browser fixtures
exercise each name and suffix through the recognition callback, from WEB, with
and without diagnostics; offline/Saved Verses, negative collisions, catalog
ambiguity, conflicting alternatives and native/cloud microphone isolation remain
covered. Physical Android/TalkBack acceptance still requires device verification;
these browser tests simulate speech recognition rather than acoustic recognition.

Only the Reader alias list and Catholic suffix generation change at runtime.
The shell upgrade test pins the resulting Reader SHA-256 while retaining every
other approved source hash and cached-byte assertion. Shell 53, its 49 precache
paths, all nine translations and canon data, compact controls, optional diagnostics
and speech-turn handling remain unchanged.

Performance: 22 startup scripts, 282,861 canonical LF bytes versus 282,451 at
9430b3f (+410). The unchanged 290,914-byte historical budget leaves 8,053 bytes.


The existing Catholic mobile fullscreen fixture clicked a control now inside the
closed More menu at 390px and 320px, producing two initial timeout failures.
The fixture now opens More before Fullscreen and closes it afterward, retaining
all fullscreen, keyboard focus and reflow assertions. Runtime compact layout
code remains unchanged. Explicit verification after this fixture correction uses
one worker and zero automatic retries.


Final validation (all browser runs: one worker, zero automatic retries):

| Coverage | Distinct passing cases |
| --- | ---: |
| Voice navigation, diagnostics and all twenty aliases | 127 |
| Android native/cloud/fallback speech | 32 |
| Android command-turn isolation | 82 |
| Catholic canon, navigation, search, Compare, narration and layout | 50 |
| Compact Reader layout and controls | 21 |
| Historical Shell 43–52 upgrades, source hashes, cache bytes and recovery | 63 |
| Historical startup budget / first-use readiness | 1 |
| Node alias matrix, Catholic labels and Isaiah integrity | 66 |

The voice batch passed 241/241. The initial wider batch recorded 121 passes,
two stale mobile fixture timeouts and two missing historical fixture failures
(Shells 43 and 47), leaving nine dependent cases unrun. Both exact historical
commits were fetched without changing any fixtures. After correcting only the
Catholic fixture interaction, the explicit 15-case verification run passed:
three Catholic layout cases, five Shell 43 cases, six Shell 47 cases and the
startup measurement. This yields 376 distinct passing browser cases; the desktop
Catholic layout case was verified twice and is counted once. No failures remain
unresolved and no automatic retries were used.

The measured historical baseline is 24 scripts / 290,914 decoded LF bytes;
current is 22 scripts / 282,861. First-use Word Study network readiness measured
21.1ms locally; this is not a latency benchmark. Asset validation passed for
36 references, 22 startup syntax checks, three icons and nine translations.
Explicit changed-file syntax checks and git diff whitespace validation passed.
No push, merge or deployment was performed. Physical Android/TalkBack acceptance
remains pending using the retained #voice-debug mode.
