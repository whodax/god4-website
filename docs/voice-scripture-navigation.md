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
