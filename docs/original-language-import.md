# Configured original-language imports

This pipeline uses local inputs only. It does not download sources, infer English
word alignment, enrich lemmas, or modify the English dictionary selector.
Deployed chapter JSON retains the existing 15-field contract.

## Configuration and source evidence

`tools/original-language-config.js` provides small source profiles, canonical book
validation, and declarative reference maps. Reader bounds are obtained from the
repository's KJV chapter/verse structure through the existing local Bible loader.
This is the canonical reference target, not a claim of translation-specific token
alignment or a textual-edition equivalence.

Each book configuration contains `bookId`, `readerBookId`, `sourceBookId`,
`testament`, `chapterCount`, `language`, `sourceFormat`, `parserStrategy`,
`lexicalJoinStrategy`, `morphologyFormat`, `sourceVerseCounts`, `source`, and
`referenceMapping`. Source verse counts must be checked against the actual input.

Supported strategies are OSHB OSIS verse/word XML with a Hebrew Strong's DAT join,
and single-book Robinson-Pierpont chapter/verse CSV with a Greek Strong's XML
join. The Greek CSV does not identify its book within each line: the supplied
configuration and reviewed input provenance establish which book it represents.
These are intentionally limited parsers, not arbitrary XML/CSV format readers.

Source metadata includes dataset name, license label, upstream identifier,
language, morphology format, parser format, lexical source, attribution,
revision, and verification state. Current labels are reproduced from deployed
record attribution:

| Component | Recorded license label |
| --- | --- |
| Open Scriptures Hebrew Bible | CC BY 4.0 |
| Westminster Leningrad Codex | public domain |
| Robinson-Pierpont Byzantine Majority Text | public domain |
| Strong's 1890 dictionaries | public domain |
| Weston Ruter corrected edition | MIT |

No pinned source revision, original source download, license text, or complete
attribution requirements were found in the repository. Revisions are `null` and
verification is `unknown/unverified`; these labels are not an independent license
review. Obtain and retain verified notices/revisions before future publication.
Metadata lives in tooling configuration; existing per-record attribution remains
unchanged. No extra provenance fields are added to the deployed contract.

## Reference maps

Every configuration must declare `identity`, `identity-with-exceptions`, or
`explicit`, together with `verified` and nonempty `evidence`. A new book config
starts with proposed identity coordinates and `verified:false`. Its structural
validation can pass, but generation refuses it until reference evidence is
reviewed and recorded. Do not turn this flag on merely to bypass validation.

Mappings are one source verse to one Reader verse. Exceptions are declared as
`overrides` keyed by canonical `chapter:verse`, or inclusive `ranges` with
`sourceChapter`, `sourceStart`, `sourceEnd`, `readerChapter`, and `readerStart`.
The explicit strategy has no identity fallback. Identity cannot contain ignored
exceptions. Overlaps, collisions, out-of-bounds locations, and missing Reader
mapping targets fail configuration validation. Generation also rejects missing
expected verses and duplicate or noncontiguous token indexes before writing.

### Genesis source boundary evidence

The existing deployed records preserve OSHB source coordinates. Compare:

| Existing source records | Repository KJV Reader | Evidence |
| --- | --- | --- |
| `genesis/32.json`, 32:1 | 31:55 | Laban rises, kisses/blesses his family, and returns home |
| `genesis/32.json`, 32:2 | 32:1 | Jacob travels and angels of God meet him |
| `genesis/32.json`, 32:33 | 32:32 | Israel does not eat the sinew affected in Jacob's thigh |

The complete chapter sequence contains 54 source verses in chapter 31 and 33 in
chapter 32; the Reader contains 55 and 32. The declared existing-book map is:

```json
{
  "strategy": "identity-with-exceptions",
  "verified": true,
  "evidence": "Existing records and Reader Genesis 31/32; see this document",
  "overrides": {"32:1": {"chapter": 31, "verse": 55}},
  "ranges": [{"sourceChapter": 32, "sourceStart": 2, "sourceEnd": 33,
              "readerChapter": 32, "readerStart": 1}]
}
```

