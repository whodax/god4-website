# Romans source compatibility — no published shards

`romansBookConfig()` supplies the reviewed Romans configuration. This phase
generates records in memory only; no Romans chapter JSON is added or published.
Runtime provider/controller/UI, English ranking and shell cache are unchanged.

## Pinned local artifacts

The inspected root is `C:/Users/whoda/OneDrive/Documents/GOD4-OriginalLanguage-Sources/`.

| Role | Relative path |
| --- | --- |
| Parsed Unicode CSV | `byzantine-majority-text/csv-unicode/strongs/with-parsing/ROM.csv` |
| Original source cross-check | `byzantine-majority-text/source/Strongs/06_ROM.BP5` |
| Greek lexical XML | `strongs/greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml` |

Official text upstream: https://github.com/byztxt/byzantine-majority-text.
The local snapshot is **v3.3.2**, commit
`27a45ff1b7be6c17ccbfeac414f3f55732ae8e28`, dated **2024-12-31**.
Its README identifies RP2018 lineage and BP5 as the source of truth. README and
LICENSE.txt declare the text/code public domain under the Unlicense. Attribution
is optional under that notice, but Robinson/Pierpont and maintainer credits remain.

The selected lexical artifact is Ulrik Petersen's **Strong's Greek Dictionary
XML 1.4**, dated **2007-09-14** in its README. The local Open Scriptures checkout
is `0acd2f251c2d35ff8db2dece4e0593979d3ac223`, upstream
https://github.com/openscriptures/strongs. The XML prologue states
`Public Domain -- Copy Freely`. Preserve credits to James Strong, Michael Grier,
Ulrik Petersen and Open Scriptures. Do not inherit generic Ruter/MIT wording or
licenses of neighboring JS/XHTML derivatives onto this XML. Historical profiles
and Genesis/John attribution strings are unchanged.

## Declarative reference mapping

Canonical/Reader ID: `romans`; source ID: `ROM`; testament: NT; language: Greek;
chapters: 16. Source verse counts:

```text
32,29,31,25,21,23,25,39,33,21,36,21,14,26,33,24
```

Reader chapters 14 and 16 contain 23 and 27 verses. Use identity-with-exceptions:

```json
{"sourceChapter":14,"sourceStart":24,"sourceEnd":26,"readerChapter":16,"readerStart":25}
```

Both CSV and BP5 place the doxology at source 14:24–26. Opening words `τω`/`tw`,
`φανερωθεντος`/`fanerwqentos`, and `μονω`/`monw` correspond to Reader 16:25–27.
Reader 14:23 and 16:24 remain identity-mapped. All 433 source verses map bijectively
to all 433 Reader verses. No parser-specific mapping branch is added. Output sorts
by Reader coordinates while preserving word order/indexes within every verse.

## One word, ordered alternative analyses

CSV 8:28 and BP5 08.28 contain one `παντα`/`panta` followed by
`3956 {A-APN} 3956 {A-NPN}`. These are accusative and nominative plural neuter
analyses of the same surface token. `first-source-analysis` serializes `G3956`
and `A-APN`; it does not assert that this is the uniquely correct interpretation.

The detailed APIs `parseConfiguredSourceDetailed` and
`generateConfiguredSourceDetailed` return `{records, diagnostics}`.
`diagnostics.alternateAnalyses` retains source ID, source chapter/verse, token
index, surface, primary analysis and alternate Strong's/morphology pairs. For
the real word the index is 7 and alternate morphology is `A-NPN`.

The existing deployed 15-field record contract is unchanged. No Scripture token
is duplicated; no arbitrary morphology text is concatenated. Record-only APIs
reject alternate-bearing imports rather than discard diagnostics. Parsing needs
an explicit policy and diagnostics collector; CLI dry-runs print the complete
alternate report. Future generation must retain/review it alongside provenance.
Unmatched, malformed, detached, incomplete and duplicate analyses remain errors;
every alternate identifier must join to the selected lexicon.
The historical John extraction helper retains its record output and exposes a
nonserialized `importDiagnostics` property plus a warning when alternatives occur.
It remains an extraction helper, not a validated publishing path. Actual John CSV
configured generation was already blocked by alternatives before this branch;
that book is not opted into a new serialization policy here.

## Validation and next phase

Run `node --test tests/original-language-importer.unit.js tests/romans-source-compatibility.unit.js`.
The complete local test uses the three pinned files when present. Override their
root using `GOD4_ORIGINAL_LANGUAGE_SOURCES`; absence explicitly skips that local
integration test rather than claiming actual-source validation. Synthetic parser,
reference and schema regressions still run without the external files.

The complete in-memory check covers 16 chapters, 433 Reader verses, 7,210 tokens,
one alternate-bearing word, all lexical/transliteration joins, populated morphology,
the unchanged schema and contiguous indexes. Every CSV analysis sequence is checked
against BP5, and every generated verse preserves its source surface-token sequence.
No production shards or temporary output are created by this check.

The configured CLI supports `--dry-run`; do not select an output path in this
phase. A later pilot must review source snapshot identity, reference mapping,
diagnostics and complete chapter outputs before publication. No English alignment
or runtime alternate-analysis UI is implied.
