# Bible-wide Word Study expansion investigation

The baseline is Shell 81, commit `13d94205e959d332645ba7f4cb2a4b7d3da9ea2a`. The [Shell 81 report](shell-81-word-study.md#physical-android-and-talkback-acceptance) records all eight physical checks passed on November 27, 2026. This milestone builds whole-book audit and review tools and measures two paths to substantially broader coverage. Shell 82 has no runtime release in this change.

## Results

| Area | Measured result | Publication state |
| --- | --- | --- |
| WEB existing alignment | 913 verses and 3,131 matched occurrences | Preserved |
| WEB unresolved pool | 24,271 need linguistic review and 1,803 remain ambiguous | 2,318 prioritized by positional publisher agreement |
| KJV New Testament existing alignment | 5,933 verses and 124,702 matched occurrences | Preserved |
| KJV New Testament alternative witness | 476 previously unresolved verses and 11,103 English word occurrences passed strict position checks against a pinned Textus Receptus edition | Engineering candidates |
| KJV Old Testament | 23,145 verse slots screened. The pinned OSIS file supplies no explicit native positions anywhere in the OT. | Requires a separate position evidence source |
| 500 priority forms | 475 with verified evidence | Preserved |

No new alignment or definition data was promoted. The exact English Scripture, alignment files, contextual definitions, crosswalks and all 33 held-out WEB evaluation cases remain intact. The study does not establish complete coverage for any word form or book.

## Strategy comparison

| Method | Coverage and evidence | Licensing and implementation |
| --- | --- | --- |
| Native edition alignment | The WEB publisher supplies the actual English edition used as the reference. The statistical WEB site reports links in all 66 Protestant books, but its own documentation describes an automated method. The KJV CrossWire module supplies usable native indexed NT tags. | WEB text is public domain. Verify an alignment export's provenance, edition and terms separately. CrossWire's module and source notices continue to apply. [WEB publisher](https://worldenglishbible.org/) · [WEB statistical layer](https://worldenglishbible.encyclopaediabiblica.com/alignment) · [CrossWire KJV 3.1](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV) |
| Human annotations across English editions | Clear.Bible manual graphs, ULT milestones and Berean tables provide native positional evidence for their own English editions. WEB transfer depends on exact local context and independently supported group boundaries. The new Clear/Berean comparison prioritizes part of the unresolved pool without certifying source independence. | Clear alignments CC BY 4.0, Clear tooling MIT, ULT pins retain CC BY-SA 4.0, and publisher Berean terms apply. Whole-book computation is repeatable with existing adapters. [Clear.Bible](https://github.com/Clear-Bible/Alignments) · [Shell 80 sources](shell-80-word-study.md#sources-and-reproduction) |
| Reference and token reconciliation | Numbering and manuscript-aware reconciliation prevents off-by-one and duplicate position matches. The WEB cohort already has same-reference original witnesses. Switching to the explicitly identified KJV witness for the engineering screen yields 476 strict fits. | Medium implementation complexity for stable crosswalks. KJV production would require an explicitly labeled witness, fallback rules, lazy files and regression protection across all Reader views. [Shell 81 crosswalk](shell-81-word-study.md#reference-and-token-crosswalk) · [Robinson's parsed Textus Receptus](https://github.com/byztxt/greektext-textus-receptus) |
| Morphology, syntax and semantics | MACULA and OSHB can distinguish affixes, roles and occurrence context, and STEPBible supplies expanded Hebrew and Greek tags. These can corroborate position and meaning while human reviewers handle Hebrew, Aramaic and Greek groups. | Layer-specific licensing matters. STEPBible publishes data under CC BY 4.0. MACULA includes data from multiple projects with their own notices. Reconciliation can be done by book, but these layers alone do not link WEB or KJV English to an original token. [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew) · [STEPBible data](https://stepbible.github.io/STEPBible-Data/) |
| Statistical and AI-assisted proposals | `fast_align` and Aquifer can propose links or flag implausible chapter results. A full book may yield many suggestions, including false links for supplied words, scope, repeats and paraphrase. The independent human holdout must remain outside proposal generation and tuning. | `fast_align` is Apache-2.0 and Aquifer code is MIT. Model and dataset terms still apply. Useful for proposal triage only. No model judgments become adjudication records. [fast_align](https://github.com/clab/fast_align) · [BibleAquifer text-align](https://github.com/BibleAquifer/text-align) |
| Whole-book human review | Edition-native review can address phrases, supplied words, negative constructions and unmatched coordinates in order. translationCore supports direct word linking, validation and aligned USFM export. The GOD4.us pilot has a simpler packet format based on exact Reader offsets and positions. | Reviewer effort is the main cost. Preserve dates, independence, artifact checksums, evidence and decisions. Exchange formats can be adapted separately to existing tools. [translationCore Align](https://translationcore.com/tc-help/al-open) |

Rejected as publication evidence on their own: Strong's identifiers, English wording similarity, the presence of an exact token at one address, statistical or model-generated links, and another edition's English alignment. The project can use them for leads and testing with their provenance retained.

## WEB whole-book review pilot

The new [book audit](../tools/audit-web-book-coverage.js) inventories all 66 WEB books and replays all 27,227 Shell 81 candidate occurrences. It checks that the prior status counts are identical, then compares the complete positional groups against Clear and the Berean publisher. It uses the existing exact-word, local-context and conservative original-position validators. The publisher comparison seeks evidence from two annotation layers that share a target edition. It cannot resolve uncertainties about shared editorial evidence or establish an independent WEB review.

| Group of occurrences | Count |
| --- | ---: |
| Previously verified in Shell 80 | 1,153 |
| Still requires linguistic review | 24,271 |
| Still ambiguous | 1,803 |
| Publisher agreement within the linguistic-review queue | 2,079 |
| Publisher agreement within the ambiguous queue | 239 |
| Total prioritized for review | 2,318 |
| Prioritized occurrences of a priority word form | 1,613 |
| Candidate occurrences excluded from publisher scoring to protect the holdout | 142 |

The 2,318 are a subset of the unresolved rows. In total, this prioritizes about **8.9%** of the 26,074 unresolved occurrences. It promotes zero. The largest review queues identified by publisher agreement include 1 Chronicles (301), Genesis (190), Jeremiah (170), 2 Chronicles (165), Exodus (149), Numbers (141) and Proverbs (139). These counts measure occurrences, including common function words. The [WEB audit data](shell-82-web-book-audit.json) gives the denominators and queue by book.

The pilot generates all verse slots for Ruth, Jonah, Philemon and Genesis, rather than selecting verses with convenient links. It writes a blinded review packet and a separate file of advisory hints. A single literary book exercises Hebrew inflection and names, a second Hebrew book tests portability, Philemon checks Greek and cases with zero earlier hints, and Genesis verifies chapter-scale volume and exclusion of held-out rows. The packets are generated locally through the reproducible command. Their hashes and sizes are recorded in the report.

| Pilot | Verse slots | Reserved holdout | Verses with advisory hints |
| --- | ---: | ---: | ---: |
| Ruth | 85 | 0 | 13 |
| Jonah | 48 | 0 | 5 |
| Philemon | 25 | 0 | 0 |
| Genesis | 1,533 | 3 | 472 |
| Total | 1,691 | 3 | 490 |

The tool retains the frozen holdout by Reader and original-source coordinates. Held-out records have only an ID, address and status. Review packets preserve exact text and original native token analyses for other rows and carry no proposals. Teams can use hints to prioritize later passes without exposing them to blind reviewers. The [book adjudicator](../tools/adjudicate-web-book.js) binds submissions to the exact packet hash, rejects withheld or foreign passage IDs and uses the existing two-reviewer and independent adjudicator rules. No human review was available in this run. The next measurable step is to complete an independently adjudicated short book and evaluate the separate 33-case set before changing verified WEB coverage.

## KJV New Testament and Old Testament

The [KJV audit](../tools/audit-kjv-expansion.js) replayed all 7,957 NT verses and reproduced all 5,933 accepts, 2,013 rejections and 11 ambiguous records. Checking Greek even when English fails exposes the underlying reasons. Against the currently installed original-language source, 1,855 records have an original-evidence mismatch, 108 have English wording differences even after the native checks pass, 39 have punctuation or supplied-word boundary differences, 11 lack unambiguous position metadata, and 11 have unsupported OSIS markup. Strict typography normalization recovered zero verses on this source. Treating punctuation or supplied-word differences as safe would change the verification rule.

The alternative test uses the same public-domain Robinson Textus Receptus revision already documented for GOD4.us's four explicit variant passages. The test reads and hashes all 27 pinned Greek files, parses complete verses and runs the unmodified CrossWire validator against that alternate witness and exact KJV Reader text. It checks word order, position ownership, spelling, Strong's identity, morphology, supplied-word boundaries and every token of the verse. No manuscript substitutions occurred in the Reader.

The result is **476 of 2,024 previously unresolved KJV NT verses** (23.5%), with **11,103 word occurrences**, including **8,670 priority occurrences**. The full alternate audit counts 1,090 position, surface or identity mismatches, 192 morphology mismatches, 187 English boundary or wording mismatches, 59 unavailable or unparsed TR references, 11 unsupported OSIS records, six ambiguous position-metadata records and three incomplete sequences. Largest strict-fit counts were Revelation (77), Luke (67), John (67), Acts (67), Matthew (63) and Mark (52).

The candidate set is substantial enough to justify a separately labeled KJV witness path. CrossWire and the parsed text share Robinson provenance. The audit demonstrates positional compatibility with that edition rather than independent annotation agreement. Before publication, preserve the existing overrides and verify edition selection and original token rendering across Reader, Compare and offline Word Study, especially manuscript gaps and differing verse order. The [KJV audit data](shell-82-kjv-witness-audit.json) contains per-book counts and file SHA-256 values.

For KJV OT, the pinned OSIS has **zero** native position tags and the accepted original witness is missing one verse slot. The diagnostic sees 186,475 tag references with one matching Strong's identity in the verse, 40,933 with repeated matches and 1,431 with no match. These are tag occurrences, not verified English alignments. A single lexicon-number match also lacks morpheme and span evidence. Scalable OT work should combine exact King James tokens and OSHB or STEPBible coordinates with whole-book human alignment, using the CrossWire tags only as review leads. The alternate modern CrossWire TR module has a noncommercial share-alike license and was unnecessary for this audit. [CrossWire TR license](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TR)

## Reproduction and release status

```text
node tools/audit-kjv-expansion.js <pinned-KJV-OSIS> <audit.json> <Robinson-TR-repository>
node tools/audit-web-book-coverage.js <Clear-directory> <ULT-v92> <UHB> <UGNT> <publisher-BSB.tsv> <Shell79-shards> <fresh-output-directory> ruth jonah philemon genesis
node tools/adjudicate-web-book.js <frozen-review-packet.json> <submissions.json> <reviewer-ids.json>
```

The first two commands use the accepted source pins. The KJV experiment loads revision `33af6e9361f8db0afd353714d05c75f44e5555b9` from the supplied original-language repository, regardless of its working-tree branch. CrossWire checksums are fail-closed. WEB imports keep the Shell 79 and Shell 80 checksum checks. Review submissions contain `bookId`, `reviewPacketSha256`, and `passages` keyed by packet ID with signed-off human `reviews` and any separate `resolution`, using the existing [Shell 81 review schema](shell-81-word-study.md#review-dataset-and-independent-evaluation). Keep reviewer contact details outside version control. The reports contain no reviewer identities.

The WEB report and eight pilot files reproduced byte for byte in a second run, as did the complete KJV witness report. All 504 unit tests passed, including six new tests of offset boundaries, original positions, protected review cases and packet intake. Asset and Ethiopian education validation passed. The accepted Shell 81 browser suite remains the runtime baseline.

The work is engineering-only. Bible data, design files, application JavaScript, service worker and tests from the accepted release remain intact. The Shell 81 measured startup remains 290,674 bytes within the 290,914-byte budget. Bible-wide verified alignment remains a release blocker. The next substantial runtime milestone should integrate and test an explicit KJV witness path and use independently reviewed book results to determine which WEB groups are ready to publish.
