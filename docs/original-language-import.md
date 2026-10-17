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
`referenceMapping`. New configurations also default to `publication.enabled:false`.
Source verse counts must be checked against the actual input.

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
| Weston Ruter corrected edition (historical attribution, unverified) | MIT |

Historical Genesis/John source profiles retain `null` revisions and
`unknown/unverified` verification. These labels are not an independent license
review. The inspected Hebrew DAT contradicts its historical MIT attribution;
see [Isaiah dry validation](isaiah-original-language-validation.md). Artifact-specific
Romans and Isaiah evidence does not retroactively verify those historical profiles.
Obtain and retain verified notices/revisions before future publication.
Metadata lives in tooling configuration; existing per-record attribution remains
unchanged. No extra provenance fields are added to the deployed contract.

## Reference maps

Every configuration must declare `identity`, `identity-with-exceptions`, or
`explicit`, together with `verified` and nonempty `evidence`. A new book config
starts with proposed identity coordinates and `verified:false`. Its structural
validation can pass, but generation refuses it until reference evidence is
reviewed and recorded. Do not turn this flag on merely to bypass validation.

Whole-verse mappings are one source verse to one Reader verse. Exceptions are declared as
`overrides` keyed by canonical `chapter:verse`, or inclusive `ranges` with
`sourceChapter`, `sourceStart`, `sourceEnd`, `readerChapter`, and `readerStart`.
The explicit strategy has no identity fallback. Identity cannot contain ignored
exceptions. Overlaps, collisions, out-of-bounds locations, and missing Reader
mapping targets fail configuration validation. Generation also rejects missing
expected verses and duplicate or noncontiguous token indexes before writing.

For a reviewed verse boundary inside one source verse, `tokenSplits` maps a
canonical source key to `{tokenCount, segments}`. Each segment has inclusive,
zero-based `start` and `end` source token indexes plus Reader `chapter` and `verse`.
Segments must be supplied in source order, start at zero, meet without gaps or
overlap, and end at `tokenCount - 1`. At least two nonempty segments are required.
An explicit strategy can use splits; an identity strategy cannot contain them.
No split may overlap a whole-verse override/range. Each Reader verse must have
one exclusive source owner: combining multiple source verses or segments into
the same Reader verse is deliberately unsupported and rejected as a collision.

Configuration validation checks every source target, unique Reader ownership,
and complete canonical coverage. Parse/map validation also checks the **actual**
split source token count and all contiguous source indexes before mapping. Missing,
extra, duplicate, or invalid source indexes cannot be hidden by reindexing.
Only split tokens receive `tokenIndex = sourceTokenIndex - segment.start`.
All other token fields, existing whole-verse indexes, and source order remain intact.
`mapReference(config, chapter, verse, tokenIndex)` requires an index for a split;
`sourceTargets(config, chapter, verse)` returns its reviewed Reader destinations.

The Isaiah split is declarative, not a parser-specific book conditional:

```json
{"tokenSplits":{"63:19":{"tokenCount":16,"segments":[
  {"start":0,"end":8,"chapter":63,"verse":19},
  {"start":9,"end":15,"chapter":64,"verse":1}
]}}}
```

## Authoritative OSHB apparatus policy and publication guard

Configured OSHB parsing defaults to `main-text-only`; this is the only accepted
authoritative `oshbWordPolicy`. Words inside `note`, `app`, or `rdg` apparatus are
excluded before running-token indexes are assigned. A nesting-aware tag scan
rejects malformed/unclosed apparatus and excludes comment words. Main-text
ketiv words stay in source order; note-contained qere words are diagnostics,
not additional running-text tokens. No Unicode normalization is performed.

Use the detailed APIs when apparatus is present. Diagnostics retain
`excludedVariantNotes` (word-bearing outer apparatus blocks),
`excludedVariantWords`, and `excludedApparatus`: source book/chapter/verse,
apparatus kind, retained XML, and excluded word ID/surface/lemma/morphology.
Nested apparatus is counted once at its outer boundary, without duplicate words.
Record-only APIs reject rather than discard nonempty alternate/apparatus diagnostics.
The legacy `parseOshbGenesis` extraction helper deliberately retains historical
note-inclusive replay behavior. It is not an authoritative publication path.
Configured Genesis receives the same main-text policy as every other OSHB book;
existing deployed Genesis records are not regenerated or changed.

