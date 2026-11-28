# Shell 78 WEB alignment expansion

Shell 78 starts at the owner-accepted [Shell 77](shell-77-word-study.md), commit `2e82e2c59bedb1398c566bdc7f62d8d6e31bd6c2`. All 11 physical Android and TalkBack checks passed on that preview. Shell 78 is a preview candidate for engineering and device acceptance.

## Reader coverage

| Metric | Shell 77 | Shell 78 |
| --- | ---: | ---: |
| WEB verses with at least one verified match | 61 / 31,098 (0.196%) | 312 / 31,098 (1.003%) |
| WEB word occurrences with a verified match | 448 / 752,223 (0.060%) | 1,829 / 752,223 (0.243%) |
| WEB priority occurrences with a verified match | 288 / 611,729 (0.047%) | 1,065 / 611,729 (0.174%) |
| Priority forms with any match across editions | 467 / 500 | 473 / 500 |

The **251 new verses** comprise 250 Old Testament verses and one New Testament verse. They add **1,381 matched occurrences**, including 777 priority occurrences across 155 forms. Shell 78 retains all prior reviewed WEB mappings and the existing **5,933 KJV New Testament verses and 124,702 KJV word occurrences**. The six newly verified priority forms are `david`, `joshua`, `its`, `yourself`, `forever`, and `ephraim`. The new contextual definitions distinguish Joshua son of Nun in 1 Chronicles 7:27 and Ephraim as a tribal name for the northern kingdom in Hosea 5:9. Both require the exact verse context, verified alignment, Hebrew identity, and proper-noun morphology.

## Source screening and results

| Source | Old Testament / New Testament suitability | Decision |
| --- | --- | --- |
| eBible Protestant WEB | The official USFM contains 645,750 tagged English words across 66 canonical books. All use a Strong's ID only. It contains zero alignment milestones, source positions, or morphology attributes on these tags. The Genesis 1:1 tag on “God” is H8064, the identifier for “heavens.” | Use the checked-in Reader edition for exact English spans. Exclude the publisher's Strong's-only tags from verified alignment. |
| ASV 1901 / OpenBible | WEB modernized the ASV. The checked-in editions yielded 389 OT and 102 NT whole-verse English matches, plus 211 OT and 63 NT unchanged-sentence candidates. WEB also follows the Byzantine Majority Text at some NT variants. OpenBible's ASV project uses AI-generated alignment with maintainer review and a reconstructed ASV witness. | These are English-only screening counts. The ASV alignments remain research candidates pending stronger independent occurrence-level review. |
| ULT v92 | Explicit source-language occurrence milestones. The release adds Numbers and Ecclesiastes, giving 34 OT and 27 NT books. Its aligned original-language witnesses are UHB 3.0.0 and UGNT 0.34. | Verified 82 verses at the source level. Existing Shell 77 rows take precedence. |
| Berean Standard Bible third-printing tables | Publisher word-position tables for all 66 books, with WLC Hebrew and Aramaic and a Nestle-based Greek layer. English screening using the publisher's reference labels found 224 OT and 18 NT full-verse matches plus 178 OT and 35 NT sentence candidates. | The final import passed 261 verses before precedence. Full original-sequence agreement and per-group compatible morphology are mandatory. |

