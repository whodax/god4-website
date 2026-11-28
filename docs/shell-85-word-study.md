# Shell 85 Word Study expansion

Shell 85 adds verified groups to **2,724 previously unaligned edition-verses** and extends coverage in **319 previously aligned edition-verses**. It adds **19,573 verified English word occurrences** across all nine Reader editions. The baseline is accepted Shell 84 commit `748defc3fa1628dd79575ff3ca492a6a0836f8b0`. [Shell 84 acceptance results](shell-84-word-study.md#physical-android-and-talkback-acceptance)

## Installed Reader coverage

A fully aligned verse has a verified group for every eligible English word. A partially aligned verse has at least one verified group and at least one uncovered eligible word. The KJV eligible-word count excludes its explicitly marked supplied words. Identical excerpts in different editions count separately.

| Edition | Displayed verses | Aligned verses | Fully aligned | Eligible words | Verified words | New aligned verses | New verified words |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WEB | 31,098 | 1,308 | 174 | 752,223 | 3,938 | 113 | 290 |
| ASV | 31,086 | 1,362 | 368 | 783,821 | 7,783 | 320 | 1,470 |
| KJV | 31,102 | 9,132 | 6,868 | 763,715 | 164,056 | 688 | 11,981 |
| YLT | 31,102 | 529 | 28 | 786,940 | 930 | 85 | 143 |
| DBY | 31,099 | 882 | 88 | 774,598 | 2,399 | 175 | 453 |
| Webster | 31,102 | 2,550 | 1,087 | 788,005 | 27,540 | 721 | 2,990 |
| RV | 31,086 | 1,490 | 401 | 791,291 | 9,132 | 436 | 1,849 |
| GNV | 31,090 | 573 | 32 | 783,934 | 1,059 | 107 | 185 |
| Douay-Rheims | 35,811 | 492 | 111 | 889,787 | 2,174 | 79 | 212 |

The [runtime coverage inventory](shell-85-coverage.json) measures installed English and providers by edition, book and chapter. Subtract the fully aligned count from the aligned count to obtain the partially aligned count at any level. The [publication inventory](shell-85-alignment-publication.json) records additional groups, sources, candidate outcomes, priority-form deltas and every output checksum.

## Completing KJV books

| KJV book | Shell 84 fully aligned | Shell 85 fully aligned | Remaining evidence |
| --- | ---: | ---: | --- |
| Philemon | 22 of 25 | 24 of 25 | 1:9 *Yet* has no explicit CrossWire word edge. It conveys the contrast between verses 8 and 9. A reviewer would need to substantiate a clause-spanning relation or classify it as supplied discourse wording. |
| Titus | 42 of 46 | 45 of 46 | 1:1 *is* expands a Greek articular prepositional phrase. There is no finite Greek copula at that position. A review decision about implicit English grammar is needed to change its eligibility. |
| Ephesians | 144 of 155 | 154 of 155 | 1:10 ends with *in him* after the supplied word *even*. The Greek words involved occur at the start of 1:11 in the pinned witness. These groups currently require same-verse coordinates. Cross-reference publication needs a validated split-verse mapping and an accessible witness display. |

Fifteen of the 18 blocking verses now meet the eligibility rule. The KJV now has 21 fully aligned chapters. The importer inventories unmet spans using the exact installed English, inventories native positions, and checks each alternate against the same safeguards. The held-out Ephesians coordinate retained its prior published result.

Philemon 1:12 uses the labeled Scrivener witness. Its exact Greek sequence preserves the opening relative clause and the imperative absent from the shorter installed primary sequence. At 1:21, the exact future second-person Greek inflection links *thou wilt* to the same Greek verb as the existing *do* group. The intervening *also* retains its independent link. This uses the inflected verb, its exact position and the matching CrossWire group together. Editorial brackets and original displayed English remain intact.

## Evidence and manuscript boundaries

KJV Old Testament coverage rises from **1,552 to 1,780 aligned verses** and from **4,149 to 4,800 verified occurrences**. Psalms gains verified groups in 67 previously unaligned verses and extends eight more. Numbers gains 20 and extends 14. Proverbs gains three and extends four. Berean publisher and unfoldingWord positions must both resolve against the installed Hebrew or Aramaic witness. The exact KJV tagged span can provide independent English evidence. Strong’s numbers supply a lexical gate, and native positions come from the source annotations.

KJV New Testament coverage rises from **6,892 to 7,352 aligned verses** and from **147,926 to 159,256 verified occurrences**. The importer checks an entire Greek sequence for unique position ownership, surface and lexical identity before admitting individual groups. It withholds groups with a material morphology discrepancy while retaining groups that clear every required gate. The aligned witness may be the installed Greek text, an accepted alternate already in use, or the pinned Scrivener 1894 Textus Receptus with its own visible label. Earlier witness choices and manuscript overrides retain precedence.

The Greek validation covers three enumerated movable-nu pairs, an explicitly enumerated elision spelling and several position-specific differences in how the editions parse identical inflected forms. The relevant passages are Philemon 1:12, Titus 2:1 and Ephesians 3:3, 4:16 and 5:12. The two listed adverb/preposition pairs preserve the same Greek surface and lexical ID. The lexical concordance distinction in Ephesians 6:10 requires the exact position and spelling of the neuter `λοιπόν`, identified under G3063 and G3062 in the upstream data. The Reader shows the witness's own parse. [Greek χάριν attestation](https://studybible.info/strongs/G5484) · [Ephesians 4:16 witness text](https://www.openbible.com/text/ephesians/4-16.htm) · [Greek λοιπόν lexical entry](https://studybible.info/strongs/G3063)

Complete-verse and bounded-clause projections require a previously verified group and an identical ordered target witness, including native word, identity, morphology and language. Clauses must keep exact wording, punctuation, uniqueness and slot order. The partial-clause rule excludes changes involving negation, condition, exception, and quotation boundaries. Any edge outside the accepted clause stays out. An edition-specific coordinate or witness mismatch disqualifies its row. Where applicable, the publication includes donor edition IDs. The runtime uses the recipient's exact Scripture and checks the ordered witness again.

Both external positional sources passed at **3,554 coordinates** before edition-specific evaluation. The importer withheld **5,780** ULT coordinates for ambiguous original occurrence, **12,283** Berean coordinates for a witness sequence or identity mismatch, and **2,570** Berean coordinates for a token-count mismatch. Additional English markup, supplied-word, and alignment disposition counts are in the [publication inventory](shell-85-alignment-publication.json). These figures describe screening decisions at different stages.

## Contextual definitions and priority forms

**480 of 500** priority forms now have at least one verified occurrence. The newly covered form is *king’s*. Three KJV selections carry verified, distinct definitions. In Acts 12:20 the first denotes the person whose chamberlain Blastus was, and the second denotes territory under Herod's rule. Hebrews 11:23 refers to the Egyptian ruler's order. The definitions depend on the selected English position and verified source morphology. [Acts 12 source commentary](https://bible.org/sites/bible.org/resources/download/netbible/ondemand/bybook/act.pdf)

Verified contextual definitions cover 753 aligned edition-occurrences, up from 688. Additional passage rules cover *charity* in 1 Corinthians 13, *bishop* in Titus 1:7 and *bowels* and *fellowlabourer* in Philemon. The English usage explanations remain available for *king’s* and the seven contractions. Those labels remain distinct from verified Scripture-context senses and general or historical dictionary entries.

The 20 pending forms are *don't, says, didn't, brothers, doesn't, comes, listen, today, everyone, won't, does, whoever, show, can't, let's, loving, families, news, isn't,* and *whatever*. Their candidate occurrences were included in the edition-wide scans. A unique spelling alone does not settle a pronoun, possessive or the scope of an English contraction. Remaining evidence needs include an exact clause for the contraction, and a positional source attesting the same lexical or grammatical role for the other forms.

## WEB complete-book review and translation witnesses

The complete-book WEB packets for Ruth, Philemon, Jonah and Genesis remain frozen, along with all **33 independent evaluation passages**. The earlier **2,318** prioritized unresolved WEB occurrences remain in the review inventory. A reviewer receives the exact edition text, ordered witness and a blind packet, records every proposed English range and native index with reasons, and submits a second independently reviewed adjudication for import. Existing advisory hints remain separate. This milestone received no new independent linguistic submissions. [Complete-book review process](shell-84-word-study.md#complete-book-review)

The Clementine and EOTC witness preparation tool builds reusable offline review packets with exact English, ordered source tokens, nearby source references and explicit boundary mismatches. The five packets cover **25 Philemon, 25 Jude, and 298 Tobit** Douay-Rheims coordinate candidates, **nine** in 1 Enoch chapter 1, and **27** in Jubilees chapter 1. Two Jubilees English lines have no matching numeric Ge’ez coordinate. Matching coordinates still await reviewer attestation of the English-to-witness relationship. Latin is a translation witness.

Urevangelium identifies Clementine and Douay-Rheims Gospel editions and reports 32,288 internal span objects. Its methodology explicitly distinguishes that work from independent scholarly review, and no reusable, appropriately licensed span export was established. The printed EOTC Ge’ez 1 Enoch and Jubilees texts are available with attribution, but the installed Charles English editions need textual reconciliation and position evidence. These pilots add **zero** runtime Latin and Ge’ez groups. Douay-Rheims’ Greek and Hebrew runtime evidence stays in its own edition, and the standalone Ethiopian Reader keeps its reading and offline experience. [Urevangelium sources and rules](https://urevangelium.com/FourGospels/sources) · [EOTC source and licensing](https://biblesrc.org/sources) · [Review packet digests](shell-85-translation-witness-review.json)

## Reproduction and performance

Independent repeats reproduced all 652 alignment files byte for byte and reproduced the five witness packets. The edition-specific overlays are partitioned by chapter. They share compatible sequences in a chapter, load only on word selection, and use the existing 48-entry persistent budget with six catalog indexes protected from eviction. The extension index is **24,398 bytes raw / 5,711 bytes gzip**. All **1,863,421 raw bytes** in the extension catalog total **664,782 bytes** with each file compressed separately. The browser measured **290,674 decoded startup JavaScript bytes across 22 scripts**, within the 290,914-byte budget. The new runtime preview smoke observed zero alignment requests before selection, even after navigation and offline retention setup. Licensing and pinned CrossWire, Scrivener, Berean and unfoldingWord inputs are in the [data notice](../data/word-study/alignment/extensions/NOTICE.md) and [publication inventory](shell-85-alignment-publication.json).

Run the importer with fresh output directories.

```text
node tools/import-word-study-extensions.js <CrossWire OSIS> <Scrivener JSON> <Scrivener notice> <ULT v92> <UHB> <UGNT> <Berean TSV> <new output> <publication report>
node tools/audit-word-study-corpus.js <coverage report>
python -B tools/prepare-translation-witness-review.py <Clementine USFX> <1 Enoch TEI> <Jubilees TEI> <new output>
```

## Validation and Android acceptance

| Check | Result |
| --- | --- |
| Unit checks, including every generated extension row | 523 passed |
| Focused Chromium | 155 cases passed across the main run, isolated replays and the new two-occurrence test. |
| Upgrade fixtures | 26 passed across two runs. |
| Additional PWA checks | 10 passed |
| Asset and Ethiopian education static checks | Passed |
| Local 390px smoke | Scrivener label, second-person future, distinct *king’s* definitions, full offline reload, focus return and zero startup alignment requests passed. |

The focused main run passed 151 of 154 cases. The existing cached WEB assertion needed the new lazy index in its exact cache inventory. Two additional cases reached the existing 20-second limit when the historical upgrade run was also active. Their snapshots reached Reader initialization or the first selection. The cache assertion and both timeouts passed an isolated replay with the same deadlines. WEB John 1:1 passed in the main run. The 320px dark-theme checks passed.

The primary run (shell85-upgrade.log) passed 21 upgrade cases, including all 11 Shell 84-to-85 cases and 10 historical asset checks. The supplemental run (shell85-additional.log) passed five additional upgrade cases, comprising 320px activation from Shells 74, 78 and 82 and cached Word Study reloads from Shells 80 and 82. Its five Ethiopian Reader checks are separate from the 26 upgrade checks.

The automated 390px smoke passed locally. Network access blocked the automated smoke on the hosted build.

### Hosted physical Android and TalkBack acceptance

All three checks passed on November 27, 2026, on the [Shell 85 Cloudflare preview](https://233de653.god4-us.pages.dev/#companion) at commit `170063fcbb98fb7222202194ff986527032adef4`.

| Passage and selection | Result |
| --- | --- |
| KJV Philemon 1:12, *bowels* | Pass |
| KJV Philemon 1:21, *wilt* | Pass |
| KJV Acts 12:20, *king's* | Pass |

Bible-wide verified alignment remains a release blocker. KJV still has 605 New Testament verses with no verified groups and 21,365 Old Testament verses with no verified groups. The next substantial milestone is a cross-verse witness path with explicit positional and editorial-word decisions, together with adjudication of complete short-book WEB, Latin and Ge’ez packets. Priority contractions need compound selection and verified scope evidence.
