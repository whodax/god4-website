# GOD4.us Shell 76 Word Study candidate

Shell 76 builds on the [accepted Shell 75 audit](shell-75-word-study-audit.md) at `08ae6aeded6182ca140165c8f17fd0a35d317e0b`. The report and audit script are versioned. The original audit script measures the inline catalog and can be copied into a checkout of Shell 75 to reproduce that baseline.

## Physical Android and TalkBack acceptance

The owner reported **8 of 8 checks passed** for Shell 76, commit `e6e3198`, on November 25, 2026.

| Check | Result |
| --- | --- |
| KJV John 1:1 | Pass |
| KJV John 1:3 | Pass |
| KJV Acts 8:37 | Pass |
| WEB curly-apostrophe contraction | Pass |
| Close Word Study | Pass |
| Dark theme | Pass |
| TalkBack | Pass |
| Offline | Pass |

## CrossWire source and validation

The input is CrossWire's KJV SWORD module **3.1**, using the OSIS and configuration from Git revision `d490be7e34762deb2c76cb2c1306d4808e27890d`. The OSIS SHA-256 is `4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5`. CrossWire credits the Bible Foundation, KJV2003 volunteers and Maurice Robinson. Its configuration records GPL distribution for the module, grants broad use of the tagging work, and identifies Crown rights in the base English text. The generated data is accompanied by the pinned source links, transformation recipe, source notices, and checksums. [Publisher notice](https://ftp.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV) · [Pinned source](https://gitlab.com/crosswire-bible-society/kjv/-/raw/d490be7e34762deb2c76cb2c1306d4808e27890d/kjv.osis.xml) · [Pinned licensing configuration](https://gitlab.com/crosswire-bible-society/kjv/-/raw/d490be7e34762deb2c76cb2c1306d4808e27890d/kjv.conf)

The importer reconstructs each English verse from OSIS, including punctuation and supplied-word boundaries. It requires exact equality with the Scripture displayed by the KJV Reader and checks that spans preserve selectable word boundaries. For each explicit one-based Greek position, it requires matching verse identity, position, surface form, Strong's ID and morphology. Case, accents and the form of sigma are normalized for the Greek surface comparison. The full ordered Greek sequence must be accounted for. Explicit CrossWire split tags can produce several English spans for the same Greek group. Imported rows store exact Reader text and Greek token identities for revalidation at lookup time. Established reviewed mappings retain precedence, including the four-word Greek group in Acts 8:37.

The [import report](shell-76-crosswire-import.json) includes every book's counts, rejects by reason and the raw byte count and SHA-256 of every chapter. Generate a fresh output with:

```powershell
node tools/import-crosswire-kjv-alignment.js <pinned-osis.xml> <fresh-directory>
```

## Coverage

| Metric | Shell 75 | Shell 76 |
| --- | ---: | ---: |
| KJV NT verse locations with any verified match | 1 / 7,957 (0.01%) | 5,933 / 7,957 (74.56%) |
| KJV NT aligned word occurrences | 25 / 180,488 (0.01%) | 124,702 / 180,488 (69.09%) |
| KJV aligned word occurrences | 25 / 790,769 (0.00316%) | 124,702 / 790,769 (15.77%) |
| Aligned word occurrences across nine editions | 69 / 7,141,368 (0.00097%) | 124,746 / 7,141,368 (1.75%) |
| KJV priority occurrences matched | 19 / 602,062 (0.00316%) | 95,194 / 602,062 (15.81%) |
| Priority occurrences matched across nine editions | 59 / 5,384,112 (0.00110%) | 95,234 / 5,384,112 (1.77%) |

The import accepted **5,933** verses, rejected **2,013**, and identified **11** as ambiguous. The Shell 75 preliminary check reproduced exactly **6,371** candidates. The stricter pass accepted **5,932** of those, rejected **434**, and marked **5** ambiguous. It accepted **one** additional verse where the earlier screening missed valid markup. For all 7,957 NT verse locations, 1,486 failed position, surface or Strong's ID checks, 314 differed in morphology, 189 differed in English text or supplied words, 13 had an incomplete Greek sequence, and 11 had unsupported markup. The other 11 lacked unambiguous position evidence.

New data covers **466 of the 500 priority forms** in KJV. Across all nine editions, coverage rises from **33 to 467 forms** with at least one verified match. These are occurrence-based alignments. A form present in an accepted verse can still be unmatched elsewhere. The generated dataset has 124,704 KJV matches and 95,196 priority matches. Live totals remove two matches at Acts 8:37 because the existing explicitly reviewed grouping takes precedence. Chapter files cover all 27 NT books. For each of the 39 OT books, aligned occurrence coverage is zero. The report records each OT book's word and priority denominators.

## Definitions and presentation

The Reader and standalone lookup contract normalize left and right curly apostrophes before dictionary lookup. The **2,724** affected WEB occurrences all resolve through the Reader's normalizer and dictionary provider. The test scans the installed text for apostrophe forms across the nine editions and exercises the normalizer in each edition's pass. Geneva has no selectable apostrophe forms in its installed text. Published verse text, display words, and their character offsets are preserved.

