# Shell 79 independent WEB phrase alignment

Shell 79 starts from the accepted [Shell 78](shell-78-word-study.md) commit `eea5c23eede2afb9495f18334b78c66815506db9`. The owner reported 11 of 11 physical Android and TalkBack checks passed, including a full offline reload and Ethiopian Read Aloud. Shell 79 is a preview candidate.

## Verified coverage

| Reader metric | Shell 78 | Shell 79 |
| --- | ---: | ---: |
| WEB verses with verified highlights | 312 / 31,098 (1.003%) | 385 / 31,098 (1.238%) |
| Matched WEB occurrences | 1,829 / 752,223 (0.243%) | 1,964 / 752,223 (0.261%) |
| Matched WEB priority occurrences | 1,065 / 611,729 (0.174%) | 1,145 / 611,729 (0.187%) |
| Priority forms with verified evidence across editions | 473 / 500 | 473 / 500 |
| Verified KJV NT verses | 5,933 | 5,933 |
| Matched KJV occurrences | 124,702 | 124,702 |

The new data contains **97 complete groups across 73 new verses and 135 word occurrences**. The Old Testament gained 62 verses and 112 occurrences. The New Testament gained 11 verses and 23 occurrences. All 308 existing WEB chapter rows are identical at the row level, and the inline mappings retain precedence. KJV files and Bible edition text are unchanged. The [machine-readable report](shell-79-web-alignment-report.json) gives baseline and added counts by book and all 500 WEB forms, including total eligible occurrences.

| Book | Added verses | Added occurrences |
| --- | ---: | ---: |
| Genesis | 3 | 6 |
| Exodus | 4 | 7 |
| Numbers | 15 | 28 |
| Deuteronomy | 2 | 4 |
| Joshua | 4 | 5 |
| 1 Samuel | 1 | 2 |
| 2 Samuel | 1 | 2 |
| 1 Kings | 1 | 3 |
| Ezra | 2 | 3 |
| Nehemiah | 6 | 14 |
| Job | 1 | 1 |
| Psalms | 15 | 26 |
| Proverbs | 3 | 4 |
| Ecclesiastes | 2 | 3 |
| Daniel | 1 | 2 |
| Zephaniah | 1 | 2 |
| Matthew | 1 | 2 |
| Luke | 1 | 1 |
| Acts | 3 | 6 |
| Romans | 1 | 1 |
| 2 Corinthians | 2 | 3 |
| Galatians | 1 | 5 |
| Ephesians | 1 | 3 |
| 1 Timothy | 1 | 2 |

## Screening results and precision controls

| Method | Verse references | Result |
| --- | ---: | --- |
| Three-way English word overlap before position checks | 24,942 | Screening control |
| ULT-only verified positions and exact frames | 2,390 | Single-source comparison |
| Berean-only verified positions and exact frames | 842 | Single-source comparison |
| Independent ULT and Berean positional agreement | 73 | Published |

The inputs cover 25,197 new same-reference candidates. The importer rejected **16,549**, classified **8,575** as ambiguous, and accepted **73**. Another **5,589** verses had no usable same-reference source pair. The report counts 8,297 ambiguous ULT original occurrences, 183 unresolved repeated English groups, 93 ULT spans without valid Reader word boundaries, and two unbalanced ULT records in the ambiguity total. Rejection reasons include incompatible spelling, position, identity or morphology, missing tokens, and insufficient shared context.

Shell 78 required whole-verse or unchanged-sentence English agreement with one positioned source. Shell 79 accepts a smaller English unit with two independently prepared alignment sources. It retains full-verse original-language verification against the ordered UHB or UGNT witness and the GOD4.us edition. ULT forms, lemma, occurrence and morphology are validated as before. The Berean input must agree on the ordered original verse, and each participating link must pass its compatible-morphology check.

Every published English token must match the exact same original-position edges from both sources. The importer compares complete connected groups, requires contiguous component spans, and preserves each original English-to-position edge. All three texts must have one occurrence of the complete English sequence. The spelling, case, punctuation, local word order, and adjacent context must agree after whitespace and quotation-mark normalization. Where an adjacent word exists it must also carry the same verified original positions in both sources. Shared unique position anchors elsewhere in the verse check whether a group changed sides relative to its context. Supplied brackets, sentence or quotation breaks inside the context frame, split groups, and scope-sensitive wording such as negation or exceptions fail closed. A matched verse can still contain unaligned words.

Automated adversarial fixtures reject repeated or reordered groups, supplied words, punctuation and adjacent grammar changes, negation, disconnected groups, and disagreements on individual position edges. The generalized graph tests cover one-to-one, one-to-many, many-to-one and many-to-many. The current Berean table adapter supplies at most one original position per English row, so the two-source output for this edition is limited to one-to-one and many English words to one original position. The screen quantifies the difference between methods. It does not provide an independently labeled corpus-wide false-positive rate.

