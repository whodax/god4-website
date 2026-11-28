# GOD4.us Shell 75 Word Study audit

Audited commit `08ae6aeded6182ca140165c8f17fd0a35d317e0b` on November 25, 2026. The audit reads the installed editions and uses the existing providers. The runtime, Scripture bundles, catalog, CSS, Close control, and service worker were inspected as they existed at that commit.

## How Shell 75 handles alignment

The Reader sends a specific word occurrence, translation ID, and passage reference to the Word Study controller. The original-language provider resolves source coordinates and returns the verse's tokens from the published chapter shards or a documented Textus Receptus alternate. The optional alignment module reconstructs the displayed verse against its exact source text, including KJV supplied-word boundaries. Its validator requires matching provenance, translation, reference, verse text, and the authoritative original-token sequence. It rejects missing, duplicate, or stale identities.

An alignment group can contain several English ranges and several original token indices. Activating either side highlights all linked words and uses the existing gold styling. The module starts lazily and has a three-second deadline. When alignment is unavailable, the English lookup and available source verse tokens still work. The existing Close control and Escape return focus to the activating Reader word. Earlier design and regression history are recorded in [the alignment notes](word-study-alignment.md) and [the Close occlusion notes](word-study-sticky-close-occlusion.md).

## Verified alignment coverage

Shell 75 has **six verified verse entries and 52 alignment groups**. They cover **69 of 7,141,368 English word occurrences (0.00097%)** and **6 of 284,576 nonblank verse occurrences (0.00211%)** across the nine Reader editions. An aligned verse has at least one verified word match. A word occurrence is counted once even when it participates in overlapping groups. Original-language verse data is available for **274,834 of 284,576 nonblank verses (96.57666%)** through the production lookup rules.

The source-language availability column measures live provider behavior. Independent review of all cross-edition verse boundaries remains part of the Catholic and Geneva alignment work.

| Reader edition | Books | Chapters | Nonblank verses | With source-language words | Verified alignment verses | Verified English words |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WEB | 66 | 1,189 | 31,098 | 31,097 (99.9968%) | 5 (0.01608%) | 44 / 752,223 (0.00585%) |
| ASV | 66 | 1,189 | 31,086 | 31,085 (99.9968%) | 0 | 0 / 783,821 |
| KJV | 66 | 1,189 | 31,102 | 31,101 (99.9968%) | 1 (0.00322%) | 25 / 790,769 (0.00316%) |
| YLT | 66 | 1,189 | 31,102 | 31,101 (99.9968%) | 0 | 0 / 786,940 |
| DBY | 66 | 1,189 | 31,099 | 31,098 (99.9968%) | 0 | 0 / 774,598 |
| WBS | 66 | 1,189 | 31,102 | 31,101 (99.9968%) | 0 | 0 / 788,005 |
| RV | 66 | 1,189 | 31,086 | 31,085 (99.9968%) | 0 | 0 / 791,291 |
| GNV | 66 | 1,189 | 31,090 | 30,296 (97.4461%) | 0 | 0 / 783,934 |
| DRA | 73 | 1,334 | 35,811 | 26,870 (75.0328%) | 0 | 0 / 889,787 |

| Edition and passage | Verified groups | English words in those groups |
| --- | ---: | ---: |
| WEB Genesis 1:1 | 6 | 10 / 10 |
| WEB Exodus 10:1 | 2 | 2 / 30 |
| WEB Mark 2:7 | 1 | 1 / 15 |
| WEB John 1:1 | 16 | 16 / 17 |
| WEB John 1:3 | 10 | 15 / 15 |
| KJV Acts 8:37 | 17 | 25 / 27 |

The Catholic-only books and Esther/Daniel additions account for 4,655 DRA verse locations under the Reader's canon rules. The provider currently returns English lookup alone for those locations, as well as for several different-numbered chapters, including DRA Psalms. GNV has chapter numbering exclusions too. The standalone Ethiopian reader has 86 English collection entries, 1,916 sections, 42,447 nonblank verse or paragraph lines, and 1,137,544 English word occurrences. Its online and offline readers have no Word Study integration or verified word matches. The Meqabyan sample links are external and outside the collection count. Some Ethiopian collection line numbers are editorial and need edition-aware cross-references.

## The 500 priority word forms

The existing priority list is ranked using the installed WEB corpus. Across the nine Reader editions, **33 / 500 forms (6.6%)** have at least one verified alignment somewhere. At the occurrence level, **59 / 5,384,112 priority occurrences (0.00110%)** align. By edition, this is 40 / 611,729 in WEB (0.00654%), 19 / 602,062 in KJV (0.00316%), and zero in the other seven editions. The standalone Ethiopian collection contains 861,659 occurrences of the same forms and zero integrated matches.

