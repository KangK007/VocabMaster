import csv
import tempfile
import unittest
from pathlib import Path


class EcdictImportTests(unittest.TestCase):
    def test_builds_exam_banks_from_ecdict_tags(self):
        from scripts.import_ecdict_wordbanks import build_wordbanks_from_csv

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            csv_path = root / "ecdict.csv"
            output_dir = root / "words"
            with csv_path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=[
                        "word", "phonetic", "definition", "translation", "pos",
                        "collins", "oxford", "tag", "bnc", "frq", "exchange",
                        "detail", "audio"
                    ],
                )
                writer.writeheader()
                writer.writerow({
                    "word": "abandon",
                    "phonetic": "əˈbændən",
                    "translation": "v. 放弃；抛弃",
                    "tag": "cet4 toefl"
                })
                writer.writerow({
                    "word": "academic",
                    "phonetic": "ˌækəˈdemɪk",
                    "translation": "adj. 学术的",
                    "tag": "ky ielts"
                })
                writer.writerow({
                    "word": "broken",
                    "phonetic": "",
                    "translation": "",
                    "tag": "cet6"
                })

            counts = build_wordbanks_from_csv(csv_path, output_dir)

        self.assertEqual(counts["cet4"], 1)
        self.assertEqual(counts["cet6"], 0)
        self.assertEqual(counts["postgraduate"], 1)
        self.assertEqual(counts["ielts"], 1)
        self.assertEqual(counts["toefl"], 1)


if __name__ == "__main__":
    unittest.main()
