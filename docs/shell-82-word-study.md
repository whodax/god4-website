# Shell 82 Word Study

Shell 82 adds a labeled Textus Receptus witness to KJV New Testament Word Study. It builds on the accepted Shell 81 runtime at `13d94205e959d332645ba7f4cb2a4b7d3da9ea2a` and the whole-book investigation at `eef029bc21889bc44c4873768c831652fd844388`. [Shell 81 acceptance](shell-81-word-study.md#physical-android-and-talkback-acceptance) · [Whole-book strategy and source audit](shell-82-word-study-strategy.md)

## Published coverage

| Measure | Shell 81 | Shell 82 | Change |
| --- | ---: | ---: | ---: |
| KJV New Testament verified verses, out of 7,957 | 5,933 | 6,409 | +476 |
| KJV NT matched word occurrences, out of 180,488 | 124,702 | 135,805 | +11,103 |
| WEB verified verses | 913 | 913 | 0 |
| WEB matched word occurrences | 3,131 | 3,131 | 0 |
| Priority forms with at least one verified occurrence, out of 500 | 475 | 476 | +1 |

The importer validated all 476 eligible verses across 22 books. KJV NT coverage reaches **80.55% of verses and 75.24% of word occurrences**. Existing KJV and WEB alignment shards, their indexes, Scripture files and original-language variants are byte-identical. The generated data adds one KJV occurrence of **inhabitants** at Revelation 17:2. Verified evidence for that occurrence does not cover every use of the word.

## Witness selection and safety

- Word Study retains reviewed inline alignments and the existing KJV chapter results as first choice. It uses the alternate data only for KJV NT when those paths produce no verified group. The importer refuses colliding accepted KJV verse locations and existing manuscript-specific overrides. The HTML Reader text and KJV supplied-word markup still have to reproduce the exact expected character offsets.
- The alternate chapter contains the English span graph and its ordered original tokens together. The loader verifies the recognized source revision, book, chapter, verse, exact English text, token fields and bounded groups. The paired Greek tokens and alignment are rendered together or the panel falls back to its ordinary verse context without alternate highlighting. It shows **Greek words from the Textus Receptus** and identifies Robinson's edition in the source details.
- The pinned CrossWire importer validates the original position, surface, lexical identity, morphology, ownership and exact supplied-word boundaries against each complete parsed Textus Receptus verse. An added check excludes any group overlapping a supplied English word. It excluded zero candidates in this batch. No Greek tokens from another edition are inserted into these alignments. Six token occurrences lack a consistent optional dictionary entry. Their verified position, Strong's identity and morphology remain visible.
- The KJV alternate index loads only on a qualifying Word Study action. Chapters load on demand. Reader owns Word Study. Compare retains its KJV and other selected English editions and never activates the alternate witness itself. The browser tests cover switching from Compare back to Reader, invalid alternate data, gold highlighting, close and focus return, and persistence after an offline reload.

## KJV expansion after this import

The 1,548 unresolved New Testament records include 1,090 position, surface or identity mismatches, 192 morphology mismatches, 187 English wording or supplied-boundary mismatches, 59 unmatched or unparsed Textus Receptus references, 11 unsupported OSIS records, six ambiguous position records and three incomplete sequences. The [per-book audit](shell-82-kjv-witness-audit.json) identifies the next targets. The remaining manuscript-sensitive cases need edition-aware normalization tests or a separately verified witness. The resolved subset is a reproducible validation against the pinned Robinson source and CrossWire annotations. Both sources have Robinson provenance. It does not constitute fresh independent human review.

The pinned KJV OT file has no explicit original positions across 23,145 verse slots. One accepted Reader witness is missing, Nehemiah 7:68. OSHB provides Hebrew positions and morphology. STEPBible TAHOT includes Hebrew and biblical Aramaic tags, including affix and alternative reading detail. Neither supplies verified KJV English-to-position groups for the installed edition. CrossWire's 186,475 unique Strong’s leads, 40,933 repeated leads and 1,431 missing leads remain separate from English position verification. Computed KJV alignments can guide review after edition and license verification. No OT groups were promoted. [OSHB](https://github.com/openscriptures/morphhb) · [STEPBible data](https://stepbible.github.io/STEPBible-Data/)

## WEB complete-book review and contextual definitions

The existing 2,318 publisher-agreement occurrences remain in the review queue, including 1,613 priority-word occurrences. Agreement between annotation layers that share an English edition is useful for triage. It does not establish reviewer independence. The pilot produces blind, book-complete packets for **Ruth (85 verse slots)** and **Philemon (25)**, followed by **Jonah (48)** and the scaling test **Genesis (1,533)**. Hints and review inputs are separate. Genesis review withholds three evaluation passages, and the original 33-case evaluation file is untouched.

The [review staging tool](../tools/stage-reviewed-web-book.js) checks the independently adjudicated packet against live WEB wording, the exact original token identities and positions, and the frozen holdout. It protects existing verified verses. It writes an engineering staging file outside published data, with source citations and the reviewer decision tied to the packet checksum. Reviewers receive only the blind packet. An approved roster, two independent decisions and a distinct resolver for disagreements are required. There were no external submissions in Shell 82. Zero new WEB groups were staged or published. [Packet and review commands](shell-82-word-study-strategy.md#reproduction-and-release-status)

Verified Scripture-context definitions were added for **inhabitants** in Revelation 17:2 (Greek G2730, present active participle), **Bethabara** in John 1:28 (G962, place name), and **begat** in Matthew 1:6 (G1080, aorist active indicative). They depend on the exact passage, actual span and matching Greek morphology. The other 24 unresolved forms receive no new verified claim. The [publication report](shell-82-kjv-tr-publication.json) checks each previously unresolved form against the new KJV span set. The [WEB candidate evidence](shell-81-crosswalk-report.json) keeps separate counts for all 25 forms screened. General dictionary meanings and historical Webster fallbacks retain their established labels.

## Other Reader and Ethiopian editions

The new [edition audit](../tools/audit-alignment-editions.js) uses book/verse crosswalk addresses and checks complete English equality separately from exact ordered witness equality. It evaluates these alternatives even while WEB is awaiting review. Its counts identify research cohorts. It publishes no transfer.

| Edition | Exact English and original witness from accepted primary KJV | Exact English from alternate KJV | Exact original witness among those alternate English matches |
| --- | ---: | ---: | ---: |
| WEB | 23 | 0 | 0 |
| ASV | 306 | 12 | 0 |
| YLT | 1 | 0 | 0 |
| DBY | 41 | 0 | 0 |
| WBS (Webster) | 1,364 | 102 | 0 |
| RV | 372 | 14 | 0 |
| GNV | 18 | 0 | 0 |
| Douay-Rheims Catholic | 112 | 3 | 0 |

Webster offers the largest exact-edition research cohort. Catholic passages need a Clementine Vulgate lane where the English is based on a Latin witness, with explicit treatment of Catholic-only additions and different numbering. Three DRA primary English matches were remapped or unavailable under the current Reader original-language gate. The standalone Ethiopian collection retains its own chapter and line addresses. The Beta maṣāḥǝft Geʿez printed-church 1 Enoch and Jubilees editions are plausible witnesses to investigate. Their TEI branches need individual license verification and a section crosswalk to the installed English editions. The printed-church 1 Enoch text is not the same publication as Charles's English edition. No Geʿez alignment was imported. [Edition counts and exclusions](shell-82-edition-matrix.json) · [Douay-Rheims and Vulgate editions](https://thedouayrheims.com/about/translations) · [Ethiopic source and branch-license notes](https://biblesrc.org/sources)

## Size, licensing and reproduction

The KJV alternate consists of **181 chapter files plus one index**, **1,167,677 raw bytes** or **530,684 bytes gzip-compressed separately**. The largest file is **21,905 raw bytes**. No alternate data is precached. The existing 48-entry persistent cache keeps the WEB and KJV alternate indexes available through chapter eviction, and the in-memory chapter cap remains 16. Eager JavaScript remains **290,674 bytes** of the 290,914-byte budget. Browser capture confirms zero alignment-data requests before selection.

CrossWire KJV OSIS and its license notices are pinned. The Robinson parsed Textus Receptus at `33af6e9361f8db0afd353714d05c75f44e5555b9` is public-domain material per the source repository. The per-file Greek SHA-256 values are in the [witness audit](shell-82-kjv-witness-audit.json). The output report records the exact generated files and lexical inventory hash. The existing Greek lexical files credit Strong, Ulrik Petersen and Open Scriptures. [Runtime attribution](../data/word-study/alignment/kjv-tr/NOTICE.md) · [Published hashes](shell-82-kjv-tr-publication.json)

```text
node tools/import-kjv-tr-alignment.js <pinned-KJV-OSIS> <Robinson-TR-repository> <fresh-output-directory> <report.json>
node tools/audit-alignment-editions.js <edition-matrix.json>
node tools/stage-reviewed-web-book.js <frozen-review-packet.json> <submissions.json> <approved-roster.json> <fresh-staging-file.json>
```

## Automated validation

Final results will be recorded after the current regression run.

## Shell 82 physical acceptance

1. In KJV Revelation 17:2, open **inhabitants**. Check the Textus Receptus label, gold-highlighted Greek, and the contextual definition. Activate the highlighted Greek to confirm the English phrase and token details.
2. Switch to WEB and open the corresponding passage. Check that it does not inherit the KJV alternate label. Return to KJV and check that the alternate label returns.
3. With KJV downloaded and Revelation 17:2 studied once online, go offline and reload. Open **inhabitants** again. Use TalkBack to close Word Study and check focus returns to that word.

Bible-wide verified alignment remains a release blocker. This preview stays on draft PR #131.
