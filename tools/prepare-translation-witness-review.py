"""Prepare unadjudicated Latin and Ge'ez translation-witness packets."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
from importlib import import_module
import json
from pathlib import Path

witness = import_module("build-word-study-witness-inventory")
coordinates = witness.coordinates
LATIN_PILOTS = {"PHM": "philemon", "JUD": "jude", "TOB": "tobit"}


def latin_english(book):
    source = coordinates.dra_data()[book]
    return {(int(chapter), i): verse for chapter, data in source.items()
            if chapter.isdecimal() and isinstance(data, dict)
            for i, verse in enumerate(data["verses"], 1) if verse}


def geez_english(name, chapter):
    book = json.loads((coordinates.ROOT / f"data/ethiopian-readings/{name}.json").read_bytes())
    return {(chapter, int(line)): text for section in book["sections"]
            if str(section["id"]) == str(chapter) for line, text in section["lines"]
            if str(line).isdecimal() and text}


def classify(english, native, language):
    native_positions = defaultdict(list)
    for ref, text in native:
        _, chapter, verse = ref
        if str(chapter).isdecimal() and str(verse).isdecimal():
            native_positions[int(chapter), int(verse)].append({
                "sourceRef": ref, "text": text, "tokens": witness.native_tokens(text, language)
            })

    rows, totals = [], Counter()
    for ref in sorted(set(english) | set(native_positions)):
        variants = native_positions.get(ref, [])
        if ref not in english:
            status = "native-only coordinate"
        elif len(variants) > 1:
            status = "ambiguous native coordinate"
        elif not variants:
            status = "English-only coordinate"
        else:
            status = "coordinate candidate"
        totals[status] += 1
        context = [(ref[0], ref[1] + increment) for increment in (-1, 1)]
        rows.append({
            "reference": ref, "english": english.get(ref), "native": variants, "status": status,
            "nearbyNativeReferences": [row["sourceRef"] for key in context for row in native_positions.get(key, [])],
        })
    return rows, totals


def emit(output, name, english, native, language):
    rows, counts = classify(english, native, language)
    packet = {
        "language": language, "offsetUnit": "unicode-codepoint", "reviewStatus": "awaiting independent review",
        "evidenceNeeded": ["exact edition", "reference or boundary mapping", "English spans", "original token positions",
                           "morphology and rationale", "reviewer and separate adjudication"],
        "rows": rows,
    }
    payload = (json.dumps(packet, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    (output / (name + ".json")).write_bytes(payload)
    return {"rows": len(rows), "counts": counts, "sha256": sha256(payload).hexdigest(), "verified": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for source in coordinates.PINS:
        parser.add_argument(source, type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if (coordinates.ROOT / "data") in (args.output.resolve(), *args.output.resolve().parents):
        raise ValueError("Candidate packets must stay outside runtime data")
    latin = list(witness.latin_passages(coordinates.source(args.vulgate, "vulgate")))
    args.output.mkdir()
    report = {"sourceSha256": coordinates.PINS, "status": "pending", "packets": {}}
    for code, name in LATIN_PILOTS.items():
        report["packets"]["dra-"+name] = emit(args.output, "dra-"+name, latin_english(name),
                                             (row for row in latin if row[0][0] == code), "lat")
    for name in ("enoch", "jubilees"):
        native = witness.geez_passages(coordinates.source(getattr(args, name), name), name)
        rows = [row for row in native if str(row[0][1]) == "1"]
        report["packets"][name+"-1"] = emit(args.output, name+"-1", geez_english(name, 1), rows, "gez")
    (args.output / "report.json").write_bytes((json.dumps(report, indent=2) + "\n").encode())


if __name__ == "__main__":
    main()
