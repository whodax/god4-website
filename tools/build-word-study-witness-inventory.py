"""Create source-token review inventories for the pinned Latin and Ge'ez witnesses."""
import argparse
from collections import Counter
from hashlib import sha256
from importlib import import_module
import json
from pathlib import Path
import re
import unicodedata

coordinates = import_module("audit-witness-coordinates")


def native_tokens(text, language):
    def is_part(character):
        category = unicodedata.category(character)[0]
        if language == "lat":
            return category == "M" or (category == "L" and "LATIN" in unicodedata.name(character, ""))
        return category in {"L", "M"} and "ETHIOPIC" in unicodedata.name(character, "")

    native = []
    start = None
    for index, character in enumerate(text + " "):
        if is_part(character):
            if start is None:
                start = index
        elif start is not None:
            native.append({"i": len(native), "start": start, "end": index, "surface": text[start:index]})
            start = None
    return native


def latin_passages(root):
    for book in root.findall("book"):
        chapter = None
        rows = list(book)
        for i, marker in enumerate(rows):
            if marker.tag == "c":
                chapter = marker.get("id")
            if marker.tag != "v":
                continue
            if i + 1 == len(rows) or rows[i + 1].tag != "ve" or not marker.tail:
                raise ValueError("Unsupported Clementine verse markup")
            yield (book.attrib["id"], chapter, marker.get("id")), marker.tail


def geez_passages(root, name):
    selected, = [element for element in root.iter() if element.get(coordinates.XML_ID) == "EOTCed"]
    for chapter in selected.iter(coordinates.TEI + "div"):
        if chapter.get("subtype") != "chapter":
            continue
        label = chapter.get("n")
        xmlid = chapter.get(coordinates.XML_ID, "")
        match = re.fullmatch(r"Cap([0-9]+)", xmlid)
        if name == "jubilees" and match:
            label = match[1]
        for line in chapter.iter(coordinates.TEI + "l"):
            if len(line):
                raise ValueError("Unsupported inline Ge'ez line markup")
            yield (name, label or xmlid, line.get("n")), line.text or ""


def inventory(passages, language, target):
    digest = sha256()
    refs = set()
    metrics = {"records": 0, "uniqueNumeric": 0, "tokens": 0, "byBook": {}}
    with target.open("w", encoding="utf-8", newline="\n") as out:
        for ref, text in passages:
            if ref in refs:
                raise ValueError(f"Duplicate native coordinate {ref}")
            refs.add(ref)
            tokens = native_tokens(text, language)
            if not tokens:
                raise ValueError(f"No native tokens at {ref}")
            row = {"sourceRef": ref, "language": language, "text": text, "tokens": tokens,
                   "offsetUnit": "unicode-codepoint", "status": "awaiting-alignment-evidence"}
            written = json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
            out.write(written)
            digest.update(written.encode())
            book = metrics["byBook"].setdefault(ref[0], {"records": 0, "tokens": 0})
            book["records"] += 1
            book["tokens"] += len(tokens)
            metrics["records"] += 1
            metrics["tokens"] += len(tokens)
            if all((part or "").isdecimal() for part in ref[1:]):
                metrics["uniqueNumeric"] += 1
    return {**metrics, "sha256": digest.hexdigest(), "verifiedEnglishAlignments": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in coordinates.PINS:
        parser.add_argument(key, type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if (coordinates.ROOT / "data") in args.output.resolve().parents:
        raise ValueError("Source review inventories must stay outside runtime data")
    args.output.mkdir()
    report = {"sourceSha256": coordinates.PINS,
              "license": {"vulgate": "Public domain Clementine Vulgate Project",
                          "enoch": "CC BY-SA 4.0 EOTCed branch",
                          "jubilees": "CC BY-SA 4.0 EOTCed branch"},
              "vulgate": inventory(latin_passages(coordinates.source(args.vulgate, "vulgate")),
                                    "lat", args.output / "vulgate.jsonl")}
    for name in ("enoch", "jubilees"):
        report[name] = inventory(geez_passages(coordinates.source(getattr(args, name), name), name),
                                 "gez", args.output / (name + ".jsonl"))
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
