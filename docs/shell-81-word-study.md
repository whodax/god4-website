# Shell 81 Word Study

Shell 81 adds a versioned Scripture reference and token crosswalk for engineering audits. It also creates the first WEB review dataset and reserves passages for independent evaluation. The base is [Shell 80](shell-80-word-study.md), commit `82042e8cc29875d3d69aeea241c1a131368ec15b`, accepted November 27, 2026, with 13 of 13 physical Android and TalkBack passes.

## Verified coverage

| Measure | Shell 80 | Shell 81 |
| --- | ---: | ---: |
| WEB verses with a verified group, out of 31,098 | 913 (2.936%) | 913 (2.936%) |
| WEB aligned occurrences, out of 752,223 | 3,131 (0.416%) | 3,131 (0.416%) |
| KJV NT verses with a verified group | 5,933 | 5,933 |
| KJV NT aligned occurrences | 124,702 | 124,702 |
| Priority word forms with at least one verified occurrence | 475 of 500 | 475 of 500 |

There are zero new published groups or definitions. The existing contextual definitions, straight and curly apostrophe normalization, and general and historical dictionary lookup remain in place. Verification of one occurrence does not establish the other uses of that word. The audit checks every Shell 80 WEB shard and the index against their accepted SHA-256 hashes. The KJV data diff against Shell 80 is empty.

## Reference and token crosswalk

The [version 1 module](../tools/scripture-crosswalk.js) keeps the dataset ID, source revision and native coordinate on every endpoint. It reads all nine Reader edition namespaces, the Ethiopian collection's book, section and line coordinates, UHB and UGNT, ULT, Clear.Bible BCV coordinates, Berean chapter and verse positions, and CrossWire KJV OSIS coordinates. Hebrew and Aramaic share the OT coordinate system while retaining distinct token languages. Byzantine Greek and Textus Receptus have separate namespaces.

