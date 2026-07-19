(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterBackupActions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const utils = (typeof window !== 'undefined' && window.VocabMasterUtils)
    || (typeof require === 'function' ? require('./core-utils') : null);
  const escapeHtml = utils && utils.escapeHtml;
  if (typeof escapeHtml !== 'function') {
    throw new Error('VocabMasterUtils.escapeHtml is required before backup-actions.js');
  }

  function describeApiResult(result, actionName) {
    if (!result) {
      return {
        ok: false,
        message: '操作失败：无法连接到后端服务',
        type: 'error'
      };
    }
    if (result.success) {
      return {
        ok: true,
        message: result.message || `${actionName}成功`,
        type: 'success'
      };
    }
    return {
      ok: false,
      message: result.message || `${actionName}失败`,
      type: 'error'
    };
  }

  function shouldReloadAfterRestore(result) {
    return Boolean(result && result.success);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function renderBackupListHtml(backups) {
    if (!Array.isArray(backups) || backups.length === 0) {
      return '<div class="backup-empty">暂无本地安全备份</div>';
    }
    return backups.map(backup => `
      <div class="backup-item" data-backup-id="${escapeHtml(backup.id)}">
        <div class="backup-meta">
          <div class="backup-name">${escapeHtml(backup.id)}</div>
          <div class="backup-detail">${escapeHtml(backup.modified || '')} · ${escapeHtml(formatBytes(backup.size))}</div>
        </div>
        <div class="backup-actions">
          <button class="btn-sm backup-restore" data-backup-id="${escapeHtml(backup.id)}">恢复</button>
          <button class="btn-sm backup-delete" data-backup-id="${escapeHtml(backup.id)}">删除</button>
        </div>
      </div>
    `).join('');
  }

  async function runImport(deps) {
    try {
      const result = await deps.api.import_words();
      const outcome = describeApiResult(result, '导入');
      deps.showToast(outcome.message, outcome.type);
      const previewEl = deps.doc && deps.doc.getElementById('import-preview-status');
      if (previewEl && result && result.preview) {
        const preview = result.preview;
        previewEl.textContent = `上次导入：${preview.category}，新增 ${preview.added} 个，重复 ${preview.duplicates} 个，无效 ${preview.invalid} 个。`;
      } else if (previewEl && !outcome.ok && result && result.message) {
        previewEl.textContent = result.message;
      }
      if (outcome.ok) {
        if (deps.invalidateWordCache) deps.invalidateWordCache();
        await deps.loadWordList();
        deps.renderCard();
      }
    } catch (e) {
      deps.showToast('导入失败: ' + e.message, 'error');
    }
  }

  async function runExport(deps) {
    try {
      const result = await deps.api.export_data();
      const outcome = describeApiResult(result, '导出');
      deps.showToast(outcome.message, outcome.type);
    } catch (e) {
      deps.showToast('导出失败: ' + e.message, 'error');
    }
  }

  async function runRestore(deps) {
    if (!(await deps.confirm('恢复备份将覆盖当前学习数据，是否继续？'))) return;
    try {
      const result = await deps.api.restore_data();
      const outcome = describeApiResult(result, '恢复');
      deps.showToast(outcome.message, outcome.type);
      if (shouldReloadAfterRestore(result)) {
        if (deps.invalidateWordCache) deps.invalidateWordCache();
        await deps.loadData();
        await deps.loadFavorites();
        await deps.loadWordList();
        deps.renderCard();
      }
    } catch (e) {
      deps.showToast('恢复失败: ' + e.message, 'error');
    }
  }

  async function runReset(deps) {
    if (!(await deps.confirm('确定要重置所有学习进度吗？此操作不可撤销。'))) return;
    try {
      const result = await deps.api.reset_progress();
      const outcome = describeApiResult(result, '重置');
      deps.showToast(outcome.message, outcome.ok ? 'warning' : outcome.type);
      if (!outcome.ok) return;
      if (deps.invalidateWordCache) deps.invalidateWordCache();
      await deps.loadData();
      if (deps.loadFavorites) await deps.loadFavorites();
      await deps.loadWordList();
      deps.renderCard();
    } catch (e) {
      deps.showToast('重置失败', 'error');
    }
  }

  async function refreshBackupList(doc, deps) {
    const list = doc.getElementById('backup-list');
    if (!list) return;
    try {
      const backups = await deps.api.list_backups();
      list.innerHTML = renderBackupListHtml(backups);
      list.querySelectorAll('.backup-restore').forEach(btn => {
        btn.addEventListener('click', () => restoreManagedBackup(btn.dataset.backupId, doc, deps));
      });
      list.querySelectorAll('.backup-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteManagedBackup(btn.dataset.backupId, doc, deps));
      });
    } catch (e) {
      list.innerHTML = '<div class="backup-empty">备份列表读取失败</div>';
    }
  }

  async function openBackupManager(doc, deps) {
    const panel = doc.getElementById('backup-manager');
    if (panel) panel.classList.remove('hidden');
    await refreshBackupList(doc, deps);
  }

  async function restoreManagedBackup(backupId, doc, deps) {
    if (!(await deps.confirm('恢复该备份将覆盖当前学习数据，是否继续？'))) return;
    const result = await deps.api.restore_backup(backupId);
    const outcome = describeApiResult(result, '恢复');
    deps.showToast(outcome.message, outcome.type);
    if (shouldReloadAfterRestore(result)) {
      if (deps.invalidateWordCache) deps.invalidateWordCache();
      await deps.loadData();
      await deps.loadFavorites();
      await deps.loadWordList();
      deps.renderCard();
      await refreshBackupList(doc, deps);
    }
  }

  async function deleteManagedBackup(backupId, doc, deps) {
    if (!(await deps.confirm('确定删除该备份吗？'))) return;
    const result = await deps.api.delete_backup(backupId);
    const outcome = describeApiResult(result, '删除');
    deps.showToast(outcome.message, outcome.type);
    await refreshBackupList(doc, deps);
  }

  function bindBackupActions(doc, deps) {
    doc.getElementById('btn-import')?.addEventListener('click', () => runImport(deps));
    doc.getElementById('btn-export')?.addEventListener('click', () => runExport(deps));
    doc.getElementById('btn-restore')?.addEventListener('click', () => runRestore(deps));
    doc.getElementById('btn-reset')?.addEventListener('click', () => runReset(deps));
    doc.getElementById('btn-backups')?.addEventListener('click', () => openBackupManager(doc, deps));
    doc.getElementById('btn-backups-refresh')?.addEventListener('click', () => refreshBackupList(doc, deps));
  }

  return {
    describeApiResult,
    shouldReloadAfterRestore,
    renderBackupListHtml,
    runImport,
    runExport,
    runRestore,
    runReset,
    refreshBackupList,
    openBackupManager,
    bindBackupActions
  };
});
