# Shell 83 multi-translation Word Study

Shell 83 makes verified original-language highlighting available in **2,348 additional edition-verses**, covering **32,959 English word occurrences**. It continues accepted Shell 82 at commit `cce89e56de5fe07b40207928128e3d735f41ef1d`. The [Shell 82 report](shell-82-word-study.md#shell-82-physical-acceptance) records all three Android and TalkBack passes on November 27, 2026. Draft PR #131 carries the preview. Bible-wide verification remains a release blocker.

## Actual coverage additions

| Reader edition | Shell 82 candidates | Accepted from that cohort | Total new verified edition-verses | New matched English occurrences |
| --- | ---: | ---: | ---: | ---: |
| WBS (Webster) | 1,364 | 1,064 | 1,135 | 18,564 |
| RV | 372 | 372 | 426 | 6,159 |
| ASV | 306 | 306 | 425 | 5,223 |
| Douay-Rheims Catholic | 112 | 111 | 114 | 1,511 |
| DBY | 41 | 36 | 107 | 821 |
| WEB | 23 | 19 | 19 | 183 |
| GNV | 18 | 18 | 33 | 238 |
| YLT | 1 | 1 | 42 | 135 |
| KJV Old Testament | 0 | 0 | 47 | 125 |
| **Total** | **2,237** | **1,927** | **2,348** | **32,959** |

Counts are distinct within each edition. A matched occurrence belongs to a verified group within a verse. Some verses have verified coverage for only part of their words. The compiler screened out 303 initial candidates with uncertain supplied or editorial markup (298 WBS and five DBY), three held-out slots and four existing WEB verses. The full-corpus screen contributed 421 additional edition-verses. The [machine-readable inventory](shell-83-edition-publication.json) includes per-book counts, qualification modes, exclusions and file checksums. The wider screen does not assign an ambiguity count to rows with no qualifying evidence.

Combined WEB verified coverage is **932 of 31,098 verses (3.00%)** and **3,314 of 752,223 occurrences (0.441%)**. The KJV New Testament retains **6,409 of 7,957 verses (80.55%)** and **135,805 of 180,488 occurrences (75.24%)**, including the labeled Robinson Textus Receptus and the existing manuscript overrides. The 47 added Old Testament verses include 15 in Nehemiah, 11 in 1 Chronicles and nine in Numbers. Their linked English phrases use verified WEB evidence and the same ordered Hebrew source tokens. CrossWire KJV Old Testament Strong's tags remain research leads. OSHB and STEPBible provide Hebrew and Aramaic coordinates and morphology, and position-aware KJV English evidence is still needed.

Webster Matthew (145 new edition-verses), Luke (140) and Acts (122) are the largest additions. RV John gains 78, ASV John gains 62 and Douay-Rheims Luke gains 21. These additions cover groups within books. Complete chapters and books remain the target for the next expansion.

## Verification and runtime selection

The [reproducible compiler](../tools/import-edition-alignments.js) checks explicit Reader crosswalk addresses, exact target-edition wording, source word offsets, full ordered original token surfaces, references, lexical identities, morphology and language. It rejects unresolved supplied or editorial markup and incompatible positions, and protects all 33 held-out evaluation passages, including remapped original coordinates. Existing verified rows retain precedence. The current data has 2,314 complete wording-and-witness matches, 22 with conservative punctuation-only offset projection, and 12 phrase matches with agreeing groups in both the accepted CrossWire and WEB evidence. The phrase gate checks a bounded English frame and original positions. These methods use accepted evidence and automated checks. Independent human review of these rows is pending.

When a Word Study selection needs the new path, the provider reads a small edition-specific chapter plan and revalidates the installed text and witness. Exact matches reuse the pinned source chapter spans. Projected groups carry exact target spans. Edition labels disclose the evidence basis, including an explicit Greek-witness label for Douay-Rheims New Testament cases. Gold highlighting supports the existing single- and multi-token groups. Compare maintains its own English editions and Word Study retains Reader ownership. The provider uses the exact installed Scripture text and witness inventories.

## KJV residual investigation

The [residual report](shell-83-kjv-residual.json) reclassified all 1,548 New Testament records from pinned CrossWire OSIS and Robinson Textus Receptus inputs. It found 1,090 position, surface or lexical identity differences, 192 morphology differences, 187 English or supplied-boundary differences, 59 missing alternate references, 11 unsupported markup records, six ambiguous position records and three incomplete sequences. A controlled test removed only balanced plain title wrappers from the 11 unsupported verses. Seven reproduced the exact English text, and six also passed the strict witness-validator trial. Those results are diagnostic. The current preview leaves this subset unpublished. Of the 1,090 position, surface or lexical differences, 36 had a matching ordered Greek surface sequence after position projection and 1,054 still differed. A matching surface sequence alone cannot establish the lexical analysis. Recovering the larger manuscript-sensitive groups requires compatible parsed witnesses and a reproducible position crosswalk.

## WEB book review and priority words

The [book review staging tool](../tools/stage-reviewed-web-book.js) checks previously published WEB coverage, including the new edition plans, before staging review submissions. The pinned review packets retained 85 pending Ruth slots, 25 Philemon, 48 Jonah and 1,530 Genesis, with three Genesis slots withheld from the packet review. All 33 original evaluation passages remain protected. The 2,318 targeted candidate occurrences, including 1,613 involving priority words, remain pending independent review. Empty-submission runs staged zero rows.

Shell 83 adds 25,224 verified occurrences of already evidenced priority forms. Coverage remains **476 of 500 forms** with at least one verified occurrence. All 24 outstanding forms were screened against qualified spans and remain unresolved. They are *don't, says, didn't, spoke, brothers, doesn't, comes, listen, today, king's, everyone, won't, does, philistines, whoever, show, can't, let's, loving, families, news, moab, isn't,* and *whatever*.

The surviving review inventory gives a concrete starting point for common forms. It contains 26 pending examples of *spoke*, 24 pending and one ambiguous *Philistines*, 17 pending and four ambiguous *Moab*, and 15 pending *king's*. No matching leads for the seven contractions appear in that inventory. Those forms need direct clause-level review, including negation and supplied English words. [Priority form inventory](shell-81-crosswalk-report.json)

The edition-specific definition additions cover *begat* in the Matthew genealogy (Greek G1080 with aorist active indicative), *Word* in John 1:1 (linked Greek G3056 noun) and *Seraiah* in the Nehemiah covenant list (Hebrew H8304 proper noun). Each depends on the verified passage, span, lexical identity and form. Verified Scripture-context meanings retain their distinction from general modern definitions and historical dictionary fallbacks.

## Catholic and Ethiopic witnesses

The [coordinate audit](shell-83-witness-coordinates.json) pins the Clementine Vulgate public-domain electronic edition from the Clementine Vulgate Project and the printed Ethiopian Orthodox Tewahedo Church Ge'ez branches in the Beta masaheft editions. The Clementine source has 73 books. Numeric addresses match installed DRA at all 275 Esther and all 531 Daniel slots compared, while Psalms has 2,526 shared addresses with five one-sided slots. Sirach has 1,591 shared addresses and one Latin-only slot. A Latin path would need a passage and token crosswalk plus independently validated English span evidence. Latin is a translation witness and DRA displays a Greek witness for 113 new New Testament cases and a Hebrew witness for the one Genesis case. [Clementine Vulgate Project](https://crosswire.org/study/fulllibrary.jsp?show=VulgClementine) · [Pinned USFX](https://github.com/seven1m/open-bibles/blob/e310b178189e30443c44f2338022aab73546b274/lat-clementine.usfx.xml)

The published-branch Ge'ez coordinate comparison found 1,027 shared numeric addresses for 1 Enoch and 1,290 for Jubilees. It found 36 one-sided Enoch addresses and 17 one-sided Jubilees addresses. Text and word-position correspondence across the installed English versions still requires independent review. The audit selects only the `EOTCed` branch under the files' CC BY-SA 4.0 terms, excluding other textual branches. It ships no witness text or new alignment for either collection entry. [Pinned 1 Enoch TEI](https://github.com/BetaMasaheft/Works/blob/ff9d4981eba2084c4914ca840ff323d85cbd2a1d/1001-2000/LIT1340EnochE.xml) · [Pinned Jubilees TEI](https://github.com/BetaMasaheft/Works/blob/ff9d4981eba2084c4914ca840ff323d85cbd2a1d/1001-2000/LIT1697Jubilees.xml)

## Size and reproduction

The new plans consist of 277 chapter files and one index totaling **79,049 raw bytes** or **31,427 bytes gzip-compressed separately**. The index is 13,890 raw bytes and 3,631 gzip bytes. All data loads on demand. The WBS browser test confirms zero alignment requests before Word Study selection and retains the chapter and its source across a full offline reload. The persistent alignment cache retains its 48-entry limit and the in-memory chapter cap stays at 16. All three catalog indexes are preserved during persistent eviction. Eager JavaScript is **290,674 bytes**, within the 290,914-byte budget.

The generated publication report reproduced byte-for-byte, including the hashes for all 278 payload files. A second Clementine and Ge'ez coordinate audit also produced a byte-identical report. The [data attribution](../data/word-study/alignment/editions/NOTICE.md) links to the pinned prior source publications. Witness and residual reports record the audit findings. The node importer uses already published, hash-pinned data and performs no network requests.

```text
node tools/import-edition-alignments.js <fresh-output-directory> <report.json>
node tools/audit-kjv-residual.js <pinned-KJV-OSIS> <Robinson-TR-repository> <report.json>
python tools/audit-witness-coordinates.py <pinned-vulgate.xml> <pinned-enoch.xml> <pinned-jubilees.xml> <report.json>
```

## Validation

| Check | Result |
| --- | --- |
| Unit suite, including every new stored row | 510 passed |
| Focused Chromium tests | 146 passed, including 320px dark theme, Ethiopian Read Aloud, Compare, and Word Study scrolling and focus |
| Historical installed caches 74 through 81 | 68 cases passed |
| Shell 82-to-83 upgrade | 11 passed at 320px, 390px and 1280px, including interrupted installation and previously cached Word Study after offline reload |
| Additional PWA and focused follow-up cases | 10 PWA cases and four targeted checks passed, including the revised three-catalog eviction test and repeated Webster phrase positions |
| Asset and Ethiopian education validation | Passed, including all nine translation metadata entries |
| Cloudflare preview at 390px | Passed zero startup alignment requests, edition labels, contextual definitions, offline reload, focus return and three-catalog retention within the 48-entry cache limit |

The wider diagnostic run found font-related timeouts and one outdated Ethiopian footer expectation. The tests use local fallbacks for blocked optional web fonts and keep the established deadlines. Targeted reruns passed for Compare, Saved Verses and the touch menu flow. The footer test now verifies the accepted standalone Ethiopian Reading Collection link.

The original published KJV, KJV-TR and WEB files, original-language witnesses, installed Reader editions and Ethiopian Scripture all match the Shell 82 Git baseline. The 33-case held-out file also matches that baseline byte for byte.

## New physical acceptance

1. In Webster Matthew 1:4, open Word Study on **begat**. Check the gold Greek highlight, the genealogy definition and the WBS source label. Close Word Study with TalkBack and confirm focus returns to **begat**.
2. In Douay-Rheims John 1:1, open **Word**. Check the gold match and the explicit **Greek witness** label. Then open KJV Nehemiah 10:2 on **Seraiah** and check the gold Hebrew match and right-to-left display.
3. With Webster downloaded and the Matthew chapter previously studied online, reload the preview offline and reopen **begat**. Check that the same alignment is available.

The next milestone should combine position-aware witnesses for a complete KJV book with independent review of the frozen WEB book packets. Release remains blocked by incomplete Scripture-wide alignment. PR #131 remains a draft.
