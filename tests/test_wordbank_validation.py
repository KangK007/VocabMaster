import json
import tempfile
import unittest
from pathlib import Path


class WordbankValidationTests(unittest.TestCase):
    def test_valid_wordbank_and_metadata_pass(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            words_dir = root / "words"
            words_dir.mkdir()
            (words_dir / "cet4.json").write_text(
                json.dumps([
                    {
                        "word": "example",
                        "phonetic": "/ig'zampel/",
                        "meaning": "n. example",
                        "example": "This is an example.",
                        "exampleTranslation": "这是一个例子。"
                    }
                ]),
                encoding="utf-8",
            )
            metadata = {
                "categories": {
                    "cet4": {
                        "file": "cet4.json",
                        "count": 1,
                        "source": "test"
                    }
                }
            }
            (words_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")

            errors = validate_wordbanks(words_dir)

        self.assertEqual(errors, [])

    def test_reports_missing_required_fields(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            (words_dir / "cet4.json").write_text(
                json.dumps([{"word": "example", "meaning": "n. example"}]),
                encoding="utf-8",
            )

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("missing required field" in error for error in errors))

    def test_reports_duplicate_words_case_insensitively(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            item = {
                "word": "Example",
                "phonetic": "/x/",
                "meaning": "n. example",
                "example": "Example.",
                "exampleTranslation": "例子。"
            }
            duplicate = dict(item, word="example")
            (words_dir / "cet4.json").write_text(json.dumps([item, duplicate]), encoding="utf-8")

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("duplicate word" in error for error in errors))

    def test_reports_metadata_count_mismatch(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            (words_dir / "cet4.json").write_text(
                json.dumps([
                    {
                        "word": "example",
                        "phonetic": "/x/",
                        "meaning": "n. example",
                        "example": "Example.",
                        "exampleTranslation": "例子。"
                    }
                ]),
                encoding="utf-8",
            )
            (words_dir / "metadata.json").write_text(
                json.dumps({"categories": {"cet4": {"file": "cet4.json", "count": 2}}}),
                encoding="utf-8",
            )

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("metadata count" in error for error in errors))

    def test_reports_json_file_not_declared_in_metadata(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            item = {
                "word": "example",
                "phonetic": "/x/",
                "meaning": "n. example",
                "example": "Example.",
                "exampleTranslation": "例子。"
            }
            (words_dir / "cet4.json").write_text(json.dumps([item]), encoding="utf-8")
            (words_dir / "unknown.json").write_text(json.dumps([item]), encoding="utf-8")
            (words_dir / "metadata.json").write_text(
                json.dumps({"categories": {"cet4": {"file": "cet4.json", "count": 1}}}),
                encoding="utf-8",
            )

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("not declared in metadata" in error for error in errors))

    def test_reports_overlong_fields(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            (words_dir / "cet4.json").write_text(
                json.dumps([
                    {
                        "word": "example",
                        "phonetic": "/x/",
                        "meaning": "x" * 501,
                        "example": "Example.",
                        "exampleTranslation": "例子。"
                    }
                ]),
                encoding="utf-8",
            )

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("exceeds" in error for error in errors))

    def test_reports_ecdict_example_placeholders(self):
        from scripts.validate_wordbanks import validate_wordbanks

        with tempfile.TemporaryDirectory() as tmp:
            words_dir = Path(tmp)
            (words_dir / "cet4.json").write_text(
                json.dumps([
                    {
                        "word": "example",
                        "phonetic": "/x/",
                        "meaning": "n. example",
                        "example": "No example available in ECDICT.",
                        "exampleTranslation": "ECDICT 未提供例句。"
                    }
                ]),
                encoding="utf-8",
            )

            errors = validate_wordbanks(words_dir)

        self.assertTrue(any("ECDICT placeholder" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
