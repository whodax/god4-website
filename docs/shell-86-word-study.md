# Shell 86 Word Study

Shell 86 adds adjacent-verse alignment, three verified English words in an indirect question, and additional alignment across the nine Reader editions. Its accepted baseline is [Shell 85](shell-85-word-study.md) at `170063fcbb98fb7222202194ff986527032adef4`.

## Baseline preservation

The baseline coverage inventory records **219,011 verified word occurrences**, **480 covered priority forms**, **753 occurrences with contextual definitions**, and **21 fully aligned KJV chapters**. The protected WEB review set contains **33 passages**. The continuation compiler checks prior shard hashes and uses the installed English and original-language token sequence for every admitted group. Previous alignment data, source witnesses, overrides, bilingual offsets, Scripture wording and supplied-word styling are preserved.

## Cross-verse alignment

The KJV puts *in him* at the end of Ephesians 1:10. The pinned parsed Scrivener 1894 transcription and the CrossWire positional inventory place the two Greek words at positions 1 and 2 of 1:11. The adjacent English *In whom also* uses separate Greek positions. Other transcriptions present the same words at the end of 1:10, so the source label identifies the partition used by the app. [Scrivener chapter transcription](https://www.textus-receptus.com/wiki/Ephesians_1_Greek_NT%3A_Scrivener%27s_Textus_Receptus_%281894%29)

The publisher checks both installed English verses and the full native sequence before adding a bridge. It checks the adjacent positions against existing ownership, verifies that the selected spans do not touch supplied wording, and refuses protected evaluation references. The runtime keeps a source chapter, verse and zero-based position for each Greek word. Separate panel indices let the two Greek words highlight together and support reverse highlighting. The panel announces the adjacent verse and exposes it in the details. KJV *even* remains editorial and unaligned. The same chapter shard and persistent cache serve the bridge after an offline reload.

The first publishing adapter covers explicit within-chapter links between adjacent verses in the approved KJV witness. The group representation can combine unclaimed positions from the current and adjacent verses. A shared Greek passage with different verse numbering is a lead for other editions, and each edition still needs exact English offsets and independent native ownership checks. No unreviewed neighboring pair is published.

## Grammar and coverage rules

| KJV passage | Result | Coverage treatment |
| --- | --- | --- |
| Philemon 1:9, *Yet* | Proposed implicit English connective. The opening clause expresses a contrast with verse 8, and lacks a separate adversative token. | Remains unresolved and eligible. The discourse scope and eligibility need independent review. |
| Titus 1:1, *is* | Proposed implicit English copula. Greek uses an article and a prepositional expression for the relation. | Remains unresolved and eligible. Morphology and eligibility need independent review. |
| Matthew 2:4, *should be born* | The installed witness and Scrivener both place the finite passive Greek verb at the end of 2:4. The indirect question accounts for the three-word English expression. | Three originally eligible words are now covered by a verified grammatical group with one Greek token. |

The machine-readable inventory distinguishes explicit alignment, verified grammatical groups, marked supplied wording, and unresolved wording with a proposed implicit classification. The pre-existing *thou wilt* group remains verified. Implicit proposals have no effect on highlighting or eligibility. Original and revised denominators are equal for all nine editions.

KJV **Ephesians is fully aligned at 155/155 eligible verses**, bringing KJV to **22 fully aligned chapters**. **Philemon is 24/25** and **Titus is 45/46**. These figures use complete eligible Word Study coverage, with grammatical groups reported separately. The KJV New Testament residual inventory reports uncovered portions of already aligned verses as well as the unaligned verses. [Matthew 2:4 Scrivener witness](https://openbible.com/text/matthew/2-4.htm) · [KJV residual inventory](shell-86-kjv-pending.json)

## Corpus expansion

The published changes add **3,141 verified English word occurrences**. They introduce groups in **408 previously unaligned edition-verses** and extend **227 previously aligned edition-verses**. The Reader total is **222,152** verified words.

| Edition | Aligned verses | New aligned verses | Verified words | Added words |
| --- | ---: | ---: | ---: | ---: |
| WEB | 1,331 | 23 | 4,036 | 98 |
| ASV | 1,407 | 45 | 8,174 | 391 |
| KJV | 9,211 | 79 | 164,450 | 394 |
| YLT | 535 | 6 | 970 | 40 |
| DBY | 912 | 30 | 2,521 | 122 |
| Webster | 2,693 | 143 | 28,920 | 1,380 |
| RV | 1,551 | 61 | 9,645 | 513 |
| GNV | 578 | 5 | 1,085 | 26 |
| Douay-Rheims Catholic | 508 | 16 | 2,351 | 177 |

KJV Old Testament coverage increases from 1,780 to **1,859** verses with groups. The 79 newly aligned verses leave 21,286 with no verified groups. The New Testament preserves **7,352** verses with groups, including **6,846** fully covered verses and **506** partial verses. The 605 wholly unaligned New Testament records break down into 450 ordered Greek witness differences, 139 English or supplied-word boundary differences, 11 missing position records, one ambiguous ownership case and four incomplete witness sequences. The automated boundary screen yielded one additional lead in partially aligned verses. Source review identified it as the same-verse Matthew grammar case. The final residual screen has no further publishable boundary candidates under that test. [Edition, book and chapter inventory](shell-86-coverage.json)

The compiler combines the installed native sequence with independently positioned Berean and unfoldingWord annotations. New exact morphology adapters cover supported Hebrew adjectives, finite verbs and noun suffixes, and convert unambiguous Greek tense, mood and voice into the installed code order. Both positional sources still have to agree. The KJV Old Testament uses exact English tags as additional evidence for applicable groups. Whole-verse projections require the identical original-language sequence. For purely terminal punctuation changes, the full declarative wording and all internal punctuation must agree. Negation, quotation changes, ambiguous repeated phrases, overlapping positional claims and editorial spans are excluded from that rule. [Hebrew morphology specification](https://hb.openscriptures.org/HomeFiles/Morph.html) · [Data attribution and licensing](../data/word-study/alignment/continuations/NOTICE.md)

## Contextual definitions and priority word forms

Verified contextual definition coverage increases from **753 to 857** word occurrences. New definitions are gated by exact selection, passage, verified native identity and morphology. Examples include genealogical *begat*, Hebrews 11 *faith*, Genesis 17 *covenant*, and the different uses of *inheritance* in Ephesians 1:14 and 1:18. The accepted distinctions for *king's* in Acts 12:20 remain in use.

The 20 outstanding priority forms were included in the edition-wide occurrence audit. English apostrophe forms remain whole selectable words and the verified-group format already supports multiple native positions for a whole contraction. To publish a contraction, the compound scope must be positively evidenced. The checked sources supplied no accepted new priority form, including a trial that required concordant vocative positioning for *brothers*. Existing English usage explanations are retained. [Counts for all 500 forms and nine editions](shell-86-coverage.json)

## Reproduction

Independent generation reproduced **287 files** byte for byte. The added catalog is 369,617 raw bytes and 167,890 bytes with each file gzipped. The index is 7,316 raw bytes and 1,996 bytes gzip. It loads after selection and shares the existing 48-entry persistent runtime cache. Seven index files are protected from eviction. Startup JavaScript remains **290,674 decoded bytes**, within the 290,914-byte budget.

Run each import with a fresh output directory and the pinned inputs in the [publication inventory](shell-86-alignment-publication.json).

```text
node tools/import-word-study-extensions.js <CrossWire> <Scrivener JSON> <Scrivener notice> <ULT> <UHB> <UGNT> <Berean TSV> <output> <publication report> continuation
node tools/publish-word-study-cross-verse.js <CrossWire> <Scrivener JSON> <Scrivener notice> <output> <publication report>
node tools/audit-word-study-corpus.js <coverage report>
node tools/audit-kjv-shell-86-pending.js <CrossWire> <Scrivener JSON> <Scrivener notice> <residual report>
```

## Automated verification

| Check | Result |
| --- | --- |
| Unit suite | 529 passed |
| Focused Chromium | 156 distinct cases passed across the main run, isolated replays and the Matthew check. |
| Upgrade | 27 passed, including all 11 Shell 85-to-86 cases and 16 historical cases. |
| Additional PWA | 10 passed |
| Asset and Ethiopian education static validation | Passed |

The primary focused run passed 149 of 155 cases. All six outstanding cases passed isolated replays with their existing deadlines. The new Ephesians browser test passed forward and reverse highlighting, source reference access, isolation from 1:11, focus return and a full offline reload. It observed zero alignment requests before selecting a word. The Matthew browser test passed separately. Exact runtime inventory comparisons verified unchanged denominators, nondecreasing coverage at every chapter and priority form, and an identical Ethiopian inventory.

## Physical acceptance for the new behavior

1. In **KJV Ephesians 1:10**, select the final *him*. Check gold Greek on both words, the visible and spoken **Ephesians 1:11** source, and the Scrivener witness label. Activate either Greek word to return the gold emphasis to *in him*. *Even* should remain outside the gold span.
2. Keep KJV offline and warm this selection. Reload offline, repeat the study and close it to confirm that focus returns to *him*. In **1:11**, *whom* should still use its own positional group.
3. In **KJV Matthew 2:4**, select *born*. Confirm *should be born* highlights together and the one Greek passive verb receives gold highlighting in the same verse.

Bible-wide verified coverage and independent adjudication of implicit wording remain release blockers.
