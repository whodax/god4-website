# Spoken translation and Scripture navigation

Voice Commands uses the existing Reader navigation and translation loaders. All nine installed editions remain available: WEB, ASV, KJV, YLT, DBY, WBS (Webster), RV, GNV and DRA Catholic. Recognized names come from the translation registry and curated aliases, including spelled abbreviations such as “A S V”. No approximate matching or new Scripture data is used.

Examples: “American Standard Version”, “Switch to ASV”, “Matthew chapter 1 verse 2”, “John 1:16”, “John one sixteen”, “John chapter 3”, “Verse 16”, “Next chapter”, and “King James Version, Romans chapter 8 verse 28”. Numbered books accept first/second/third. Spoken numbers support hundreds. For a single-chapter book, “Jude five” means Jude 1:5.

Every destination is validated in the requested edition before selection or persistence changes. Missing books, chapters, empty verses, unavailable downloads and unsupported translations leave the current passage intact and produce accessible feedback. Ambiguous numbers require explicit chapter/verse wording: “John twenty one” can mean chapter 21 or 20:1, so neither is silently chosen. Ranges are not supported. A translation-only switch across Catholic/Protestant Old Testament numbering traditions requires an explicit reference; matching numeric labels are not assumed equivalent. Explicit references always use the requested edition’s own numbering.

Android retains explicit command turns: tapping Voice Commands pauses narration; one final transcript is accepted; recognition must end before any audio action. Navigation preserves the prior playing or paused intent at the new passage, without briefly resuming the old verse. Same-chapter navigation preserves the existing chapter announcement; a new chapter or translation receives its own introduction. Verse numbers are never announced. New commands, manual navigation and a new Android microphone turn invalidate pending voice destinations. Delayed loads and errors cannot override newer navigation.

Existing downloaded editions work offline through the existing loader. An unavailable edition requires downloading while online; there is no silent fallback or new automatic Bible download protocol. Saved Verses, normal picker fallbacks and desktop controls are unchanged. No shell-cache or asset-list change is included; installed-user release delivery must follow the project’s normal approved cache-update process.

Automated coverage uses controlled recognition/native speech/cloud audio callbacks. Real Android recognition accuracy, microphone release, platform tones and TalkBack announcements still require physical-device acceptance. Browser-controlled recognition sounds cannot be suppressed by application code.

## Validation

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
