# DRA original-language lookup

The original-language provider formerly rejected every DRA request before loading a shard. The Reader already supplies canonical book IDs: DRA's Isaiah text says Isaias, but its Reader ID is isaiah. Display labels and English verse text must never select Hebrew/Greek records or imply English-word alignment.

The provider now allows canonical coordinate lookup for the current published books (Genesis, Isaiah, John, Romans), with conservative chapter exclusions below. Other DRA books remain unavailable until authoritative coverage and reference compatibility are reviewed. This changes availability, not reference numbers. The existing WEB Romans doxology mapping is unchanged. Reader, Search, Compare and importer mapping policies are unchanged.

## Numbering safeguards

Inspection of the retained local js/bible/dra.js and js/bible/kjv.js bundles found these chapter-bound differences:

| Book/chapter | DRA verses | KJV verses |
| --- | ---: | ---: |
| Genesis 49 | 32 | 33 |
| Genesis 50 | 25 | 26 |
| Isaiah 45 | 26 | 25 |
| Isaiah 46 | 12 | 13 |
| John 6 | 72 | 71 |

These entire DRA chapters remain unavailable; no offset or inferred mapping is applied. Matching bounds alone do not prove textual equivalence. This change does not certify a complete cross-tradition mapping or change the conservative Compare policy. Local DRA/KJV text for Isaiah 1:1, Isaiah 53:5 and John 1:1 was inspected directly; focused browser tests require their exact published Hebrew/Greek records. Additional tests enforce the exclusions against the local bundles.

Catholic-only books and Esther/Daniel additions remain unavailable. The provider never substitutes demo records for a canonical token request. No source shards, provenance, OSHB token-range mappings or numbering data are changed.

## Verification

word-study-dra.spec.js checks the real Reader interaction for DRA/WEB/KJV Isaiah 1:1, Isaiah 53:5 and John 1:1, exact record equality, language, focus return, display-label independence and six Catholic-only unavailable passages. word-study-reference-mapping.unit.js checks both verse and token APIs and blocked coordinates. catholic-bible.spec.js retains its Catholic-only unavailable assertion.