The dictionary audit checked the first Reader occurrence of each priority form that appears in each edition. Definition availability ranges from **97.20% in GNV (382 / 393)** to **99.20% in WEB (496 / 500)** for these samples. ASV, YLT, and RV each returned 474 / 486. KJV returned 468 / 480, DBY 479 / 491, WBS 476 / 488, and DRA 476 / 486. These figures count any available definition, including definitions with competing meanings.

The exhaustive WEB pass exercised all 611,729 priority occurrences. The production provider returned 421,298 common Bible-usage definitions (68.87%), 36,619 Scripture-context labels (5.99%), 150,614 context-uncertain results (24.62%), 469 general dictionary results, five general dictionary context matches, and 2,724 unavailable results (0.45%). Labels describe the runtime choice and do not certify that each chosen meaning is linguistically correct.

The four missing WEB forms are **don’t (1,369), didn’t (863), doesn’t (326), and isn’t (166)**. The Reader strips the curly apostrophe before looking up the catalog key. The existing unit check exercises 500 pre-normalized forms and passes, so it misses the Reader path. Outside WEB, recurring missing samples include Biblical names such as Israel and David and inflected verbs such as brought and died. The special Scripture rules for select terms apply across editions, and the broader common-word catalog is WEB-specific. KJV Acts 8:37 also shows that verified alignment and contextual definition quality can diverge. Its existing general English definition for Christ is insufficient in that verse.

The previous dictionary coverage script is still useful as a historical comparison. Its Webster-based estimate ranges from 80.88% of GNV occurrences to 97.27% of WEB occurrences and covers eight editions. The new audit calls production dictionary lookup and includes DRA, so those older percentages have a different denominator and method.

## Candidate sources and compatibility

