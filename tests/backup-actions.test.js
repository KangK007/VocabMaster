const assert = require('assert');
const {
  describeApiResult,
  shouldReloadAfterRestore,
  renderBackupListHtml,
  runImport,
  runReset
} = require('../src/backup-actions');

assert.deepStrictEqual(
  describeApiResult(null, '导出'),
  { ok: false, message: '操作失败：无法连接到后端服务', type: 'error' }
);

assert.deepStrictEqual(
  describeApiResult({ success: true, message: '完成' }, '导出'),
  { ok: true, message: '完成', type: 'success' }
);

assert.deepStrictEqual(
  describeApiResult({ success: false, message: '失败' }, '导入'),
  { ok: false, message: '失败', type: 'error' }
);

assert.strictEqual(shouldReloadAfterRestore({ success: true }), true);
assert.strictEqual(shouldReloadAfterRestore({ success: false }), false);

assert.strictEqual(
  renderBackupListHtml([]),
  '<div class="backup-empty">暂无本地安全备份</div>'
);

const html = renderBackupListHtml([
  { id: 'backup-1.json', modified: '2026-07-07T10:00:00', size: 2048 }
]);
assert.ok(html.includes('backup-1.json'));
assert.ok(html.includes('2.0 KB'));

const escapedBackupHtml = renderBackupListHtml([
  { id: 'backup-<img src=x onerror=alert(1)>.json', modified: '<script>alert(1)</script>', size: 512 }
]);
assert.ok(!escapedBackupHtml.includes('<img'));
assert.ok(!escapedBackupHtml.includes('<script>'));
assert.ok(escapedBackupHtml.includes('&lt;img'));

(async () => {
  const state = {
    progress: { old_cet4: { interval: 9 } },
    todayStats: { studied: 2, correct: 1, total: 2 },
    stats: { daily: {}, streak: 3, lastStudyDate: '2026-07-15' }
  };
  const messages = [];
  let reloaded = false;

  await runReset({
    confirm: () => true,
    api: { reset_progress: async () => ({ success: false, message: '磁盘写入失败' }) },
    state,
    showToast: (message, type) => messages.push({ message, type }),
    loadData: async () => { reloaded = true; },
    loadFavorites: async () => {},
    loadWordList: async () => {},
    renderCard: () => {}
  });

  assert.strictEqual(reloaded, false);
  assert.ok(state.progress.old_cet4);
  assert.deepStrictEqual(messages.at(-1), { message: '磁盘写入失败', type: 'error' });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

(async () => {
  const preview = { textContent: '' };
  let loaded = false;
  await runImport({
    doc: { getElementById: id => (id === 'import-preview-status' ? preview : null) },
    api: {
      import_words: async () => ({
        success: true,
        message: '导入完成',
        preview: { category: 'cet4', added: 2, duplicates: 1, invalid: 0 }
      })
    },
    showToast: () => {},
    invalidateWordCache: () => {},
    loadWordList: async () => { loaded = true; },
    renderCard: () => {}
  });

  assert.strictEqual(loaded, true);
  assert.ok(preview.textContent.includes('新增 2 个'));
  assert.ok(preview.textContent.includes('重复 1 个'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
