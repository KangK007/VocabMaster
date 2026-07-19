"""Import ECDICT exam-tagged vocabulary into VocabMaster word banks."""
import argparse
import csv
import json
import urllib.request
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT / ".cache" / "ecdict" / "ecdict.csv"
DEFAULT_OUTPUT_DIR = ROOT / "src" / "words"
ECDICT_RAW_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
ECDICT_REPO_URL = "https://github.com/skywind3000/ECDICT"
ECDICT_LICENSE = "MIT"
PHONETIC_FALLBACK = "N/A"

TAG_TO_BANK = {
    "cet4": "cet4",
    "cet6": "cet6",
    "ky": "postgraduate",
    "ielts": "ielts",
    "toefl": "toefl",
}

BANK_LABELS = {
    "cet4": "CET-4",
    "cet6": "CET-6",
    "postgraduate": "Postgraduate English",
    "ielts": "IELTS",
    "toefl": "TOEFL",
}

EXAMPLE_PLACEHOLDER = "No example available in ECDICT."
EXAMPLE_TRANSLATION_PLACEHOLDER = "ECDICT 未提供例句。"


def download_ecdict_csv(target=DEFAULT_CACHE, url=ECDICT_RAW_URL):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, target.open("wb") as f:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    return target


def normalize_phonetic(value):
    value = (value or "").strip()
    if not value:
        return PHONETIC_FALLBACK
    if value.startswith("/") and value.endswith("/"):
        return value[:120]
    return f"/{value}/"[:120]


def normalize_meaning(row):
    translation = (row.get("translation") or "").strip()
    definition = (row.get("definition") or "").strip()
    meaning = translation or definition
    if not meaning:
        return ""
    return "；".join(part.strip() for part in meaning.splitlines() if part.strip())[:500]


def normalize_word(row):
    word = (row.get("word") or "").strip()
    meaning = normalize_meaning(row)
    if not word or not meaning:
        return None
    return {
        "word": word[:80],
        "phonetic": normalize_phonetic(row.get("phonetic")),
        "meaning": meaning,
        "example": EXAMPLE_PLACEHOLDER,
        "exampleTranslation": EXAMPLE_TRANSLATION_PLACEHOLDER,
    }


def row_tags(row):
    return {tag.strip().lower() for tag in (row.get("tag") or "").split() if tag.strip()}


def build_wordbanks_from_csv(csv_path, output_dir=DEFAULT_OUTPUT_DIR, source_revision=None, csv_blob_sha=None):
    csv_path = Path(csv_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    banks = {bank: [] for bank in BANK_LABELS}
    seen = {bank: set() for bank in BANK_LABELS}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            normalized = normalize_word(row)
            if not normalized:
                continue
            tags = row_tags(row)
            for tag, bank in TAG_TO_BANK.items():
                if tag not in tags:
                    continue
                key = normalized["word"].lower()
                if key in seen[bank]:
                    continue
                seen[bank].add(key)
                banks[bank].append(dict(normalized))

    counts = {}
    for bank, words in banks.items():
        words.sort(key=lambda item: item["word"].lower())
        (output_dir / f"{bank}.json").write_text(
            json.dumps(words, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        counts[bank] = len(words)

    metadata = {
        "schemaVersion": 1,
        "generatedFrom": "scripts/import_ecdict_wordbanks.py",
        "currentStatus": "ecdict-exam-tagged-wordbanks",
        "note": (
            "Word banks are generated from ECDICT exam tags. They are not official exam syllabus files."
        ),
        "generatedDate": date.today().isoformat(),
        "source": {
            "name": "ECDICT",
            "url": ECDICT_REPO_URL,
            "rawCsvUrl": ECDICT_RAW_URL,
            "license": ECDICT_LICENSE,
            "sourceRevision": source_revision or "master",
            "csvBlobSha": csv_blob_sha or "",
        },
        "fieldNotes": {
            "example": EXAMPLE_PLACEHOLDER,
            "exampleTranslation": EXAMPLE_TRANSLATION_PLACEHOLDER,
            "phoneticFallback": PHONETIC_FALLBACK,
        },
        "categories": {
            bank: {
                "file": f"{bank}.json",
                "count": counts[bank],
                "source": "ECDICT",
                "sourceTag": next(tag for tag, mapped in TAG_TO_BANK.items() if mapped == bank),
                "label": BANK_LABELS[bank],
            }
            for bank in BANK_LABELS
        },
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return counts


def main():
    parser = argparse.ArgumentParser(description="Import ECDICT exam-tagged word banks")
    parser.add_argument("--input", type=Path, help="Existing ECDICT CSV path")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR, help="Output src/words directory")
    parser.add_argument("--download", action="store_true", help="Download ecdict.csv before importing")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="Download cache path")
    parser.add_argument("--source-revision", default="master", help="ECDICT upstream revision or commit")
    parser.add_argument("--csv-blob-sha", default="", help="ECDICT ecdict.csv git blob sha")
    args = parser.parse_args()

    csv_path = args.input
    if args.download:
        csv_path = download_ecdict_csv(args.cache)
    if not csv_path:
        csv_path = args.cache
    if not csv_path.exists():
        raise SystemExit("ECDICT CSV not found. Use --download or pass --input.")

    counts = build_wordbanks_from_csv(
        csv_path,
        args.output,
        source_revision=args.source_revision,
        csv_blob_sha=args.csv_blob_sha,
    )
    for bank, count in counts.items():
        print(f"{bank}: {count}")


if __name__ == "__main__":
    main()
