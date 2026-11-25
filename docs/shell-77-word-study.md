# Shell 77 WEB Word Study alignment

Shell 77 builds on the owner-accepted [Shell 76](shell-76-word-study.md) at `e6e3198`. The 259 CrossWire chapter files, importer, source checksums, and audit remain in version control. The Reader retains **5,933 verified KJV New Testament verses and 124,702 matched word occurrences**, with the existing curated Acts 8:37 mapping taking precedence.

## Reader coverage

| WEB metric | Shell 76 | Shell 77 |
| --- | ---: | ---: |
| Verses with at least one verified match | 5 / 31,098 (0.0161%) | 61 / 31,098 (0.1962%) |
| Selectable occurrences with a verified match | 44 / 752,223 (0.0058%) | 448 / 752,223 (0.0596%) |
| Priority occurrences with a verified match | 40 / 611,729 (0.0065%) | 288 / 611,729 (0.0471%) |

The import accepted **57 verses**. The existing John 1:1 mapping still takes precedence, so the Reader gains **56 verses**, **404 word occurrences**, and **248 priority occurrences**. The five previously reviewed WEB mappings retain their existing behavior.

| Import coverage | Old Testament | New Testament | Total |
| --- | ---: | ---: | ---: |
| Nonempty GOD4.us WEB verses | 23,145 | 7,953 | 31,098 |
| Same-reference source candidates | 15,936 | 7,949 | 23,885 |
| Accepted | 47 | 10 | 57 |
| Rejected | 15,883 | 7,937 | 23,820 |
| Ambiguous | 6 | 2 | 8 |
| No matching source reference | 7,209 | 4 | 7,213 |
| Matched occurrences before precedence | 307 | 114 | 421 |

The importer rejected 23,550 candidates for English wording or punctuation, 230 for unsupported markup, 37 for original identity, position, surface or morphology, and three for missing or differently segmented original tokens. Six ambiguous candidates had unresolved original occurrence metadata, and two had unbalanced milestones. ULT v91 supplied aligned source books for 32 Old Testament and all 27 New Testament books. The seven absent books are Numbers, 1–2 Chronicles, Ecclesiastes, Isaiah, Jeremiah, and Ezekiel. The [machine-readable report](shell-77-web-alignment-report.json) records results and word-occurrence denominators for all 66 WEB books and hashes every generated file.

## Source and validation

The English input is the exact Protestant WEB distributed as `js/bible/web.js`. The [pinned source list](../tools/web-alignment-sources.json) records release URLs, commit IDs, archive hashes, and extracted-content hashes for ULT v91, UHB v3.0.0, and UGNT v0.34. The tagged English source is an independent translation with explicit alignments, and its manifest names the two original-language witnesses. The derivative dataset carries CC BY-SA 4.0 and includes [attribution, licensing and changes](../data/word-study/alignment/web/NOTICE.md). The installed WEB text and original-language corpora retain their existing sources.

The importer requires whole-verse English equality after normalizing whitespace and quotation-mark typography. It checks the independently ordered witness against GOD4.us for the complete verse, then resolves each explicit occurrence to its original position. A link must agree on source spelling, lemma, Strong's identity, and morphology. Hebrew and Aramaic compare consonants and vowel pointing, ignoring cantillation, meteg and display separators. Greek compares spelling without accents, case, elision marks and final-sigma typography, and uses a conservative map of equivalent morphology codes. Morphology distinctions encoded only by one source, such as the governed case on a preposition, are excluded from the cross-format comparison. Unsupported codes fail closed. Output retains the exact GOD4.us English text and original-language token surfaces. Shifted references, unsupported markup, unresolved repeated words, and English spans that split selectable words are excluded. Explicit one-to-one, many-to-one, one-to-many and many-to-many groups use the existing gold highlighting.

The importer takes extracted source directories. Its content hashes cover the alphabetically sorted USFM filenames and bytes plus the license and manifest, framed by null separators. The output directory must be fresh.

```text
node tools/import-web-alignment.js <ULT-directory> <UHB-directory> <UGNT-directory> <new-output-directory> <report.json>
```

## Context and open coverage

The source import verifies occurrences of **56 of the 500** priority forms. Each already had a verified match in one of the Reader editions, so the cross-edition total remains **467 of 500**. Shell 76 normalization across the nine translations and the previous contextual definitions carry forward. The new verified alignments enable three specifically labeled Scripture-context definitions for WEB `Lord` in Matthew 12:8, `light` in John 9:5, and `love` in 2 Peter 1:7. They require the original noun's identity and the matching verse language before they override a dictionary definition.

The 33 priority forms still awaiting verified occurrence evidence are `don't`, `its`, `says`, `david`, `didn't`, `spoke`, `brothers`, `forever`, `around`, `doesn't`, `comes`, `tent`, `listen`, `today`, `king's`, `everyone`, `won't`, `does`, `philistines`, `whoever`, `yourself`, `joshua`, `show`, `can't`, `inhabitants`, `let's`, `loving`, `ephraim`, `families`, `news`, `moab`, `isn't`, and `whatever`.

The unresolved inventory includes 2,013 rejected and 11 ambiguous KJV NT verses, KJV OT, the remaining Reader editions, Catholic and Ethiopian Scripture, and Bible-wide contextual definitions. The next WEB expansion needs edition-native, independently reviewed position data or a separately reviewed source with stronger exact English overlap. ASV is the next translation candidate after WEB because it is the basis for WEB and for the ULT text. It still requires a separate import and validation.

## Delivery and validation

The 19 chapter shards and the index total **22,370 bytes raw** or **8,869 bytes** gzip-compressed separately. The largest is **5,076 bytes raw**, and the maximum gzip size is **1,217 bytes**. A WEB Word Study interaction loads the index, then requests a chapter only when listed. Loaded shards can support another lookup in the same page after disconnecting. After an offline reload, the existing Word Study fallback applies. The shell still precaches 52 assets, with zero alignment-data downloads at startup. Startup JavaScript measured **290,674 bytes**, 240 bytes below the 290,914-byte budget.

The reproducibility run produced a byte-identical report and the same shard hashes. All **100 unit checks** passed, including the 93 existing Shell 76 unit checks. Asset validation and Ethiopian guide checks passed.

| Chromium run | Passed |
| --- | ---: |
| Focused Reader, Word Study, PWA and startup regression checks | 131 / 131 |
| Additional Shell 76-to-77 lifecycle and recovery cases | 8 / 8 |
| Ethiopian Reader, startup measurement and warmed offline alignment smoke tests | 9 / 9 |
| Historical 320px dark-theme picker fallback repetitions | 10 / 10 |

The upgrade tests include desktop and mobile viewports, another open tab during acceptance, failed or interrupted installation and retry, and a fully offline relaunch. The browser checks exercise exact Hebrew and Greek highlights, the accessible Close button and focus return, and the contextual definition for Matthew 12:8.

Physical Android and TalkBack acceptance for Shell 77 is pending. Bible-wide verified alignment remains a release blocker.