Source 32:33 therefore targets Reader 32:32; it must never be deployed as Reader
32:33. Source 31:55 and 32:34 are invalid input locations. This mapping belongs to
these inspected source/Reader editions and is not automatically reused for every
Hebrew dataset. John remains identity-mapped: all 879 source verse locations match
the repository Reader bounds. This does not establish English-to-Greek alignment.

## Pure generation and local CLI

`parseConfiguredSource(text, lexiconMap, config, options)` returns validated,
Reader-coordinate records. `generateConfiguredSource(text, lexicalText, config,
options)` additionally parses the configured lexical format. Neither writes files.
Alternate-bearing Greek input must use the detailed APIs to retain diagnostics;
see [Romans source compatibility](romans-source-compatibility.md).
`mapSourceRecords(records, config, options)` validates/maps source-coordinate
records without requiring unavailable upstream inputs.

Use an explicitly selected output or a dry run:

```text
node tools/import-original-language.js --config book-config.json --source local-source-file --lexicon local-lexicon-file --dry-run
node tools/import-original-language.js --config book-config.json --source local-source-file --lexicon local-lexicon-file --chapters 1,2 --output reviewed-output-directory
```

Chapter selection refers to SOURCE chapters. For Genesis source chapter 32,
expected Reader coverage includes 31:55 and 32:1–32; selecting source chapter 31
alone does not pretend to cover Reader 31:55. Chapter files are replaced rather
than merged: the writer rejects any incomplete authoritative Reader chapter
before writing anything. Select source chapters 31 and 32 together to produce
both complete Reader chapters. Use a fresh staging directory and review complete
chapter outputs before publication; dry runs can inspect smaller source subsets.

The old `parseOshbGenesis` and `parseByzantineJohn` extraction helpers delegate to
the same generic parsers but intentionally preserve historic source coordinates
and language labels for compatibility. They are not a deployment validation path.
The existing `--authoritative` two-book command now uses configured generation,
including reference/coverage validation, and supports `--dry-run`. The plain JSON
import path accepts fixture records only; authoritative records require source
configuration. Low-level writers expect callers to have validated their records.

## Language and compatibility

New OSHB output derives Hebrew versus Aramaic from the morphology prefix `H`/`A`.
The two Genesis 31:47 Aramaic tokens keep their surface, lemma, Strong's number,
morphology and definition; only their language changes in new generated output.
Greek remains Greek; Greek morphology beginning with `A` means an adjective and
is not interpreted as Aramaic. The controller uses `he`, `arc`, or `grc` and RTL
for Hebrew/Aramaic. Provider selection/loading and visible styling are unchanged.

No deployed data was regenerated in this phase. Tests reconstruct local parser
inputs from all 20,629 Genesis and 15,892 John records in memory. Historical Genesis
extraction must reproduce every original field; generic Genesis output may differ
only in the documented boundary coordinates and two language labels. Generic John
must reproduce all records and all 21 serialized chapter files (normalizing only
checkout line endings). No other difference is accepted.

## Pilot inputs still needed

For Isaiah: a locally supplied OSHB Isaiah input, compatible Hebrew lexical DAT,
verified source/license/revision information, checked source verse counts, and a
reviewed source-to-canonical-Reader reference map. Structural draft config can be
created with `createBookConfig('isaiah', 'oshb', 'Isa')`; no Isaiah data is shipped.

For Romans: a locally supplied single-book Robinson-Pierpont CSV, compatible Greek
Strong's XML, verified source/license/revision information, checked source verse
counts, and a reviewed reference map. Draft config uses
`createBookConfig('romans', 'byzantine', 'Rom')`; no Romans data is shipped.
The reviewed `romansBookConfig()` profile and dry-run-only compatibility validation
are documented in [Romans source compatibility](romans-source-compatibility.md).

Run unit checks with `node --test tests/original-language-importer.unit.js`.
Use the focused Word Study and PWA/offline tests for runtime metadata delivery.
Offline shard persistence, normalized lemmas, broader text-edition differences,
and authoritative English-word alignment remain separate work.
