# Romans original-language publication candidate

Reviewed pilot: 2026-10-08, canonical run-a; independently reproduced by run-b.
Importer baseline: fe7cc176859fbf2a5459a96222b65f15e79f3b83.
The 16 chapter shards were copied without regeneration or rewriting. Both pilot runs,
the retained manifests, and the copied files agree byte-for-byte and by SHA-256.
All retained diagnostic error lists were empty.

## Provenance

Text: Robinson–Pierpont Byzantine Textform, RP2018 lineage, byztxt v3.3.2,
2024-12-31, commit 27a45ff1b7be6c17ccbfeac414f3f55732ae8e28.
Artifacts: csv-unicode/strongs/with-parsing/ROM.csv and source/Strongs/06_ROM.BP5
from https://github.com/byztxt/byzantine-majority-text.
Public domain / Unlicense; credits: Maurice A. Robinson, Pierpont, byztxt maintainers.

Lexicon: Strong's Greek Dictionary (1890), XML 1.4, Ulrik Petersen edition,
2007-09-14; Open Scriptures checkout 0acd2f251c2d35ff8db2dece4e0593979d3ac223.
Artifact: greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml from
https://github.com/openscriptures/strongs.
Public domain; notice: "Public Domain -- Copy Freely".
Credits: James Strong, Michael Grier, Ulrik Petersen, Open Scriptures.
Every published record retains the reviewed source attribution.

Verified source artifact SHA-256:

- ROM.csv: bd51f4a9c7ae194974b1e53af1d7a06ba355718bf08c82518b4f22511524a0b2
- 06_ROM.BP5: 89a013fc568068b61f435f5d0a2cfab63c58877f879758e5800f930541cc8e3e
- strongsgreek.xml: e35b11bc93e95a782031654f1b120de3cfc8523fc1395894cea4a68b8f50af1a

## Reviewed coverage and decisions

16 chapters, 433 Reader verses, 7,210 running-text tokens, 5,596,598 bytes.
All Strong's joins, transliterations and morphology populated; no missing Reader
verses, duplicate mappings, token gaps or unexplained diagnostic failures.
Pronunciation and partOfSpeech are intentionally null under the existing contract.

Source Romans 14:24, 14:25, 14:26 map respectively to Reader 16:25, 16:26, 16:27.
Reader chapter 14 ends at verse 23; 16:24 retains its identity mapping.
Romans 8:28 contains one παντα, token index 7, G3956. The explicit
first-source-analysis policy serializes A-APN; the reviewed alternate A-NPN
is retained here as audit evidence, not as a second running-text token.

English-word alignment is not included. This is a verse-level Greek token resource;
English dictionary behavior and translation differences remain separate concerns.
Genesis and John data, runtime discovery, UI and shell cache 18 are unchanged.
The chapter JSON is lazily fetched and is not persistently precached by the service worker.

## Publication-source checksums

SHA-256 and byte sizes below reproduce the retained canonical pilot manifest.
Production paths are data/word-study/original-language/romans/{chapter}.json.
The narrowly scoped .gitattributes rule disables line-ending conversion for these
shards so Windows checkouts retain the reviewed bytes and checksums.

| Chapter | Bytes | SHA-256 |
| --- | --- | --- |
| 1 | 423659 | 93e30c2c9c0b4d02fdb416342304a753c6e8372e5009e054d5b30e2ad61ce0d9 |
| 2 | 351704 | c1959b05150d21acde63aaf24af3e131ee0080c01f8ff979b4902e4bc6548f5e |
| 3 | 335220 | 73786991ef25171d19f66ab5adbc99230ac250e99548d9a6404a17420b475dec |
| 4 | 319217 | d0c4b04c31a46a5920c64cdcd6459124466ef31a41367b81f9f343d6c4c708ba |
| 5 | 332032 | 972aaf45b247f05bca3c0cb17930baf84e073b77b3265c9a691c1a51f9de6d0a |
| 6 | 287775 | 03fcfadf9e1ae53a6d5202027c821fa203c2b70d9d6eaea99e514f4ba2fbfeb3 |
| 7 | 361265 | f4f3e662b19eeeb048ff0789569ce87972bd7e455d8134b35980bd3b45e32631 |
| 8 | 515883 | d3a89727883c09994395de589c92a4d343e7b4108d1bb47eeba682d0c18f4458 |
| 9 | 412669 | a402ac826c9763531589b653f41881c41b5ca0a06908fe4c90b988d4d579e05b |
| 10 | 270644 | abec31bb08eb30b626fe4c11e94993ae37a40de7cea271af72680b63c0950a25 |
| 11 | 462925 | 999c8a53a7a3b2195a54caf7fd82fb103b9cbdf3c3a68f4ac1466abfec77cb4c |
| 12 | 239488 | d7d5bd09a23db5b3d6610ce30d10f6c8312c656b6b593a421924f8c9601380d3 |
| 13 | 212481 | 1d0bb22b0baed6d9f290623b25d41d017accba8ddf650173e30eff47f5aaf24b |
| 14 | 305444 | c510cadfd32419958fad18a56b2bf54053ffdc908bd75ffd79ff090f155e13a4 |
| 15 | 429553 | a862f895b1a3dd3cb2683a4927f9b8869cd1fb89be82867a489c103dd9d96e16 |
| 16 | 336639 | 72ff28b8888084ff8a04dd1b6cf6921bff4ee778ceeffa344001db4699f75c9d |

## Acceptance

Local data tests verify schema, complete Reader coverage, primary alternate policy,
reviewed reference mapping and the checksums above. Browser tests exercise Romans
1:1, 8:13, 8:28, 16:25, 16:26 and 16:27, Greek token details, independent English
lookup, keyboard dismissal and narrow layouts, plus Genesis 1:1, John 1:1 and
Isaiah 11:3 preservation.

Cloudflare preview acceptance remains required after a separately authorized branch
deployment: manually check those six Romans passages, Genesis Hebrew, John Greek,
and the hidden Isaiah original-language section. This candidate does not deploy,
push, merge or automatically publish anything.