## Priority words and definitions

The accepted groups add 80 occurrences across 30 priority forms. All 27 prior gaps remain open. The single-source controls contain candidates for 13 of those forms, including the verbs `comes`, `listen`, `show` and `spoke`, as well as `moab`, `philistines`, `tent` and `king's`. Agreement on the same English span and positions was insufficient to publish any of them. Negated contractions are excluded by the scope rule.

Added labeled Scripture-context definitions for **kindness** in WEB Galatians 5:22, G5544, and **prayer** in WEB 1 Timothy 4:5, G1783. They require the dual-source alignment, the exact verse context and the linked original noun. General dictionary lookup and the prior contextual definitions continue through their existing paths.

## Provenance and reproducibility

- ULT v92 is CC BY-SA 4.0. The [pinned metadata](../tools/web-alignment-v92-source.json) records commit `e26603a14749fc3c2c908c2aa08b4367658ccf6c`, archive SHA-256 `07151aafda1e40c372934c482411d3b9fc745935d30ebd587124227ff0a2473e`, and the validated extracted-content checksum.
- UHB v3.0.0 and UGNT v0.34 are CC BY-SA 4.0. The [source pins](../tools/web-alignment-sources.json) contain the revisions, archive checksums and validated extracted-content checksums.
- The third-printing publisher [Berean TSV](https://bereanbible.com/bsb_tables.tsv) is pinned to SHA-256 `aa2a9a0f004d015738cd1839c7c56c3be2549e0d4f4537090c2017268c223c60`. The [publisher terms](https://berean.bible/terms.htm) record the free-use dedication. The [generated-data notice](../data/word-study/alignment/web/NOTICE.md) preserves attribution and the collection's CC BY-SA 4.0 license.
- Clear.Bible publishes hand-corrected SBLGNT–Berean English mapping data. Its alignment layer is a candidate for a third Greek position witness after checking its precise text, manuscript and revision. OpenBible's ASV data is AI-generated against a reconstructed original-text projection and remains a research aid. The publisher's WEB Strong's-only file stays outside verified alignment. [Clear.Bible](https://github.com/Clear-Bible/Alignments) · [OpenBible ASV](https://www.openbible.info/labs/asv-interlinear/) · [Shell 78 publisher WEB assessment](shell-78-word-study.md)

```text
node tools/import-web-phrases.js <ULT-v92> <UHB> <UGNT> <Berean-TSV> <Shell-78-output> <report.json> [fresh-output]
```

Omit the final directory to measure without publishing. The importer checks every pinned Shell 78 shard before processing. The report hashes the generated index and chapters. A second run against independently reproduced Shell 78 data produced an identical report and identical shard hashes.

## Delivery and testing

The index and 187 chapter shards occupy **205,953 bytes raw** or **98,977 bytes** gzip-compressed separately. The largest shard remains **8,583 bytes** raw. Startup JavaScript is **290,674 bytes** against the 290,914-byte budget, with zero chapter-alignment downloads at startup. Chapter requests remain lazy. The existing 48-entry persistent cache and 16-entry in-page chapter request limit remain in place.

All 108 unit checks passed, as did startup asset validation and Ethiopian static checks. The local verification includes ten historical 320px dark-theme repetitions, per-row baseline preservation, and installed cache upgrade and eviction checks. [Draft PR #131](https://github.com/whodax/god4-website/pull/131) tracks the final engineering and physical acceptance status.

The Shell 78 failure snapshots showed two different timeout points. The 320px upgrade reached its 60-second overall limit during a return to WEB after a voice command. Ethiopian Read Aloud reached the 45-second overall limit with verse 31 present while Chromium waited for the click target to stabilize. The Shell 79 focused run uses one browser worker without competing browser suites or increased upgrade-test deadlines. Available Windows commit headroom measured 12.72 GiB during the run. Ethiopian Read Aloud passed in 18.8 seconds under that setup. The earlier snapshots do not establish a browser or application root cause.

## Next milestone

Prototype a third independent position review on the 13 remaining priority forms with single-source leads. Start with named references such as Moab and the Philistines, then verbs with identifiable subject and tense. Evaluate MACULA Hebrew syntax and gloss data as evidence for phrase boundaries and as a review aid. It does not directly supply WEB spans. Evaluate the Clear.Bible hand-corrected mapping separately for Greek. Pin candidate inputs and measure overlap on the identical GOD4.us edition. [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew) · [Clear.Bible alignments](https://github.com/Clear-Bible/Alignments)

Bible-wide verified alignment remains a release blocker. The 27 priority forms without verified evidence, the large majority of WEB verses, the unresolved KJV coverage, and the other Reader editions remain open. Physical Shell 79 Android and TalkBack acceptance is pending.