A source may declare a numbering link without proving a match. Joined and divided verses can have explicit one-to-many, many-to-one or many-to-many endpoints. A conflicting edge resolves as ambiguous. The audit never treats equal numbers as a guarantee of equal words or infers adjacent verses when a split is uncertain. UHB and Hebrew Clear sources may carry verse zero. The Protestant Reader coordinates do not. Existing Reader exceptions record the WEB Matthew 23:13–14 order, the WEB Romans 14:24–26 doxology, the KJV Acts and Luke Textus Receptus variants, and samples of DRA numbering. The edition, source and original word positions must still be verified before proposing alignment. Catholic additions and Ethiopian material require their own witnesses. [CrossWire mapping model](https://www2.crosswire.org/jsword/javadoc/org/crosswire/jsword/versification/VersificationToKJVMapper.html) · [USFM verse numbering](https://docs.usfm.bible/usfm/latest/cv/vp.html)

Ordered witness checks require every original token to match the Reader source spelling, lexical identity, morphology, language and ordinal using the existing edition adapters. This enables a lossless map of Clear native word and morpheme IDs to original Reader positions. The token API can also compare explicitly linked groups after an adapter provides comparable ordered morpheme evidence. It requires clean boundaries, ordered contiguous parts and compatible spelling, lemma, language and morphological features. It rejects incomplete affixes, collisions, reordered repeated positions and Strong-only evidence. Joining exact original-language positions alone does not prove which English words should be highlighted. Supplied English words, repeated English wording, negation and contradictory source links still require the existing phrase checks or external review.

| Source result | Observed |
| --- | ---: |
| Clear WLCM BSB target rows declaring different original coordinates | 48,372 |
| Distinct declared WLCM coordinate edges | 2,084 |
| Clear SBLGNT BSB target rows declaring different original coordinates | 11 |
| Distinct declared SBLGNT coordinate edges | 1 |
| CrossWire KJV addresses present in the Reader | 31,102 |
| Exact CrossWire KJV text and supplied-word boundary comparisons | 24,139 |
| Candidate verses with valid Clear / ordered witness / Reader position evidence | 6,243 |
| Explicit native token or morpheme IDs reconciled in that candidate cohort | 117,422 |
| Candidate groups containing a multi-morpheme original word | 6,593 |
| Candidate verses where the publisher Berean original witness also validates | 4,939 |
| Candidate verses with an ordered ULT milestone witness | 1,764 |

Clear declarations are source-coordinate links. The production-quality English spans and original positions required to promote those remaps are absent. CrossWire exact text is a compatibility screen within KJV. The much smaller position-verified KJV subset remains as published in Shell 76. These checks retain all source distinctions and the original English text.

## The 27,227 single-source candidates

The [machine-readable audit](shell-81-crosswalk-report.json) replays Clear WLCM and SBLGNT against the exact Reader edition, the Shell 79 baseline exclusion used in the original screen, and the output from Shell 80. It accounts for the original 27,227 occurrences across 6,243 verses. It classifies complete groups and distinct English word occurrences separately.

| Status | Groups | Word occurrences |
| --- | ---: | ---: |
| Exact group already in Shell 80 | 713 | 1,153 |
| New group with full independent phrase agreement | 0 | 0 |
| Needs linguistic review | 13,375 | 24,271 |
| Ambiguous | 910 | 1,803 |
| Contradicts a prior verified group on the same span with disjoint positions | 0 | 0 |
| Total | 14,998 | 27,227 |

The scope is the eligible single-source screen. Source records already rejected at the Shell 80 boundary or manuscript checks are outside this denominator. There were zero newly resolved reference or token-position barriers within the cohort, because the old screen already required same-reference and ordered-token compatibility. That compatibility is reproduced and made explicit here. To investigate the wider pool, the report preserves the separately counted declared coordinate offsets. They still lack proof of correct Word Study spans after the shift.

The comparison with an independently projected ULT source is an automated diagnostic. It records exact, partial and different groups and leaves rows without a comparable projection unscored. The strict consensus also checks local anchors and group scope. The independent projection alone cannot close the reviewed-evidence gap. Exact overlap can include existing groups or proposals that fail the full consensus. There were 786 exact groups, 399 with partial span and position overlap, and 68 with conflicting positions at overlapping spans. Another 13,745 had no comparable independent projection.

## Review dataset and independent evaluation

The [review file](shell-81-web-review-v1.json) stores exact WEB text, edition-specific coordinates and ordered original tokens, including manuscript names and morphology. Development proposals also record exact UTF-16 word spans, proposed token positions, source reference evidence and an automated finding. Challenge rows are deliberately unlabeled. Each review slot can carry source or artifact revision, locator, rationale, reviewer identity, date and human status. There are no completed human reviews or resolved disagreements in this initial packet.

The audit first reserves predeclared difficult passages for evaluation, then takes one stable SHA-256-ranked distinct passage per available stratum. Next it selects separate passages for development. The packet has 29 development and 33 evaluation passages. The strata cover both testaments, Hebrew, Aramaic and Greek, names such as Moab and the Philistines, verbs, nouns, possessives, contractions and negation, repeated words, multi-token groups, and manuscript gaps. No development passage is in the holdout. The evaluation packet has English and original-language IDs, without machine-proposed spans, links or labels. It has not been used to tune the importer. The ranked sample is intentionally enriched for challenging phenomena and comes partly from the single-source candidate pool. It cannot be used to estimate accuracy across all WEB verses.

1. Freeze the review dataset version and commit. Give each of two independent Bible-language reviewers the holdout passages, versioned source texts and instructions to identify exact WEB spans and original positions. Have them record evidence and rationale without seeing predictions or each other's choices. A passage can have zero verified groups.
2. Verify reviewer identities and independence outside the code. Maintain an approved roster under the project's control. Keep personally identifying contact details outside the public repository. Record reviewer IDs and decisions with author permission.
3. Have a third independent reviewer adjudicate any disagreement with written evidence. Keep both initial decisions and the resolution. Leave cases pending where evidence cannot settle the difference.
4. Freeze importer predictions before opening the gold labels. Run the evaluator with the approved roster, decision file, and predictions for this exact dataset revision. It counts exact links, partial English and original-position overlap, disagreement and missing expected groups. Machine or AI-assisted decisions are outside the human scoring path.

```text
node tools/evaluate-web-alignment-review.js <review-dataset.json> <human-submissions.json> <frozen-predictions.json> <reviewer-ids.json>
```

Both audit artifacts reproduced byte for byte.

The input decisions and predictions both contain `datasetRevision`, `datasetVersion`, a `datasetChecksum` of the frozen dataset returned by the evaluator's `fingerprint()` helper, and `passages` keyed by holdout ID. A decision record contains `reviews` and optional `resolution`. A review requires `reviewerId`, `mode` set to `independent-human`, an ISO date, and `groups` with exact `spans` and token `positions`. It also requires a written `rationale` and versioned evidence entries, each with `source`, `revision`, and `locator`. Predictions contain the same group shape without reviewer details. The roster is a JSON array of approved IDs. Fixture test identities are synthetic and do not certify review.

No external reviewers took part in Shell 81. The evaluator returned 33 pending evaluation cases and zero scored cases. Independent human accuracy, partial agreement and disagreement are unavailable. All newly proposed rows remain pending. The source-to-source comparison is not a substitute for those results.

## Priority forms

| Form | Needs linguistic review | Ambiguous | Newly verified |
| --- | ---: | ---: | ---: |
| Moab | 17 | 4 | 0 |
| Philistines | 24 | 1 | 0 |
| spoke | 26 | 0 | 0 |
| comes | 5 | 0 | 0 |
| listen | 5 | 1 | 0 |
| show | 0 | 1 | 0 |
| king’s | 15 | 0 | 0 |

The 25 unresolved forms are `don't`, `says`, `didn't`, `spoke`, `brothers`, `doesn't`, `comes`, `listen`, `today`, `king's`, `everyone`, `won't`, `does`, `philistines`, `whoever`, `show`, `can't`, `inhabitants`, `let's`, `loving`, `families`, `news`, `moab`, `isn't` and `whatever`. The report accounts for every form. The single-source screen found zero occurrences for the seven unresolved contractions. The phrase method excludes scope-sensitive wording, including negation. Matthew 5:17 and Genesis 4:9 give reviewers examples with negation and contractions in the two testaments.

## Reproducibility and licensing

The audit uses the exact Shell 80 Clear.Bible, ULT, UHB, UGNT and Berean assets and the Shell 76 CrossWire KJV OSIS. SHA-256 values and edition provenance are preserved in the source manifests, accepted importer and earlier reports. The WEB Protestant Edition is public domain. Clear.Bible human alignment inputs are CC BY 4.0. ULT, UHB and UGNT are attributed as documented in the existing CC BY-SA 4.0 WEB data notice. The review packet's derived source-evidence and original-token content is distributed with the same attribution and CC BY-SA 4.0 terms as the underlying WEB alignment data. The Clear package's Hebrew source and Greek SBLGNT source are separately credited there. The input Berean publisher tables are publicly dedicated. Raw source packages are not included. [WEB Protestant Edition](https://ebible.org/engwebp/) · [Prior source checksums](shell-80-word-study.md#sources-and-reproduction) · [KJV source and reproduction](shell-76-word-study.md) · [Generated alignment data notice](../data/word-study/alignment/web/NOTICE.md) · [Reader original-language attribution](bible-original-language.md)

```text
node tools/audit-shell81-crosswalk.js <clear-dir> <ULT-v92> <UHB> <UGNT> <publisher-BSB.tsv> <CrossWire-KJV.osis.xml> <Shell79-shards> <report.json> <review-dataset.json>
```

The audit reuses the Shell 79 shard checksum gate and the Shell 80 generation manifest. It loads no external dataset during startup or Word Study.

## Performance and validation

The published WEB index and chapter shards remain **555,937 bytes raw** and **265,935 bytes** gzip-compressed separately. Startup JavaScript remains **290,674 of 290,914 bytes**, with zero alignment requests before the first selection. Only the cache version changes in runtime code. Chapter-based lazy loading, the 48-entry persistent cache, and the existing 16-entry page limit remain in place. The engineering review files are outside runtime data. The crosswalk report is 42,174 bytes raw (3,734 gzip). The review packet is 821,294 bytes raw (44,239 gzip).

| Check | Result |
| --- | --- |
| Unit tests | 498 passed, including nine crosswalk and review checks |
| Asset and Ethiopian static validation | Passed, including metadata for all nine Reader translations |
| Focused Chromium regression scenarios | All 191 passed across the main run and the isolated asset-fixture rerun |
| Historical dark-theme upgrade at 320px | 10 of 10 passed on one worker |
| Shell 80-to-81 upgrades | 1280px, 320px and 390px passed |
| Persistent offline Word Study | Cached Shell 80 files survived activation and full offline reload. Chapter eviction, cached original tokens and phrase highlights passed. |
| Ethiopian Read Aloud | Browser fixture passed in 18.7s, including chapter advance and stop |
| Chromium first-use readiness | 16.2ms from shell cache and 22.6ms using the local network fixture |

The first run recorded 190 passes and one static assertion failure. The upgrade fixture expected the alignment script to differ from Shell 80. Shell 81 intentionally leaves all 52 required assets byte-identical after line ending normalization. The corrected fixture asserts that equality and passed in isolation. All 191 outcomes were available before the Windows runner stalled during teardown. The isolated asset fixture and historical repetitions finished normally. Existing test deadlines and retry limits were kept.

The 390px Cloudflare smoke verified zero alignment requests before selection, both English spans of “my tent” in Job 19:12, the contextual definition in Proverbs 6:21, and a full offline reload. Shell 81 physical Android and TalkBack acceptance is pending.

## Remaining release blockers and next milestone

Bible-wide verified alignment remains a release blocker. Assign two independent reviewers and a separate adjudicator to the held-out packet. Start the development review with Moab, Philistines, contractions and Aramaic boundaries. Use the adjudicated evaluation to measure exact, partial and missing results before allowing explicit remaps or source segmentation changes to contribute new runtime groups. Reuse versioned canon namespaces and the same review process for the remaining Reader editions, DRA's additions and the Ethiopian collection once equivalent versioned witnesses exist. KJV's unresolved NT and OT coverage, the 25 remaining priority forms, and Bible-wide contextual definitions stay in scope.