Mapping verification and publication eligibility are separate. In-memory detailed
parse/map validation may use a reviewed mapping with unresolved lexical licensing.
Every authoritative `writeStaticData(records, directory, configurations)` call
requires a matching, publication-enabled configuration for each book before any
directory/file write. Fixture-only writes remain available. The configured CLI
and historical authoritative command also pass through this guard. Existing
historical configurations now cannot write newly imported authoritative shards
until artifact-specific provenance has been reviewed.

For every source component (text/annotations, lexical source, and OSHB WLC text),
eligibility requires a nonempty license, revision, artifact path, SHA-256, and
`licenseVerification:{status:'verified', evidence:'reviewed evidence location'}`.
Unresolved/unknown labels or license verification cannot pass by merely setting
`publication.enabled:true` or changing a license label. Enabled configured
generation checks source and lexical input bytes against their declared hashes.
Writer validation also enforces complete Reader chapters and source attribution.
No publication flag, provenance field, or diagnostic is added to the 15-field
deployed record contract.

### Genesis source boundary evidence

The historical deployed records at baseline
`c0362476989ba2aef240a2ef36656fb9dbf729c9` preserved OSHB source coordinates.
Their retained boundary fixture provides this evidence:

| Historical source records | Repository KJV Reader | Evidence |
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

### Coordinate-only Genesis production repair

`tools/repair-genesis-references.js` applies the existing `mapReference()` logic
to retained source records and writes only production Genesis chapters 31 and
32. It deliberately does not use generic configured regeneration, which would
also change two Genesis 31:47 language labels. Those `ANp` tokens, `יְגַ֖ר` and
`שָׂהֲדוּתָ֑א`, retain their existing `hebrew` labels in this repair. Correcting
their Aramaic metadata is a separate task.

Every token field, including language, attribution, book ID, surface, lemma,
Strong's number, definition, morphology and token index, remains identical;
only mapped `chapter` and `verse` change. No upstream text is invented or fetched.

| Production result | Before | After |
| --- | ---: | ---: |
| Chapter 31 records | 768 | 780 |
| Chapter 32 records | 453 | 441 |
| Total Genesis records | 20,629 | 20,629 |
| Canonical chapter 31 verse range | 1–54 | 1–55 |
| Chapter 32 stored verse range | 1–33 | 1–32 |

Exactly 453 tokens move coordinates: 12 move from source 32:1 into Reader
31:55; the other 441 remain in chapter 32 with their verse decremented by one.
All 50 canonical Genesis chapters cover all 1,533 Reader verses, with contiguous
unique token indexes. Chapter 33:1 is an unchanged 21-token boundary guard.
Only two production shards change. The tool compares all 48 unaffected files
before/after as raw bytes and checks their retained baseline hashes. It preserves
the two written files' existing line-ending style and never rewrites other files.

The retained fixture is
`tests/fixtures/original-language/genesis-source-boundary.json.gz`. Its 1,242
records include complete source chapters 31 (768 tokens) and 32 (453 tokens),
plus source 33:1 (21 tokens). It was extracted from the historical Git blobs
at the baseline above, before any repaired production output was generated.
It also retains canonical LF hashes for all 50 historical Genesis shards.

- Uncompressed JSON SHA-256:
  `f44725fef72896ba87aa2f02ae261bc9cb19dbe47736cca2926924d7226a89f4`.
- Compressed fixture SHA-256:
  `5ce2db4366f6e19a1d262a2a72dd2c1306df941396000d82e3405016ef54fe06`.
- Compression: Node `zlib.gzipSync`, level 9; retained file size 154,531 bytes.

The fixture proves reproducibility, boundary mapping and field preservation
against reviewed retained historical OSHB token evidence. It is not an
independently verified upstream XML/DAT snapshot or a new license/revision
review. Existing source attribution and unknown upstream revisions are preserved.
Parser replay tests use this source-coordinate fixture rather than attempting
to reconstruct source coordinates from newly repaired production shards.

To re-extract the fixture, use the following Node process from the repository
root. Its only output is the fixture, and its inputs are baseline Git blobs:

