# Shell 84 Word Study expansion

Shell 84 adds verified alignment to **5,924 edition-verses and 27,543 eligible English word occurrences**. It builds on the accepted Shell 83 documentation commit `99d5deb81ce7ddac555f61a5d0a8f87923e3988f`. [Shell 83 Android and TalkBack results](shell-83-word-study.md#physical-android-and-talkback-acceptance)

## Coverage of the installed editions

A verse with alignment has at least one verified word occurrence. A fully aligned verse has verified coverage of every eligible English Reader word. KJV supplied words are counted separately. Edition-verses and occurrences are counted separately for each edition.

| Edition | Displayed verses | Verses with alignment | Fully aligned verses | Eligible words | Verified words | New verses | New words |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WEB | 31,098 | 1,195 | 174 | 752,223 | 3,648 | 263 | 334 |
| ASV | 31,086 | 1,042 | 367 | 783,821 | 6,313 | 617 | 1,090 |
| KJV | 31,102 | 8,444 | 6,708 | 763,715 | 152,075 | 1,988 | 16,145 |
| YLT | 31,102 | 444 | 27 | 786,940 | 787 | 402 | 652 |
| DBY | 31,099 | 707 | 87 | 774,598 | 1,946 | 600 | 1,125 |
| Webster | 31,102 | 1,829 | 1,081 | 788,005 | 24,550 | 694 | 5,986 |
| RV | 31,086 | 1,054 | 388 | 791,291 | 7,283 | 628 | 1,124 |
| GNV | 31,090 | 466 | 31 | 783,934 | 874 | 433 | 636 |
| Douay-Rheims | 35,811 | 413 | 111 | 889,787 | 1,962 | 299 | 451 |

The [coverage inventory](shell-84-coverage.json) reports by book and chapter, with provenance, linked contextual definitions and the 500 priority forms. It measures actual provider results on installed text. The [corpus publication report](shell-84-corpus-publication.json) includes the per-chapter candidate decisions and SHA-256 checksums. Candidate counts describe screened cohorts, which cover fewer verses than the installed editions. The standalone Ethiopian collection contains **86 books and entries, 42,447 displayed lines and 1,137,544 eligible words**. Its report uses lines for prose entries and has zero verified alignments.

## KJV and the nine-edition corpus

The corpus importer verifies complete ordered native tokens against the installed witness. Accepted groups use concordant whole-verse or sentence spans, or a bounded phrase with position evidence and context checks. A separate Hebrew name rule requires both source layers to link the identical name to the same proper-noun position. The English name must be unique within each verse. Conflicting positions, duplicate names, uncertain publisher markup and protected evaluation positions are excluded.

For KJV Old Testament groups, complementary English evidence comes from the exact spans of CrossWire's own lexical tags. Clear.Bible and unfoldingWord must independently identify the original position and agree on the exact English wording of the selected occurrence. This is why a KJV translation tag by itself does not publish an alignment. The original manuscript, surface, lexical ID and morphology must match the installed authoritative witness. The KJV Old Testament now has alignment in **1,552 of 23,145 verses**. The 1,505 new Old Testament rows include 16 with explicit Aramaic witnesses. See the machine-readable book counts for Psalms, Numbers and Proverbs, the largest contributors to this expansion.

The importer also rechecked the 303 previously excluded matching verses with supplied-word brackets. It admitted qualifying groups in all 303 verses, 298 Webster and five Darby. Those groups require exact English, identical ordered witnesses and independently checked native positions in the accepted CrossWire KJV groups. Bracketed words and any groups that touch them are excluded. The same filter preserves every displayed bracket and token in the installed edition.

STEP Bible's published original-language tables, Open Scriptures and MACULA provide useful Hebrew morphology, segmentation and coordinates. The STEP interlinear demonstration also illustrates that tagged English can group words differently from their original order or miss a negative particle. The KJV OSIS used here has no Old Testament native position attribute. The position-based importer instead combines the exact English evidence from its tags with two published positional sources. The KJV/YLT alignment in the separate Bible Project database is described as computed and remains a candidate lead. [STEP Bible data](https://github.com/STEPBible/STEPBible-Data) · [STEP interlinear methodology](https://tidsskrift.dk/hiphilnovum/article/download/142739/186441/311522) · [Open Scriptures Hebrew Bible](https://hb.openscriptures.org/HomeFiles/Oshb.html) · [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew) · [Bible Project data](https://github.com/kitcosby/bible-project)

## KJV New Testament witnesses

The six title-wrapper cases from Shell 83 passed against the installed Greek witness after removal of balanced, plain OSIS title wrappers. The remaining 1,542 verses were checked against the pinned parsed Scrivener 1894 transcription. **477 passed the complete CrossWire position, surface, lexical identity, morphology and exact English tests**. Scrivener adds 11,995 matched occurrences. Its visible witness label and independent lazy index identify the edition. Accepted Robinson Textus Receptus rows and older manuscript overrides have precedence. English text and supplied-word styling come from the installed KJV.

The New Testament now has aligned groups in **6,892 of 7,957 KJV verses**. Among the remaining 1,065, the Scrivener audit found 558 with position, surface or identity mismatches, 278 morphology mismatches, 190 English or supplied-word differences, 25 unsupported native token forms, 11 ambiguous position records and three incomplete sequences. Within the new witness data, the parser removes terminal punctuation only and retains accents and lexical word positions. Heterogeneous source tags and textual variants need more exact parsing and independent evidence before further publication. [Scrivener source and terms](https://github.com/honza/textus-receptus/tree/2bac2dae4a0961c84d6d544a40cbef8b8d8c4e32) · [Scrivener import audit](shell-84-scrivener-publication.json)

## Complete-book review

KJV Ruth gained four aligned verses out of 85. Jonah has 48 reviewable verses and still awaits position evidence. Exact-verse blind packets now cover both books. Across KJV, the strongest candidates for finishing a book include Ephesians with 144 of 155 fully aligned verses, Titus with 42 of 46, and Philemon with 22 of 25. These counts give a concrete basis for assigning small-book review. The 2,318 unresolved WEB occurrences prioritized in earlier work remain in the review queue, and all 33 independent evaluation passages and all four frozen WEB packets are intact.

This milestone received no independent linguistic submissions. The review stager now accepts disjoint, independently adjudicated supplements to partially aligned passages, checks the exact installed witness, rejects conflicting English spans and native positions, and hashes the prior published groups for a future publication check. Ruth, Jonah, Philemon and Genesis each reproduced the frozen WEB packet checksums. The KJV packets use exact displayed English and the same review discipline. [Complete-book review inventory](shell-84-book-review.json)

## Catholic Latin and Ethiopian Ge'ez

The pinned Clementine Vulgate source generated 35,809 records and 612,227 exact Latin tokens. The printed-EOTC Ge'ez branches generated 1,058 records and 18,490 tokens for 1 Enoch, and 1,294 records and 19,627 tokens for Jubilees. The repeatable tool exports source coordinates, original token order and Unicode offsets, while retaining unnumbered Ge'ez introductions separately. Genuine verse differences in Psalms, Sirach, 1 Enoch and Jubilees are recorded in the earlier [coordinate audit](shell-83-witness-coordinates.json). Esther and Daniel matching coordinates remain review leads. A Latin syntax resource such as PROIEL can assist native morphology checks. It cannot establish the translation relationship between the pinned Clementine and installed English Douay-Rheims. Ge'ez requires exact section and edition-specific English evidence, particularly the Charles English versions against the printed EOTC witnesses. The new inventories are review artifacts with **zero verified English span links** and stay outside runtime. [Source token inventory](shell-84-witness-token-report.json) · [Latin PROIEL treebank](https://github.com/UniversalDependencies/UD_Latin-PROIEL) · [EOTC Jubilees provenance](https://biblesrc.org/text/jubilees)

## Priority forms and definitions

Verified alignment now covers at least one occurrence of **479 of 500** priority forms. *Moab*, *Philistines*, and *spoke* gained verified examples. The panel gives passage-specific plain-English definitions for Moab as a territory in Numbers 21:20 and a people in 2 Kings 3:23, the Philistines attacking Keilah in 1 Samuel 23:1, and Samson speaking to the woman in Douay-Rheims Judges 14:7. The definitions require the linked native position and morphology.

The 21 forms still awaiting verified alignment are *don't, says, didn't, brothers, doesn't, comes, listen, today, king's, everyone, won't, does, whoever, show, can't, let's, loving, families, news, isn't,* and *whatever*. *King's* and the seven contractions now have English grammar explanations labeled **English usage**. The published per-form inventory distinguishes those from occurrence-specific linked definitions, general dictionary results and historical Webster fallback. Negation still requires clause-level positional evidence before original-language links can be published.

## Performance and reproduction

The shared witness chapters use one native token array per coordinate and edition-specific English spans. Corpus data uses 1,993,397 raw bytes across 671 files. Scrivener uses 556,473 raw bytes across 208 files. Together, the files total 931,543 bytes gzip-compressed separately. The corpus index is 36,378 raw bytes and the Scrivener index is 2,956 raw bytes. All are lazy-loaded after selection. The persistent chapter cache holds up to 48 entries, and protects five catalog indexes during eviction. Startup JavaScript remains **290,674 bytes** against the **290,914-byte** budget. The original Scriptures, original-language shards, design, 33-case evaluation file and Shell 83 alignment data were verified against the accepted Git baseline.

Repeatable commands, where each output directory is fresh:

```text
node tools/import-word-study-corpus.js <CrossWire OSIS> <Clear data> <ULT v92> <UHB> <UGNT> <Berean TSV> <Shell 79 shards> <Robinson repo> <output> <report>
node tools/build-scrivener-alignments.js <CrossWire OSIS> <Scrivener JSON> <Scrivener notice> <output> <report>
node tools/audit-word-study-corpus.js <coverage.json>
node tools/prepare-word-study-book-review.js <frozen WEB packet directory> <output> ruth jonah
python -B tools/build-word-study-witness-inventory.py <Clementine USFX> <1 Enoch TEI> <Jubilees TEI> <output>
```

Independent repeats produced identical hashes for all 671 corpus files, all 208 Scrivener files and the witness inventories. The source checksum pins, publication files and book-review hashes document reproducibility. Source terms and attribution are also recorded in the [corpus notice](../data/word-study/alignment/corpus/NOTICE.md) and the [Scrivener notice](../data/word-study/alignment/kjv-scrivener/NOTICE.md).

## Automated validation

| Check | Result |
| --- | --- |
| Unit checks and every new runtime data row | 517 passed |
| Focused Chromium checks | 150 passed in the main run. One WEB John 1:1 case timed out waiting for its third phrase control, then passed an isolated replay and five consecutive repeats at the same deadline. |
| Shell upgrade checks | 25 passed, including all 11 Shell 83-to-84 cases and historical fixtures for Shells 74 through 82 |
| Additional PWA checks | 10 passed |
| Asset and Ethiopian education validation | Passed |
| Local preview at 390px | No startup alignment requests. Scrivener, WEB names, Douay-Rheims, Webster supplied boundaries, full offline reload and focus return passed. |

The timeout snapshot showed the three correctly labeled John 1:1 phrase controls and the preceding occurrence already aligned. The isolated and repeated runs exercised the full phrase selection sequence. The [Shell 83 report](shell-83-word-study.md#physical-android-and-talkback-acceptance) retains the earlier physical results.

## New Android and TalkBack acceptance

1. In **KJV Matthew 3:8**, select **repentance**. Check the Scrivener 1894 label, both highlighted Greek tokens, and focus return. Switch to WEB and open the same verse to check edition isolation.
2. In **WEB Numbers 21:20**, select **Moab**. Check the gold Hebrew highlight, right-to-left text, and the territory definition. With WEB and the chapter previously cached, reload offline and repeat the lookup.
3. In **KJV 1 Samuel 23:1**, select **Philistines**. Check the Hebrew highlight and the Keilah definition. In **Douay-Rheims Judges 14:7**, check the Hebrew witness and the definition of **spoke**.
4. In **Webster Matthew 9:19**, select **Jesus** and check its two Greek highlights. Select **did** inside the supplied bracket and confirm that the Greek tokens remain unhighlighted.

The next substantial milestone is to finish a high-coverage small KJV book and adjudicate a short WEB or KJV Old Testament book with independent reviewers. Continue the Latin, Ge'ez and negation reference work while waiting for reviews. Bible-wide verified alignment remains a release blocker. PR #131 stays in draft.