For a selected **Christ** linked to Greek G5547 with noun morphology, Word Study shows **“The Anointed One, the Messiah.”** The caption labels it as a Scripture-context definition. The rule applies to the reviewed Acts 8:37 mapping and to qualifying imported mappings. Other terms use the existing contextual and general dictionary paths. The 500-form catalogue exports its per-book occurrence coverage in the import report. Broader lexical sense review of the priority forms remains open.

Gold styles, keyboard selection, Close and focus return use the existing Word Study UI. The Ethiopian reader, Catholic texts, and all nine Reader translations keep their existing behavior. As before, the Ethiopian reader has its own controls.

## Data and performance

The 259 lazy chapter files total **5,285,788 bytes raw** or **1,564,554 bytes** when gzip-compressed separately. The largest is **53,225 bytes raw** or up to **13,109 bytes** gzip among the files. The Reader requests a chapter on eligible Word Study activation, holds up to 16 chapter requests in memory, and abandons an unavailable lookup after three seconds. The JSON files stay outside the 52-asset app shell. A chapter already loaded in the page can still supply alignment after the page goes offline. After an offline reload, the existing local fallback applies.

The Shell 76 startup check measured **290,674 bytes** of JavaScript across 22 eager scripts, **240 bytes below** the 290,914-byte budget. The 26-byte startup increase comes from preserving curly apostrophes in the loader.

## Remaining work

CrossWire's pinned OT contains **23,145** verse locations and zero explicit original-token position attributes. A Hebrew occurrence map needs independent position evidence, exact English reconciliation, the correct Hebrew witness, and review of repeated forms and supplied words. Bible-wide alignment remains a release blocker. The next translation should be **WEB**, using edition-specific source evidence and the existing priority catalog. Catholic-only and Ethiopian witnesses still require their own source, license and verse-mapping work.

## KJV New Testament word occurrence coverage by book

The counts below show alignment available in the Reader. The priority column uses the existing 500 form list.

| Book | Accepted verses | Other verses | Aligned words | Coverage | Priority words aligned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Matthew | 861 | 210 | 18,078 / 23,688 | 76.32% | 13,718 / 18,000 |
| Mark | 489 | 189 | 10,255 / 15,179 | 67.56% | 7,874 / 11,735 |
| Luke | 870 | 281 | 18,236 / 25,964 | 70.24% | 14,064 / 20,119 |
| John | 689 | 190 | 14,271 / 19,104 | 74.70% | 11,244 / 15,041 |
| Acts | 680 | 327 | 15,396 / 24,289 | 63.39% | 11,603 / 18,371 |
| Romans | 371 | 62 | 7,664 / 9,422 | 81.34% | 5,897 / 7,289 |
| 1 Corinthians | 375 | 62 | 7,700 / 9,462 | 81.38% | 5,966 / 7,356 |
| 2 Corinthians | 205 | 52 | 4,441 / 6,065 | 73.22% | 3,330 / 4,589 |
| Galatians | 133 | 16 | 2,624 / 3,084 | 85.08% | 2,048 / 2,409 |
| Ephesians | 128 | 27 | 2,410 / 3,022 | 79.75% | 1,846 / 2,336 |
| Philippians | 87 | 17 | 1,684 / 2,183 | 77.14% | 1,276 / 1,668 |
| Colossians | 76 | 19 | 1,499 / 1,981 | 75.67% | 1,105 / 1,490 |
| 1 Thessalonians | 72 | 17 | 1,395 / 1,837 | 75.94% | 1,068 / 1,416 |
| 2 Thessalonians | 41 | 6 | 836 / 1,022 | 81.80% | 656 / 810 |
| 1 Timothy | 89 | 24 | 1,672 / 2,247 | 74.41% | 1,158 / 1,559 |
| 2 Timothy | 64 | 19 | 1,222 / 1,669 | 73.22% | 861 / 1,189 |
| Titus | 40 | 6 | 742 / 896 | 82.81% | 499 / 608 |
| Philemon | 20 | 5 | 335 / 430 | 77.91% | 223 / 292 |
| Hebrews | 241 | 62 | 5,221 / 6,899 | 75.68% | 3,966 / 5,261 |
| James | 87 | 21 | 1,742 / 2,304 | 75.61% | 1,251 / 1,672 |
| 1 Peter | 75 | 30 | 1,595 / 2,476 | 64.42% | 1,141 / 1,794 |
| 2 Peter | 44 | 17 | 1,047 / 1,553 | 67.42% | 763 / 1,141 |
| 1 John | 83 | 22 | 1,906 / 2,517 | 75.73% | 1,565 / 2,085 |
| 2 John | 11 | 2 | 233 / 298 | 78.19% | 181 / 231 |
| 3 John | 10 | 4 | 175 / 294 | 59.52% | 113 / 198 |
| Jude | 16 | 9 | 376 / 608 | 61.84% | 272 / 430 |
| Revelation | 76 | 328 | 1,947 / 11,995 | 16.23% | 1,506 / 9,277 |
