# Isaiah importer hardening and dry validation

**No production Isaiah shards are generated or published by this work.** The
reviewed coordinate mapping and apparatus policy are unchanged. Isaiah now
explicitly selects the reviewed five-field `StrongHebrewG.xml` lexical strategy;
publication remains disabled pending a separate publication-candidate milestone.
See the [field-level evidence and adapter review](hebrew-xml-lexical-provenance.md).
The corrected DAT remains license-unresolved and is used only in explicit
historical comparison/replay, never as an automatic Isaiah fallback.
No UI, runtime provider/controller, Reader behavior, CSP, dependencies or trust
settings change. Genesis, John and Romans production bytes remain unchanged.

## Local source evidence

Inspected root: `C:/Users/whoda/OneDrive/Documents/GOD4-OriginalLanguage-Sources`.
All artifacts were already local. No network source or replacement was downloaded.
All inspected inputs/notices match the pinned Git content after checkout
line-ending conversion, at these revisions:

- OSHB: `https://github.com/openscriptures/morphhb`,
  `3d15126fb1ef74867fc1434be1942e837932691f`, artifact `wlc/Isa.xml`.
- Lexical inputs and comparison candidates: `https://github.com/openscriptures/strongs`,
  `0acd2f251c2d35ff8db2dece4e0593979d3ac223`.

The local checkout uses CRLF, while the Git blobs use LF. The SHA-256 values below
pin the **exact supplied local artifact bytes**, including their line endings;
they are not raw Git-blob checksums. Dry validation rejects changed bytes rather
than silently normalizing input before hashing. Content comparison with Git was
performed for both inputs, all five lexical evidence/candidate files, and the
OSHB README/LICENSE; only line endings differ.

SHA-256 of exact local artifact bytes:

| Artifact relative to the inspected root | SHA-256 |
| --- | --- |
| `morphhb/wlc/Isa.xml` | `ce039243b56e4de55b85a635f17343fe9cac7176123fbde5f72af623f9c8f0a5` |
| `strongs/hebrew/strongshebrew.dat` | `eb6190cf487eae8bfa073900333d331f8ffbe1973a0fa9420cf94030c21cc865` |
| `strongs/build.pl` | `b8f207da0dd6e339ded20a3651eb7c6470ae435dc22899d954fb0c378da29ad5` |
| `strongs/strongs-dictionary.xhtml` | `856fd673cfc70311f61565268cab8a3f3ff8525ce881933e115fd0d625c7d8ef` |
| `strongs/todo-diffs.txt` | `d1fd0fe777c4cd196fe5d25390f170988efb30e5877c2f00c84694e07cdb129f` |
| `strongs/hebrew/StrongHebrewG.xml` | `f5a0258d39e9ae37edab27feba5301ff7db540a424e28a41a7af57b8ba5058f2` |
| `strongs/hebrew/strongs-hebrew-dictionary.js` | `661d1df5a34ebf2334d49a4599df79b4f0639cf66f6e592120844afd71c6a3d9` |

### Licensing and attribution

The pinned OSHB README and LICENSE identify lemma/morphology annotations as
CC BY 4.0 and WLC text as public domain. LICENSE requires:
"Original work of the Open Scriptures Hebrew Bible available at
https://github.com/openscriptures/morphhb". The XML credits Daniel Owens and David
Troidl for OSHB and Christopher V. Kimball for WLC. This attribution and snapshot
identity are retained in the dry config; the 15-field record contract is unchanged.

The Hebrew DAT prologue identifies Strong's 1890 dictionary and Michael Grier's
e-text as public domain, and credits Ulrik Sandborg-Petersen, Weston Ruter and Open
Scriptures contributors for corrections. Its corrected-edition notice says
"GPL 3.0 License" at line 74, then gives an MIT-style grant at lines 78–99 under
OpenScriptures.org copyright. `build.pl` line 4 and its generated-header template
at lines 437–438 explicitly say GPL 3.0; `strongs-dictionary.xhtml` lines 4–5 do
likewise. `todo-diffs.txt` line 133 contains an MIT statement in retained diff text,
with Weston Ruter copyright. This is conflicting evidence, not proof that the
selected corrected DAT is MIT, dual licensed, or public domain in its entirety.
No label is normalized to select the most permissive reading.

### Reviewed XML lexical source

