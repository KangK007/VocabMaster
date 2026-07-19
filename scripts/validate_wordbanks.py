"""Validate bundled VocabMaster word-bank JSON files."""
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORDS_DIR = ROOT / "src" / "words"
REQUIRED_FIELDS = ("word", "phonetic", "meaning", "example", "exampleTranslation")
PLACEHOLDER_VALUES = {
    "example": "No example available in ECDICT.",
    "exampleTranslation": "ECDICT 未提供例句。",
}
MAX_LENGTHS = {
    "word": 80,
    "phonetic": 120,
    "meaning": 500,
    "example": 500,
    "exampleTranslation": 500,
}


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        return exc


def validate_wordbanks(words_dir=DEFAULT_WORDS_DIR):
    words_dir = Path(words_dir)
    errors = []
    metadata_path = words_dir / "metadata.json"
    metadata = {}
    if metadata_path.exists():
        loaded_metadata = _read_json(metadata_path)
        if isinstance(loaded_metadata, Exception):
            errors.append(f"metadata.json: invalid JSON: {loaded_metadata}")
        elif not isinstance(loaded_metadata, dict):
            errors.append("metadata.json: root must be an object")
        else:
            metadata = loaded_metadata

    category_meta = metadata.get("categories", {}) if isinstance(metadata, dict) else {}
    json_files = sorted(path for path in words_dir.glob("*.json") if path.name != "metadata.json")
    if not json_files:
        errors.append(f"{words_dir}: no word-bank JSON files found")

    for path in json_files:
        category = path.stem
        if category_meta and category not in category_meta:
            errors.append(f"{path.name}: category '{category}' is not declared in metadata")
        data = _read_json(path)
        if isinstance(data, Exception):
            errors.append(f"{path.name}: invalid JSON: {data}")
            continue
        if not isinstance(data, list):
            errors.append(f"{path.name}: root must be a list")
            continue

        seen = set()
        for index, item in enumerate(data):
            prefix = f"{path.name}[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{prefix}: item must be an object")
                continue

            for field in REQUIRED_FIELDS:
                value = item.get(field)
                if not isinstance(value, str) or not value.strip():
                    errors.append(f"{prefix}: missing required field '{field}'")
                    continue
                if len(value) > MAX_LENGTHS[field]:
                    errors.append(f"{prefix}: field '{field}' exceeds {MAX_LENGTHS[field]} chars")
                if PLACEHOLDER_VALUES.get(field) == value.strip():
                    errors.append(f"{prefix}: field '{field}' still contains the ECDICT placeholder")

            word = item.get("word")
            if isinstance(word, str):
                normalized = word.strip().lower()
                if normalized in seen:
                    errors.append(f"{prefix}: duplicate word '{word}'")
                seen.add(normalized)

        meta = category_meta.get(category)
        if meta:
            expected_file = meta.get("file")
            expected_count = meta.get("count")
            if expected_file and expected_file != path.name:
                errors.append(f"{path.name}: metadata file mismatch '{expected_file}'")
            if isinstance(expected_count, int) and expected_count != len(data):
                errors.append(
                    f"{path.name}: metadata count {expected_count} does not match actual count {len(data)}"
                )

    for category, meta in category_meta.items():
        filename = meta.get("file")
        if filename and not (words_dir / filename).exists():
            errors.append(f"metadata category '{category}': missing file '{filename}'")

    return errors


def main():
    words_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WORDS_DIR
    errors = validate_wordbanks(words_dir)
    if errors:
        for error in errors:
            print(error)
        return 1
    print("Word banks OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