```js
const fs = require('node:fs'), cp = require('node:child_process');
const zlib = require('node:zlib'), crypto = require('node:crypto');
const commit = 'c0362476989ba2aef240a2ef36656fb9dbf729c9';
const directory = 'data/word-study/original-language/genesis';
const blob = ch => cp.execFileSync('git', ['show', `${commit}:${directory}/${ch}.json`],
  {encoding:'utf8', maxBuffer:16000000});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const records = [31,32,33].flatMap(ch => JSON.parse(blob(ch)).records
  .filter(r => ch !== 33 || r.verse === 1));
const payload = {
  version:1,
  origin:{repository:'whodax/god4-website', commit,
    artifacts:[31,32,33].map(ch => `${directory}/${ch}.json`),
    extraction:'Complete source-coordinate chapters 31 and 32, plus source 33:1, from baseline Git blobs; no newly repaired output used.',
    verification:'Retained historical OSHB token evidence, not independently pinned upstream XML/DAT.'},
  baselineCanonicalHashes:Object.fromEntries(Array.from({length:50}, (_,i) =>
    [`${i+1}.json`, sha(blob(i+1).replace(/\r\n/g,'\n'))])),
  records
};
const bytes = Buffer.from(JSON.stringify(payload,null,2)+'\n');
if(sha(bytes) !== 'f44725fef72896ba87aa2f02ae261bc9cb19dbe47736cca2926924d7226a89f4')
  throw new Error('Unexpected extracted source bytes');
fs.writeFileSync('tests/fixtures/original-language/genesis-source-boundary.json.gz',
  zlib.gzipSync(bytes,{level:9}));
```

Retained compressed bytes are pinned as well; verify the compressed hash after
re-extraction, since compression-library versions can encode equivalent JSON
differently. Ordinary repair uses the already retained fixture without network
access or upstream inputs:

```text
node tools/repair-genesis-references.js --dry-run
node tools/repair-genesis-references.js
node tools/repair-genesis-references.js --check
node --test tests/genesis-original-language-data.unit.js tests/original-language-importer.unit.js
node node_modules/@playwright/test/cli.js test tests/genesis-original-language.spec.js --workers=1
```

The tool rejects unexpected fixture hashes/boundaries, malformed fields,
noncontiguous or duplicate token indexes, mapping collisions, missing canonical
coordinates, Reader 32:33, unexpected field mutations and unexpected production
input. A repeated repair accepts already-corrected input without writing files.

Genesis JSON is lazily fetched and is neither shell-cached nor runtime-cached
by the service worker. Shell cache stays **21**; translation manifest and all
Scripture bundles remain unchanged. Normal online HTTP revalidation obtains
corrected shards after publication; reload clears the provider's in-memory
chapter promise cache. Hosted Cloudflare acceptance remains required after a
separately authorized push, including the five reviewed Genesis boundary cases
and John, Romans, WEB Psalms, Reader empty-placeholder and Isaiah regressions.

Local validation on October 9, 2026:

- Combined Genesis, importer, Reader-helper, Psalms, Romans data and reference
  mapping unit tests: **262 passed, 0 failed, 0 skipped**. An initial run had
  261 passes and one stale Reader-task preservation assertion; that assertion
  now checks the historical Reader repair commit rather than prohibiting later
  Genesis-only data work. The new Genesis tests check current preservation.
- Browser/provider/regression run: **63 passed, 4 failed** out of 67 cases.
  All **9 new Genesis browser cases passed on the first attempt**, with no
  page or console errors. The failures were existing Word Study focus-return
  checks at KJV Romans 16:25, Romans 1:1, Romans 16:27, and John 1:1.
- Isolated rerun of those four checks: **3 passed, 1 flaky, 0 failed**.
  Romans 16:27 required one retry; the other three passed on the first isolated
  attempt. These are rerun successes, not clean original-run passes.
- John Greek, Romans 8:28 single `παντα` / `G3956` / `A-APN`, WEB Romans
  14:24–26 mapping, Reader empty-placeholder behavior, WEB Psalms 23/150,
  provider tests and hidden Isaiah 11:3 behavior all have successful results.
- Asset validation: **39 references, 26 referenced JavaScript files, 3 icons**,
  PWA worker and generated metadata for eight translations passed.
- Explicit syntax checks passed for all five added/modified JavaScript files;
  repair `--check`, manifest validation and `git diff --check` passed.
- Re-extraction from baseline Git blobs reproduced both pinned hashes and the
  compressed fixture bytes exactly in memory.

Exact changed-file inventory:

- `data/word-study/original-language/genesis/31.json`
- `data/word-study/original-language/genesis/32.json`
- `tools/repair-genesis-references.js`
- `tests/fixtures/original-language/genesis-source-boundary.json.gz`
- `tests/genesis-original-language-data.unit.js`
- `tests/genesis-original-language.spec.js`
- `tests/original-language-importer.unit.js`
- `tests/reader-empty-verse.unit.js` (historical preservation assertion only)
- `docs/original-language-import.md`