`isaiahBookConfig().lexicalJoinStrategy` is `strongs-hebrew-xml-subset`.
`source.lexicalSource` pins revision `0acd2f251c2d35ff8db2dece4e0593979d3ac223`,
artifact `hebrew/StrongHebrewG.xml` and exact local SHA-256 shown above. Its
field-level provenance and component license verification are `verified`, with
explicit XML/XSLT evidence and attribution to Strong (1894), David Instone-Brewer
and David Troidl. This is a five-field decision, not a whole-XML PD claim.

The independent [field-level audit](hebrew-xml-lexical-provenance.md) documents all
accepted and excluded fields, retained build/history/notice evidence, XML schema
counts, fingerprints and adversarial boundary checks. The compiled Hebrew JS
remains unused (its CC-BY-SA header does not identify a version). The DAT's GPL /
MIT-style conflict is not resolved or inherited by the separately reviewed XML
subset.

`publication.enabled` remains false. Configuration and authoritative writer gates
still prevent writes with that configuration. The dry validator reads only OSHB
and the explicitly configured XML, verifies exact hashes, and provides no output
directory option. Missing/malformed/unpinned XML is an error, not a DAT fallback.

## Complete reference review

All 66 source chapters have contiguous unique coordinates: 1,291 source verses.
The repository KJV Reader has 66 chapters and 1,292 verses. Source verse counts
differ only in chapters 8 (23 versus Reader 22), 9 (20 versus 21), and 64 (11
versus 12). All 33 inline `KJV:Isa.*` annotations agree with the declared map:

| Source location | Canonical Reader target |
| --- | --- |
| 8:23 | 9:1 |
| 9:1–20 | 9:2–21 |
| 63:19, running source token indexes 0–8 | 63:19, indexes 0–8 |
| 63:19, running source token indexes 9–15 | 64:1, indexes 0–6 |
| 64:1–11 | 64:2–12 |
| All other source coordinates | Identity |

The 63:19 XML places `<note>KJV:Isa.64.1</note>` immediately before source word
ID `23sJ1`, `לוּא`, index 9. The first nine words end with `עֲלֵי/הֶ֑ם` and match
Reader 63:19; the remaining seven begin the "Oh that thou wouldest rend" passage
of Reader 64:1. The old local conversion scripts hard-code an eight-word split;
that stale positional value is not used. The current artifact's inline marker,
word IDs, token sequence and Reader boundary establish the reviewed nine/seven split.

Generic `tokenSplits` configuration checks the expected source token count,
complete nonoverlapping segments, exclusive Reader destinations and complete
Reader coverage. Actual records must match the declared count. Reindexing applies
only to a split segment, never to hide a missing or duplicated source token.
Existing Genesis 31/32 and Romans 14/16 whole-verse exception declarations are
unchanged. No English-word alignment is inferred.

## OSHB variant-note review

Isaiah has 53 word-bearing `<note type="variant">` blocks, each containing
`<rdg type="x-qere">`; together they hold 56 alternate words. Main-text ketiv
words occur outside these notes. The authoritative parser now preserves those
main-text words and excludes apparatus words before assigning token indexes.
For example, source 3:15 preserves main `מ/ל/כם` and excludes note words `מַה`
(`23UCh`) and `לָּ/כֶם֙` (`23jZZ`). Diagnostics retain every excluded word's source
coordinate, immutable ID, surface, lemma and morphology, plus its apparatus XML.

The seven retained verse blocks in
`tests/fixtures/original-language/isaiah-oshb-extract.xml` come from the pinned
source: 3:15, 8:23, 9:1, 11:3, 53:1, 63:19 and 64:1. Only a fixture wrapper and
attribution comment were added; checkout line endings may vary. Tests compare
the blocks without Unicode normalization against the local source.

Historical Genesis extraction remains note-inclusive for replay compatibility.
Configured authoritative Genesis intentionally receives the generic main-text
policy, with a focused fixture proving that distinction. Existing deployed data
and all source-coordinate replay tests remain unchanged.

## Read-only result and validation

```text
node tools/validate-isaiah-original-language.js [local-source-root]
```

The default root is the inspected directory above; `GOD4_ORIGINAL_LANGUAGE_SOURCES`
can select a different local root. Both input SHA-256 values must match; there is
no network fallback. Output is a JSON summary and complete diagnostics on stdout,
not chapter files. `publicationEligible` remains false.

