# Word Bank Sources and License Notes

This project currently ships small, project-maintained demo word banks for CET-4, CET-6, postgraduate, IELTS, and TOEFL study flows. They are suitable for application testing and workflow demonstration, but they should not be presented as complete exam syllabi.

## Current bundled word banks

| File | Current count | Source status | License status |
| --- | ---: | --- | --- |
| `src/words/cet4.json` | 101 | Project-maintained demo entries generated from `build_wordbanks.py` | Covered by the project license unless replaced with external data |
| `src/words/cet6.json` | 50 | Project-maintained demo entries generated from `build_wordbanks.py` | Covered by the project license unless replaced with external data |
| `src/words/postgraduate.json` | 50 | Project-maintained demo entries generated from `build_wordbanks.py` | Covered by the project license unless replaced with external data |
| `src/words/ielts.json` | 50 | Project-maintained demo entries generated from `build_wordbanks.py` | Covered by the project license unless replaced with external data |
| `src/words/toefl.json` | 50 | Project-maintained demo entries generated from `build_wordbanks.py` | Covered by the project license unless replaced with external data |

## Candidate external source

- ECDICT: <https://github.com/skywind3000/ECDICT>
  - Public description: Free English to Chinese Dictionary Database.
  - GitHub reports the repository license as MIT.
  - Candidate use: enrich meanings, phonetics, tags, and frequency metadata after field mapping and attribution are implemented.
  - Not currently bundled: no ECDICT data has been imported into the current JSON word banks by this project state.

## Import rules for future word-bank expansion

Before importing any external vocabulary dataset:

1. Record the upstream URL, license name, license URL, download date, and exact upstream revision or release.
2. Keep the upstream license text or a clear reference in `docs/licenses/` when redistribution requires it.
3. Add a reproducible import script instead of manually editing generated JSON.
4. Preserve enough metadata to trace each generated word entry back to its source.
5. Validate schema fields: `word`, `phonetic`, `meaning`, `example`, and `exampleTranslation`.
6. Deduplicate case-insensitively within each category.
7. Do not label a generated list as a complete official exam syllabus unless the source is an official syllabus or a verified licensed derivative.

## Current limitation

The current exam categories are learning/demo categories, not legally or academically verified official word lists. For serious exam preparation, the next step is to add a documented import pipeline and a vetted source list.