These local results do not satisfy pending Cloudflare preview acceptance.

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
configuration. Low-level authoritative writes now additionally require the
publication-eligible configurations described above.

## Language and compatibility

New OSHB output derives Hebrew versus Aramaic from the morphology prefix `H`/`A`.
The two Genesis 31:47 Aramaic tokens keep their surface, lemma, Strong's number,
morphology and definition; only their language changes in new generated output.
Greek remains Greek; Greek morphology beginning with `A` means an adjective and
is not interpreted as Aramaic. The controller uses `he`, `arc`, or `grc` and RTL
for Hebrew/Aramaic. Provider selection/loading and visible styling are unchanged.

The original generic-import phase did not regenerate deployed data. The later
coordinate-only repair above intentionally excludes its language-label changes.
Tests reconstruct local parser inputs from retained source-coordinate Genesis
records and all 15,892 John records in memory. Historical Genesis extraction must
reproduce every original field; generic Genesis output may differ only in the
documented boundary coordinates and two language labels. Generic John
must reproduce all records and all 21 serialized chapter files (normalizing only
checkout line endings). No other difference is accepted.

## Pilot inputs still needed

For Isaiah: the reviewed `isaiahBookConfig()` explicitly selects the locally
supplied OSHB Isaiah input and `strongs-hebrew-xml-subset`, a dedicated five-field
adapter for the pinned `hebrew/StrongHebrewG.xml`. It supplies Strong ID, lexical
headword, transliteration, pronunciation and explanation definition; it excludes
TWOT glosses, unassigned lists and other notes. Source OSHB lemma annotations are
retained in diagnostics; morphology, surface and classification are unchanged.
Field-level license/provenance evidence and exact fingerprints are recorded in
configuration. No DAT fallback is allowed; historical DAT parsing remains
available for Genesis/replay and an explicit comparison audit. The reviewed
coordinate/token split and apparatus policy are unchanged. Publication remains
disabled pending a separate publication-candidate milestone. See the
[Isaiah dry-validation report](isaiah-original-language-validation.md) and
[field-level lexical audit](hebrew-xml-lexical-provenance.md). No Isaiah production
data is shipped.

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

### Genesis 31:47 Aramaic metadata correction

Genesis 31:47 contains two Aramaic tokens, `יְגַ֖ר` and `שָׂהֲדוּתָ֑א`, at
zero-based token indexes 3 and 4. Both retain Strong's H3026 and OSHB morphology
`ANp`; its initial `A` identifies Aramaic. The historical source-coordinate fixture
retains the legacy extraction's Hebrew labels and its original compressed and
uncompressed hashes. It is immutable evidence, not regenerated output.

`repair-genesis-references.js` now runs the existing configured OSHB mapper on
that retained source-coordinate evidence. This applies the verified 31/32
reference map once and derives language from morphology. It accepts the prior
coordinate-only state for migration, validates every remaining metadata field,
and writes only shards whose bytes actually change. Already repaired Reader
coordinates are never treated as source input.

Relative to main `b6c662f91cd5b11451ab2fde00df817fab9eb976`, the deployed correction
changes exactly two `language` fields from `hebrew` to `aramaic`, both in
`data/word-study/original-language/genesis/31.json`. Chapter 32 and all other shards
are unchanged. Genesis retains 20,629 tokens, 1,533 verse coordinates, the earlier
453 coordinate moves, ordering/indexes, surfaces, lemmas, definitions, and Strong's
values. A full baseline comparison test reports every semantic difference.

Unmocked Word Study coverage checks the real shard at mobile and desktop widths:
Aramaic labels and accessible names, `lang="arc"`, unchanged RTL, H3026, ANp, and
lexical definitions. Generic classification tests retain Hebrew and ensure Greek
adjective morphology beginning with `A` is still Greek. No runtime JS changes are
needed.

Shell cache stays **23**. These JSON shards are fetched independently rather than
shell-cached; existing open tabs may need a reload because the original-language
provider memoizes loaded chapter data for the page session.

Validation passed: 264 unit tests (including WEB Psalms source checks), 40
Genesis/Romans/provider runtime checks, and 22 existing Word Study checks including
John Greek data. The explicit baseline verifier reports only the two authorized
language differences. Repeated regeneration is a no-op; fixture hashes, chapter
32, asset validation, JavaScript syntax, and `git diff --check` remain clean.