| Check | Result |
| --- | ---: |
| Reader chapters / verses covered | 66 / 1,292 |
| Running-text tokens | 16,932 |
| Hebrew / Aramaic tokens | 16,932 / 0 |
| Excluded variant notes / words | 53 / 56 |
| Numeric Strong's join failures | 0 |
| Source words without a numeric Strong's ID | 310 |
| Distinct numeric Strong's IDs / missing selected lexical fields | 2,443 / 0 |
| Missing Reader targets / colliding Reader destinations | 0 / 0 |
| Isaiah 11:3 tokens | 11 |
| Isaiah 53 verses / tokens | 12 / 166 |
| Existing Genesis/John/Romans files protected by raw-byte checks | 87 |

The 310 null numeric IDs are source grammatical lemmas (`b`, `l`, `m/l`, `c/b`,
`m`, `c/l`), not failed joins. Neither Strong's IDs nor definitions are invented
for those words. Every numeric source identifier joins the selected XML subset, with zero missing
selected lexical fields. For these 16,622 tokens, `lemma` is the lexical headword,
and transliteration, pronunciation and explanation definition come only from the
approved selectors. Original OSHB lemma annotations remain in source-coordinate
`diagnostics.sourceLemmas`; the 310 grammatical words retain those lemmas and
null lexical fields. Surface, morphology and the 15-field schema are unchanged. Deterministic dry validation produces identical records and
diagnostics while all existing shard hashes remain unchanged; Isaiah's production
directory remains absent.

### Exact lexical comparison with the historical DAT audit

`node tools/compare-isaiah-lexical-sources.js [local-source-root]` is a separate,
read-only historical comparison, requiring all three pinned files. It never
selects DAT in the normal Isaiah validator. The committed
[deterministic comparison report](isaiah-lexical-comparison.json) covers every
used numeric ID with occurrences and both definition hashes/UTF-8 byte lengths;
it does not republish license-unresolved DAT prose.

All 2,443 used definitions differ, affecting 16,622 tokens. The DAT parser retains
whole flattened entry bodies; the XML strategy takes only Strong explanation
text. Headword/transliteration/pronunciation each change for those same 16,622
tokens, and source attribution changes for all 16,932 records. All other fields
are identical: 169,320 values. Mapping diagnostics, contextual language,
apparatus counts and token ordering remain equal. Repeated comparison generation
reproduces the report bytes exactly. Publication is disabled for both configs.

Core unit command:

```text
node --test tests/original-language-importer.unit.js tests/original-language-hardening.unit.js tests/isaiah-original-language-validation.unit.js tests/genesis-original-language-data.unit.js tests/romans-original-language-data.unit.js tests/romans-source-compatibility.unit.js tests/word-study-reference-mapping.unit.js tests/strong-hebrew-xml-lexicon.unit.js
```

Local-source tests explicitly skip if their inputs are absent, rather than claim
source validation or download replacements. No source tests were skipped in the
reviewed local run. The complete Playwright suite is not required for this tooling-only
change; focused original-language, Word Study provider/controller, PWA/offline and
asset checks cover the unchanged runtime.

Historical f1f3371 validation (before XML integration):

- Combined importer, split/policy/gate, Isaiah source, Genesis data, John replay,
  Romans data/source and reference-mapping units: **120 passed, 0 failed, 0 skipped**.
- Ten original-language, Word Study provider/controller and PWA/offline browser
  files, one worker with retries disabled: **235 passed, 0 failed, 0 skipped**.
- General-site `Word Study` acceptance cases, including John Greek rendering,
  one worker with retries disabled: **22 passed, 0 failed, 0 skipped**.
- Asset validation: **34 references, 21 JavaScript syntax checks, 3 icons**, PWA
  service worker and metadata for **9 translations** passed.
- No production/runtime/data files changed. Full Playwright regression was omitted
  under this milestone's tooling-only validation rule. No Isaiah files were written.

### Reviewed XML integration validation, 2026-10-17

The subsequent XML integration passed **140 unit tests**, **235 focused browser /
PWA/offline tests**, and **22 Word Study acceptance tests** including John Greek
coverage. Every final suite had zero failures and zero skips; browser commands
used one worker and retries disabled. Asset validation and explicit syntax checks
for all nine changed/added tool/test JavaScript files passed. The complete
comparison report regenerates exactly. All 87 existing production shards remain
unchanged, and Isaiah publication is still disabled. See the
[integration audit and exact file manifest](hebrew-xml-lexical-provenance.md).
