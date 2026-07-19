# 词库来源与许可审计

本文档记录 VocabMaster 内置词库的来源、许可状态和导入流程。发布前必须检查本文件和 `src/words/metadata.json` 是否一致。

## 当前内置词库

当前内置词库由 ECDICT 的 `ecdict.csv` 按考试标签生成。它们是 “ECDICT 标签词库”，不是教育部、考试院、IELTS 或 ETS 发布的官方考试大纲原件，发布材料不能宣称“官方完整考纲”。

| 文件 | 当前数量 | ECDICT 标签 | 来源状态 | 许可状态 |
| --- | ---: | --- | --- | --- |
| `src/words/cet4.json` | 3849 | `cet4` | `scripts/import_ecdict_wordbanks.py` 生成 | ECDICT MIT |
| `src/words/cet6.json` | 5407 | `cet6` | `scripts/import_ecdict_wordbanks.py` 生成 | ECDICT MIT |
| `src/words/postgraduate.json` | 4801 | `ky` | `scripts/import_ecdict_wordbanks.py` 生成 | ECDICT MIT |
| `src/words/ielts.json` | 5040 | `ielts` | `scripts/import_ecdict_wordbanks.py` 生成 | ECDICT MIT |
| `src/words/toefl.json` | 6974 | `toefl` | `scripts/import_ecdict_wordbanks.py` 生成 | ECDICT MIT |

## ECDICT 审计记录

- 来源 URL: <https://github.com/skywind3000/ECDICT>
- 原始 CSV: <https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv>
- 许可证: MIT
- 许可证文件: `docs/licenses/ECDICT-LICENSE.txt`
- 下载日期: 2026-07-07
- 上游 commit: `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`
- `ecdict.csv` blob sha: `c4ade63ea08cf39d9c3475e96929036d64d94c94`
- 导入脚本: `scripts/import_ecdict_wordbanks.py`
- 校验命令: `python scripts/validate_wordbanks.py`
- 校验结果: `Word banks OK`

## 字段映射

| VocabMaster 字段 | ECDICT 字段/规则 |
| --- | --- |
| `word` | `word`，最长 80 字符 |
| `phonetic` | `phonetic`，自动补 `/.../`；缺失时写 `N/A` |
| `meaning` | 优先 `translation`，缺失时用 `definition`，多行用 `；` 合并 |
| `example` | ECDICT 当前未提供可用例句，写入 `No example available in ECDICT.` |
| `exampleTranslation` | ECDICT 当前未提供可用例句翻译，写入 `ECDICT 未提供例句。` |

## 生成规则

1. 从 ECDICT CSV 读取所有词条。
2. 按 `tag` 字段映射到软件内部词库：
   - `cet4` → `cet4.json`
   - `cet6` → `cet6.json`
   - `ky` → `postgraduate.json`
   - `ielts` → `ielts.json`
   - `toefl` → `toefl.json`
3. 每个词库内按小写后的 `word` 去重。
4. 跳过没有 `word` 或没有释义的词条。
5. 输出后更新 `src/words/metadata.json`。

## 重新生成命令

```bash
python scripts/import_ecdict_wordbanks.py --download
python scripts/validate_wordbanks.py
```

如果已经下载过 ECDICT CSV，可复用缓存：

```bash
python scripts/import_ecdict_wordbanks.py --input .cache/ecdict/ecdict.csv
```

## 不采用的候选来源

- `KyleBing/english-vocabulary`：包含较完整的中文学习词库，但仓库未声明许可证，不能直接内置到本项目。
- `RealKai42/qwerty-learner` / `zyronon/TypeWords`：包含多类词库，但项目许可证为 GPL-3.0，不适合直接混入当前 MIT 项目发布。
- `exam-data/NETEMVocabulary`：考研词库来源明确，但数据许可为 CC BY-NC-SA 4.0，会引入非商业和相同方式共享限制，暂不内置。

## 校验要求

每次构建都必须通过：

```bash
python scripts/validate_wordbanks.py
```

该脚本至少检查：

- JSON 格式。
- 必填字段：`word`、`phonetic`、`meaning`、`example`、`exampleTranslation`。
- 空字段。
- 重复词。
- 超长字段。
- 未在 `metadata.json` 声明的非法类别。
- `metadata.json` 中的文件名和词条数量是否与实际文件一致。