| Target | Candidate | Conditions for adoption |
| --- | --- | --- |
| KJV | CrossWire KJV OSIS. Its publisher grants broad use of the tagging work and identifies Crown rights in the base text. | Start with the NT. Pin the exact OSIS artifact and its rights notice. Validate English display and supplied-word boundaries, source index origin, the entire Greek verse, and tagged token identity. OT Strong’s keys require a separately validated Hebrew occurrence map. [CrossWire notice and release](https://ftp.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV) |
| WEB, ASV, YLT, DBY, WBS, RV, GNV | unfoldingWord Literal/Simplified Text USFM with explicit alignments provides independent reviewed evidence. The Literal Text is an ASV revision. Berean translation tables provide a second comparison source. | Each dataset aligns its own wording. Use publisher artifacts and record attribution and applicable ShareAlike terms. Seek edition-specific mappings or editorial review when translation wording or source tokens differ. Public-domain WEB text permission does not itself provide a word map. [unfoldingWord content](https://unfoldingword.org/for-translators/content/) · [unfoldingWord license](https://unfoldingword.org/about/license/) · [Berean tables and terms](https://berean.bible/downloads.htm) · [WEB edition](https://ebible.org/bible/details.php?id=engwebp) |
| Original token identities, lexicons, and numbering | STEPBible TAHOT, TAGNT, TBESH, TBESG, and TVTMS under CC BY 4.0. The project also publishes ESV-specific English tags. | Use for lexical evidence, original token comparison and cross-references. Validate source edition and verse boundary for every mapping. The ESV tags describe ESV phrasing. [STEPBible data and license](https://stepbible.github.io/STEPBible-Data/) |
| Catholic and DRA | The exact eBible DRA 1899 English edition and the Clementine Vulgate are public-domain reference texts. Open Scriptorium’s Rahlfs data offers a CC BY 4.0 Greek morphology candidate including the deuterocanon. | Establish a DRA–Vulgate reference map first and label Latin as the translation source. Use Greek Septuagint evidence where the textual witness is appropriate. The Rahlfs project documents its independent review limitations. No edition-specific DRA word alignment was verified in the audit. [DRA](https://ebible.org/find/details.php?id=engDRA) · [Clementine Vulgate](https://ebible.org/find/details.php?id=latVUC) · [Rahlfs morphology](https://openscriptorium.org/posts/free-lxx-morphology) |
| Ethiopian Scripture | Beta maṣāḥǝft’s EOTC printed Ge’ez witnesses for 1 Enoch and Jubilees are candidates with CC BY-SA 4.0 terms. | Start with independent edition and section crosswalks to the installed English texts. Verify rights at the individual witness level, including separate restrictions on the scholarly editions in the same files. Add Ge’ez-aware segmentation and qualified linguistic review. Meqabyan English permissions and a corpus matching the entire published collection remain open. [Source Text witness and license notes](https://biblesrc.org/sources) · [Pinned Enoch manuscript encoding](https://github.com/BetaMasaheft/Works/blob/ff9d4981eba2084c4914ca840ff323d85cbd2a1d/1001-2000/LIT1340EnochE.xml) |

## CrossWire feasibility check

The dry run examined the [CrossWire OSIS source repository](https://gitlab.com/crosswire-bible-society/kjv) using a downloaded `kjv.osis.xml` with SHA-256 `4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5`. It removed note and XML markup and compared case-sensitive English word sequences using the existing Reader tokenizer. This initial screen ignores punctuation and supplied-word markup and reports candidate coverage.

- **NT:** 7,824 / 7,957 verses (98.33%) passed that screen and had indexed tags. In 6,371 of those verses (81.43%), every indexed group agreed with the current Reader Greek token surfaces at the supplied positions after comparing case, accents, and final sigma. This is 80.07% of all KJV NT verse locations. The screen compared 119,905 indexed groups, with 110,864 agreeing (92.46%). It has yet to verify all Greek token identities, exact English spans, morphology, or tagged meaning.
- **OT:** 16,717 / 23,145 verses (72.23%) had the same case-sensitive English word sequence. The OT tags in this XML did not supply Greek-style source positions. Strong’s tags alone cannot distinguish repeated Hebrew occurrences or segment boundaries.

The audit published zero new word mappings. A source-compatible verse still needs occurrence-level checks before qualifying for gold highlighting.

## Regression results

- The 117-case Chromium run reported a pass for each selected case. It covered the full alignment spec, the 38-case chapter scroll cancellation and supersession matrix, the full late-definition verse-context spec, selected floating Close and reverse keyboard checks, startup assets, offline first use, and the Shell 74 to 75 upgrade. The run was configured for one worker and zero retries.
- The historical intermittent 320px dark-theme native chapter fallback passed ten consecutive independent Chromium runs. The earlier focus and scroll failures were not reproduced within these checks.
- Five Ethiopian Reader browser checks passed, including passage navigation, fullscreen, keyboard focus return, and Read Aloud. The separate browser startup and first-use test also passed.
- All 88 targeted Node tests passed. Asset validation and the Ethiopian static checks also passed.
- The static and browser startup checks both measured 22 eager scripts and 290,648 LF-normalized JavaScript bytes, 266 bytes below the 290,914-byte budget. The app-shell asset count stayed at 52. The offline checks preserve the current distinction between chapter data already loaded on the page and the smaller fallback available after an offline reload.
- Direct checks on the deployed Shell 75 preview reproduced the missing WEB contraction and the generic meaning for KJV Christ. Those issues remain open on this audited build. Physical Android and TalkBack acceptance and a whole-site test run were outside this audit. The previously recorded Cloudflare CSP injection issue is a separate production configuration investigation.

## Expansion sequence

1. Fix the shared Reader normalization path and test it with actual UI selections, including curly contractions, supplied KJV words, and ambiguous definitions. Extend the priority review to Biblical names, inflections, and translation-specific senses. Hold out representative occurrences across the nine editions when checking definition quality.
2. Build a read-only CrossWire import report for the priority tokens in the KJV NT. Require exact English verse identity and UTF-16 spans, matching original verse and token identities, and consistent Strong’s and source edition metadata. Include reordered clauses, repeats, words supplied in English, alternates, and multi-word groups in the sample. Send ambiguous or incompatible entries to review.
3. Store approved groups by translation, book, and chapter. Load on Word Study activation and preserve the current fallback. Keep bulk data outside the app shell and eager-script budget. Preserve the existing English and original-language controls, gold styling, Escape behavior, and focus return. Benchmark lazy lookup, request size, and offline use before publishing data.
4. Expand the verified source paths separately for the other translations, Catholic numbering and witnesses, and the standalone Ethiopian reader. Publish coverage per edition and source, including intentionally unmatched terms and openly licensed source revisions. Use edition-specific editorial alignment where no reusable match can be verified.

## Reproduction

Run from the audited checkout. The audit script reads the private inline catalog in an audit VM, calls the original-language provider for each nonblank verse, and passes each catalog location through the production validator. It reuses the existing tokenizer and evaluates the dictionary through the same lookup path as the Reader.

```powershell
node tools/audit-word-study-alignment.js
node tools/audit-word-study-coverage.js --top=8
node --test tests/word-study-alignment.unit.js tests/web-common-word-study.unit.js tests/word-study-reference-mapping.unit.js tests/bible-original-language.unit.js tests/word-study-expansion.unit.js
```
