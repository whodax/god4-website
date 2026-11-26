# Shell 80 Word Study

Shell 80 adds WEB alignment from independent Clear.Bible and unfoldingWord annotations. Shell 79, commit `ea6902a18f4f4f65e3a434b84f516484a51dfef1`, passed all 12 owner-reported physical Android and TalkBack checks. The [Shell 79 acceptance record](shell-79-word-study.md) lists those results. Shell 80 is an engineering and physical-device review candidate for [draft PR #131](https://github.com/whodax/god4-website/pull/131).

## Verified coverage

| Measure | Shell 79 | Shell 80 | Change |
| --- | ---: | ---: | ---: |
| WEB verses with at least one verified group, out of 31,098 | 385 (1.238%) | 913 (2.936%) | +528 |
| WEB word occurrences aligned, out of 752,223 | 1,964 (0.261%) | 3,131 (0.416%) | +1,167 |
| KJV NT verses with a verified group | 5,933 | 5,933 | 0 |
| KJV NT word occurrences aligned | 124,702 | 124,702 | 0 |
| Priority forms with verified evidence somewhere in the Reader | 473 of 500 | 475 of 500 | +2 |

The 528 previously unaligned WEB verses added 723 groups across 33 books. Hebrew accounts for 524 verses, 1,161 words and 717 groups. Greek accounts for four verses, six words and six groups. The [generated report](shell-80-web-alignment-report.json) gives all book counts, added word-form counts and output checksums. Each existing WEB verse entry was preserved in full, including the Jonathan group identified in the held-out comparison in 1 Samuel 14:21. The current builder adds only previously unaligned verses. Verified coverage of a verse can consist of one phrase.

## Source and position validation

| Clear.Bible package | Actual books | Raw verses | Same reference | Validated verses | Rejected verses | Ambiguous verses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WLCM–BSB manual | 39 OT | 23,144 | 23,010 | 13,236 | 9,774 | 0 |
| SBLGNT–BSB manual | 27 NT | 7,921 | 7,920 | 57 | 7,863 | 0 |
| BGNT–BSB manual | 27 NT | 7,941 | 7,937 | 37 | 7,899 | 1 |

| Package | Raw groups | Available after witness screen | Rejected | Ambiguous | Missing usable reference |
| --- | ---: | ---: | ---: | ---: | ---: |
| WLCM | 270,398 | 142,483 | 126,388 | 0 | 1,527 |
| SBLGNT | 115,008 | 524 | 114,464 | 0 | 20 |
| BGNT | 115,992 | 366 | 115,543 | 17 | 66 |

These screens count original and target position compatibility before English projection and independent agreement. The complete [WLCM](shell-80-clear-wlcm.json), [SBLGNT](shell-80-clear-sblgnt.json) and [BGNT](shell-80-clear-bgnt.json) reports include book and word-form counts, explicit rejection reasons and held-out comparisons. The disparity in available Hebrew and Greek reflects conservative comparison against the app's original-language editions, including the Byzantine Greek text. It does not measure source accuracy.

- The WLCM metadata labels the scope NT and names WLC. Its manual BiblioNexus JSON declares WLCM morpheme positions and its records cover the 39 OT books. The ordered source TSV contains 469,476 morphemes with populated POS classes and empty morphology fields. The importer validates the ordered words and their explicit morpheme IDs against exact spelling, segmentation, lexical identity and POS in UHB. Full morphology comes from the ordered UHB and Reader witnesses. References bridged or remapped in the BSB target fail validation. This accounts for 1,834 of the WLCM verse rejections.
- The independently produced SBLGNT package identifies original Greek word positions, which must match the ULT witness and Reader positions, spelling, identity and compatible morphology for the whole verse. The BGNT package's companion identifier incorrectly names SBLGNT. Its JSON and original TSV establish BGNT positions and credit the Berean team. BGNT remains a research control because it cannot independently corroborate its own publisher's tables.
- The importer reconstructs exact English from the matching package's pinned BSB token TSV, including punctuation and spacing. Under the audit's reconstruction rules the package English matched the publisher table wording exactly at 7,567 of 21,176 comparable WLCM references, 744 of 7,921 SBLGNT references and 747 of 7,940 BGNT references. Differences include formatting and supplied-text conventions. The same edition label is insufficient to transfer positions.
- The vetted Clear and ULT groups must link identical edges in the same Reader original positions and meet the Shell 79 exact local English frame, uniqueness and order checks. Incomplete morpheme or graph groups, inconsistent adjacent links, repeats, quoted boundaries, supplied words, grammatical differences, and negation or exception scope all fail closed. The importer carries exclusions across the full connected component. One known lexical identifier by itself cannot establish a position.
- The MACULA WLC tree contains 930 chapter or ancillary lowfat XML files. Its main WLC TSV is an 84,382,719-byte Git LFS object with SHA-256 `965cb0599beed2fe31283b615bcc369178141c0e718a66d97518d94309cfc124`. The audit inspected the repository inventory and six chapter XML files. The MACULA SBLGNT TSV contains 137,741 token rows over 7,939 references in 27 books. It supplies positional morphology, syntax and English glosses. Neither inspected MACULA representation establishes explicit WEB English span positions. Both are useful as additional linguistic witnesses. [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew) · [MACULA Greek](https://github.com/Clear-Bible/macula-greek)

## Projected coverage by method

Counts are verse references and matched word occurrences. New counts exclude every verse already present in the complete Shell 79 baseline.

| Projection | WLCM | SBLGNT | BGNT control | New WLCM + SBLGNT |
| --- | ---: | ---: | ---: | ---: |
| Clear exact verse or unchanged sentence | 321 / 2,548 | 3 / 36 | 5 / 56 | 109 / 909 |
| Clear-only exact phrase | 6,479 / 28,500 | 35 / 145 | 21 / 113 | 6,243 / 27,227 |
| Clear + ULT positional agreement | 609 / 1,343 | 17 / 44 | 10 / 32 | **528 / 1,167** |
| Clear + ULT + publisher Berean tables | 72 / 133 | 13 / 23 | 6 / 14 | 0 / 0 |

Only the independent Clear + ULT result is published. The two BGNT-only new candidates and the single-source bounds stay outside runtime data. Requiring the existing publisher tables as a third witness corroborates earlier groups and adds no previously uncovered verse. Shell 79's ULT and Berean agreement added 73 verses and 135 words. These figures are from different baseline exclusions and witness pairings.

The table below shows broader English wording compatibility with package BSB, counted by unique matching verse or sentence after the audit's punctuation normalization. A verse can occur in both columns. This screen runs before position or morphology checks. It cannot establish alignments for these editions.

| Reader edition | WLCM exact verse / with matching sentence | SBLGNT exact verse / with matching sentence |
| --- | ---: | ---: |
| WEB | 219 / 201 | 43 / 94 |
| ASV | 65 / 24 | 12 / 15 |
| KJV | 24 / 15 | 4 / 11 |
| YLT | 28 / 2 | 1 / 0 |
| DBY | 50 / 30 | 4 / 14 |
| Webster | 32 / 12 | 6 / 11 |
| RV | 27 / 29 | 19 / 15 |
| GNV | 5 / 1 | 0 / 0 |
| Douay-Rheims | 0 / 10 | 4 / 15 |

The Clear BSB packages have no tokenized target for the standalone Ethiopian collection and do not cover deuterocanonical books. The edition reports contain comparable controls for BGNT. All nine Reader editions and the standalone collection remain available.

## Independently sourced review and contextual definitions

The held-out set is the overlap of existing Shell 79 ULT plus Berean phrase groups with the separately produced Clear human alignment layers after source validation. It spans Hebrew and Greek and retains all comparable groups. Of 78 comparisons, the Hebrew result had 59 exact groups and one partial overlap. The Greek result had 18 exact groups. In the partial overlap, Clear linked only “Jonathan” in 1 Samuel 14:21 where Shell 79 links “and Jonathan” to the same original word. The prior group remains unchanged. BGNT agrees on 11 additional comparisons as a publisher-related control. This sample is selected by source overlap and strict compatibility. It gives no corpus-wide error rate. Fresh external human adjudication of the new WEB groups remains pending.

The inspection of new samples included the Hebrew noun and Hebrew preposition both rendered “around,” the possessive “my tent,” and Greek conjunction, preposition and pronoun cases. MACULA Hebrew independently labels the “around” word in Job 19:12 as a noun and the “around” word in Proverbs 6:21 as a preposition. In Job 19:12 it marks the stem of the tent expression as a construct noun. This corroborates morphology. Publishing still requires independent Clear and ULT agreement on English spans and original positions.

| Priority form | WLCM + SBLGNT Clear-only phrase occurrences | Independently verified occurrences |
| --- | ---: | ---: |
| Moab | 21 | 0 |
| Philistines | 25 | 0 |
| tent | 23 | 1 |
| king's | 15 | 0 |
| comes | 5 | 0 |
| listen | 6 | 0 |
| show | 2 | 0 |
| spoke | 26 | 0 |
| around | 13 | 2 |

Shell 79's 13 single-source leads were rescreened alongside all 27 open forms. The report retains counts for each form, including the rejected contractions and negations. The 25 remaining forms are `don't`, `says`, `didn't`, `spoke`, `brothers`, `doesn't`, `comes`, `listen`, `today`, `king's`, `everyone`, `won't`, `does`, `philistines`, `whoever`, `show`, `can't`, `inhabitants`, `let's`, `loving`, `families`, `news`, `moab`, `isn't` and `whatever`. Verified evidence for a form covers only its documented occurrences and senses.

Job 19:12 now explains “tent” as a portable shelter in Job's image of troops surrounding his dwelling. The two contextual uses of “around” distinguish encampment from something tied about the neck. Each definition requires the verified alignment source, original identity and exact occurrence. English Scripture is unmodified. General modern dictionary definitions and historical fallback definitions keep their separate labels and lookup behavior.

## Sources and reproduction

- Clear.Bible [pinned upstream tree](https://github.com/Clear-Bible/Alignments/tree/c99bd0ae6946775f932517656308ca19fc706921), revision `c99bd0ae6946775f932517656308ca19fc706921`, provides the alignment layer under CC BY 4.0. Source text and licensing are documented separately. The [SHA-256 manifest](../tools/clear-bible-shell80-sources.json) pins all three alignment JSON/TOML pairs and five ordered TSVs. The [data notice](../data/word-study/alignment/web/NOTICE.md) credits BiblioNexus, Clear.Bible, the source text projects and the Berean publisher. Generated WEB shards remain CC BY-SA 4.0 as required by the ULT evidence. Raw Clear.Bible files are outside the site.
- Prior ULT v92, UHB, UGNT and publisher BSB SHA-256 pins remain in version control. Authenticity is checked before conversion. [Shell 79 provenance](shell-79-word-study.md)
- [MACULA Hebrew revision](https://github.com/Clear-Bible/macula-hebrew/tree/47db250bd55d0d8577f2a94fba114ef16c35b23c) and [MACULA Greek revision](https://github.com/Clear-Bible/macula-greek/tree/8423afe47b9e8f24b7772e808af45c7159a6fe7e) were inspected under their layer-specific attribution terms. No MACULA data shipped. The Greek SBLGNT audit TSV SHA-256 is `7f71504fdee8659bdd9f85342e4103d645864c2851b8205915bb298f0c004cc5`.

```text
node tools/audit-clear-bible-alignment.js <WLCM|SBLGNT|BGNT> <clear-dir> <ULT-v92> <UHB> <UGNT> <publisher-BSB.tsv> <Shell79-data> <audit.json> <candidate.json>
node tools/build-shell80-alignment.js <Shell79-data> <WLCM-candidate> <WLCM-report> <SBLGNT-candidate> <SBLGNT-report> <fresh-output> <report.json>
```

Name the Clear inputs `shell80-<filename>` using the filenames in the SHA-256 manifest. At the pinned Clear revision the manifests and graph records are under `data/eng/alignments/BSB`, original TSVs under `data/sources`, and BSB TSVs under `data/eng/targets/BSB`. The builder checks the pinned Shell 79 byte hashes for every input shard, preserves all accepted verse rows, and composes only the dual-source WLCM and SBLGNT additions.

A second run produced byte-identical reports and candidate files for all three Clear packages, a byte-identical build report, and identical SHA-256 checksums across the 425 generated files.

## Performance and validation

The WEB index and 424 chapter shards occupy **555,937 bytes raw** or **265,935 bytes** gzip-compressed separately. The largest chapter shard is **8,583 bytes** raw. Startup JavaScript remains **290,674 of 290,914 bytes**. The index and chapters remain lazy. The 48-entry persistent cache and 16-entry in-page limit are unchanged.

All 489 unit checks passed, including the new validation and importer cases, the existing false-positive controls, and verification of the preserved Shell 79 rows. Asset validation confirmed metadata for all nine translations. Ethiopian education static checks passed. The focused browser suite is running with the existing deadlines.

## Remaining release blockers and next milestone

Bible-wide verified alignment remains a release blocker. WEB coverage is 2.936% of verse references and 0.416% of word occurrences. The untouched KJV investigation still includes 2,013 rejected and 11 ambiguous NT verses and the KJV OT. The remaining Reader editions, Catholic and Ethiopian material, and Bible-wide contextual definitions require their own evidence.

Create a versioned reference and token crosswalk for WEB and its actual source witnesses, then establish a directly reviewed WEB gold set stratified by testament, book, names, verbs, phrase size and negation. Prioritize Moab and the Philistines and give possessives, supplied words and negated clauses dedicated fixtures. Have independent reviewers adjudicate ambiguous boundaries against the exact WEB edition and document disagreement before promoting the importer. Reuse the same evaluation for other editions. The large gap between the single-source screen and independently verified output limits further gains from adding sources that target other English editions.