Sources and terms are available from the [WEB preface](https://ebible.org/study/content/texts/engwebp/FR0.html), [WEB downloads](https://ebible.org/find/details.php?id=engwebp), [OpenBible ASV dataset](https://github.com/openbibleinfo/American-Standard-Version-Bible-Alignment-Data), [ULT archive](https://git.door43.org/unfoldingWord/en_ult/archive/v92.zip), [Berean downloads](https://berean.bible/downloads.htm), and [Berean terms](https://berean.bible/terms.htm).

| Import result | Shell 77 ULT v91 | Shell 78 ULT v92 | Shell 78 Berean |
| --- | ---: | ---: | ---: |
| Accepted before precedence | 57 | 82 | 261 |
| Rejected | 23,820 | 25,264 | 30,833 |
| Ambiguous | 8 | 55 | 0 |
| No same-reference source | 7,213 | 5,697 | 4 |

Of the 7,213 references missing in Shell 77, ULT v92 supplies 1,516 same-reference candidates and the Berean tables supply 7,209. **110** previously missing references gained verified highlights. The Berean table supplies candidates across all seven previously absent books. Newly matched verses by book are Numbers 1, 1 Chronicles 79, 2 Chronicles 6, Ecclesiastes 1, Isaiah 8, Jeremiah 4, and Ezekiel 11. Four Berean reference gaps remain at Romans 14:24–26 and 2 Corinthians 13:14. The [machine-readable report](shell-78-web-alignment-report.json) records per-book results, rejected categories, new priority-form occurrence counts, and every emitted asset hash. Its accepted source totals overlap. After precedence, the 251 new Reader verses comprise 151 Berean whole verses, 75 Berean sentence matches, and 25 ULT sentence matches.

## Projection rules

The importer first looks for full-verse equality with only existing quotation and whitespace normalization. It separately permits an optional final full stop on otherwise identical English, with no resulting gain in this run. A partial match requires an unchanged, punctuation-delimited sentence of at least five selectable words. The sentence must occur exactly once in each verse, and matched sentences must retain their order. Any group or shared original token crossing outside that matched sentence is excluded. Spans are recomputed against the actual WEB source text. Internal punctuation changes, repeated or reordered evidence, and supplied words do not produce matches.

ULT milestones are resolved against the entire independent ordered witness and checked for exact source form, lemma, identity, morphology, and occurrence. The Berean adapter separately checks every original token's order, spelling and Strong identity against both the independent witness and GOD4.us, and requires a documented supported morphology mapping on each published group. For proper names the morphologies agree on proper-noun class and encoded affixes. UHB does not supply explicit gender and number for that class. Unsupported morphology stays unhighlighted. Berean rows with supplied-word brackets stay unhighlighted as a whole. All rows revalidate against the live English text and original tokens before the existing gold highlighting renders.

## Reproduction and license

The [ULT v92 pin](../tools/web-alignment-v92-source.json) gives the exact revision, archive and extracted-content SHA-256. [Shell 77 pins](../tools/web-alignment-sources.json) retain ULT v91, UHB 3.0.0 and UGNT 0.34. The [Berean TSV](https://bereanbible.com/bsb_tables.tsv) is pinned to SHA-256 `aa2a9a0f004d015738cd1839c7c56c3be2549e0d4f4537090c2017268c223c60`. The [distribution notice](../data/word-study/alignment/web/NOTICE.md) retains CC BY-SA 4.0 attribution for the alignment collection and credits the publicly released Berean tables. The raw inputs are source downloads.

```text
node tools/import-web-alignment.js <ULT-v91-dir> <UHB-dir> <UGNT-dir> <fresh-shell77-output> <shell77-report.json>
node tools/import-web-alignment.js <ULT-v92-dir> <UHB-dir> <UGNT-dir> <fresh-shell78-output> <shell78-report.json> --expanded <Berean-TSV> <shell77-output>
```

The second run verifies all Shell 77 baseline shard hashes before copying original rows into the new output. Established inline alignments retain precedence.

The screened publisher WEB USFM archive SHA-256 is `a78b49d0faf717d128ff95ed89c237722197eaf70ba4f0c169d708795a43964d`. It supplies research evidence only and is separate from the generated data.

## Delivery, validation and release status

The new collection includes 149 chapter shards and one index, totaling **164,581 bytes raw** or **78,194 bytes** gzip-compressed separately. The largest raw file is **8,583 bytes**. On-demand alignment and original-language chapter files may persist in a separate 48-entry service-worker cache. The worker tries the network first and uses previously loaded data after a network failure. A cold or evicted chapter still has the existing local lookup fallback. The cache keeps the WEB index and evicts older chapter entries. The shell precache remains 52 assets. Startup JavaScript remains **290,674 bytes**, with zero alignment-data downloads at startup.

All 103 unit checks passed. Both Shell 77 and Shell 78 imports reproduced the same reports and shard hashes. Chromium verified that Numbers 32:3 retains its Hebrew highlight after a full offline reload on the installed Shell 78. Ten historical 320px dark-theme fallback repetitions passed. The full engineering and device acceptance status is tracked on [PR #131](https://github.com/whodax/god4-website/pull/131).

## Physical Android and TalkBack acceptance

The owner reported all **11 checks passed** on the Shell 78 preview `8108a1a6`, commit `eea5c23eede2afb9495f18334b78c66815506db9`.

| Check | Result |
| --- | --- |
| WEB Numbers 32:3, Dibon | Pass |
| WEB Hosea 5:9, Ephraim | Pass |
| WEB 1 Chronicles 7:27, Joshua | Pass |
| WEB Genesis 1:1, created | Pass |
| KJV John 1:1, Word | Pass |
| KJV Acts 8:37, Christ | Pass |
| Dark theme | Pass |
| Close Word Study | Pass |
| TalkBack | Pass |
| Full offline reload | Pass |
| Ethiopian Read Aloud | Pass |

Bible-wide verified alignment remains a release blocker. The remaining 27 priority forms, most WEB verses, 2,013 rejected and 11 ambiguous KJV NT verses, KJV OT, the other Reader editions, Catholic and Ethiopian Scripture, and Bible-wide contextual definitions remain open.
