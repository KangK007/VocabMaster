# innerHTML 渲染点安全审查

审查时间：2026-07-19
审查范围：`src/*.js` 中所有 `innerHTML`、`outerHTML`、`insertAdjacentHTML` 使用点。
结论：未发现用户可控内容未经转义直接写入 `innerHTML` 的明确问题；新增回归测试覆盖备份列表、错题本、统计渲染中的 HTML 注入样例。

## 审查结果

| 文件 | 渲染点 | 数据来源 | 当前处理 | 风险 |
| --- | --- | --- | --- | --- |
| `src/app.js` | `renderReviewForecast()` | 本地日期偏移和复习数量 | label 使用 `escapeHtml`，数值来自本地计算 | 低 |
| `src/app.js` | `updateWordInsights()` | 词性、词根词缀、收藏和复习次数 | label、title、class token 使用 `escapeHtml` | 低 |
| `src/app.js` | `renderTestQuestion()` | 词库释义和选项 | 选项释义使用 `escapeHtml` | 低 |
| `src/app.js` | `showCompleteOverlay()` | 今日统计、学习报告、薄弱词 | 薄弱词和建议使用 `escapeHtml`，计数来自本地计算 | 低 |
| `src/app.js` | `renderSearchResults()` | 词库搜索结果 | 由 `renderSearchResultsHtml()` 统一转义 | 低 |
| `src/app.js` | `renderWordbookPage()` | 内置词库统计 | category label 转义，数值来自本地计算 | 低 |
| `src/app.js` | `showOnboarding()` | 静态引导文案 | 文案写死在源码中，允许 `<br>` 和 `<strong>` | 低 |
| `src/app.js` | 启动失败页 | 异常消息 | `err.message` 使用 `escapeHtml` | 低 |
| `src/backup-actions.js` | `renderBackupListHtml()` | 本地备份文件元信息 | id、时间使用 `escapeHtml`；测试覆盖恶意字符串 | 低 |
| `src/error-book.js` | `renderErrorBookList()` | 错题本单词、词库、日期 | 字符串字段使用 `escapeHtml`；测试覆盖恶意字符串 | 低 |
| `src/stats-renderer.js` | 统计卡片、测试历史、周报、成就 | 本地统计和测试历史 | 用户可控字段使用 `escapeHtml`；测试覆盖恶意字符串 | 低 |
| `src/search-utils.js` | `renderSearchResultsHtml()` | 词库单词和释义 | word、meaning 使用 `escapeHtml` | 低 |

## 已补测试

- `tests/backup-actions.test.js`：备份 id 和修改时间中的 HTML 字符串不会渲染为标签。
- `tests/error-book.test.js`：错题词、词库名和日期中的 HTML 字符串不会渲染为标签。
- `tests/stats-renderer.test.js`：周报、测试历史、成就标题/详情中的 HTML 字符串不会渲染为标签。

## 后续建议

- 新增 `innerHTML` 时必须同步说明数据来源；如果数据来自用户输入、导入文件或词库内容，应优先使用 `textContent` 或 DOM API。
- 允许 HTML 的位置仅限静态源码文案，例如新手引导里的 `<br>` 和 `<strong>`。
- 后续如果引入在线例句、AI 内容或第三方词库，需要重新执行本审查。
