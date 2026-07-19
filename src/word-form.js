(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterWordForm = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const FIELD_IDS = [
    'add-word-text',
    'add-word-phonetic',
    'add-word-meaning',
    'add-word-example',
    'add-word-example-trans'
  ];

  function valueOf(doc, id) {
    const el = doc.getElementById(id);
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  function readCustomWordForm(doc) {
    return {
      word: valueOf(doc, 'add-word-text'),
      phonetic: valueOf(doc, 'add-word-phonetic'),
      meaning: valueOf(doc, 'add-word-meaning'),
      example: valueOf(doc, 'add-word-example'),
      exampleTranslation: valueOf(doc, 'add-word-example-trans')
    };
  }

  function validateCustomWord(word) {
    if (!word || !word.word || !word.meaning) {
      return { ok: false, message: '请至少填写单词和释义' };
    }
    return { ok: true };
  }

  function clearCustomWordForm(doc, ids = FIELD_IDS) {
    ids.forEach(id => {
      const el = doc.getElementById(id);
      if (el) el.value = '';
    });
  }

  function openAddWordOverlay(doc) {
    const overlay = doc.getElementById('add-word-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  function closeAddWordOverlay(doc) {
    const overlay = doc.getElementById('add-word-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  async function submitCustomWord(doc, deps) {
    const word = readCustomWordForm(doc);
    const validation = validateCustomWord(word);
    if (!validation.ok) {
      deps.showToast(validation.message, 'warning');
      return;
    }

    try {
      const result = await deps.api.add_custom_word(deps.state.category, word);
      if (result && result.success) {
        deps.showToast(result.message, 'success');
        if (deps.closeOverlay) {
          deps.closeOverlay();
        } else {
          closeAddWordOverlay(doc);
        }
        clearCustomWordForm(doc);
        if (deps.invalidateWordCache) deps.invalidateWordCache(deps.state.category);
        await deps.loadWordList();
        deps.renderCard();
      } else if (result) {
        deps.showToast(result.message, 'error');
      }
    } catch (e) {
      deps.showToast('添加失败: ' + e.message, 'error');
    }
  }

  function bindCustomWordForm(doc, deps) {
    const openOverlay = deps.openOverlay || (() => openAddWordOverlay(doc));
    const closeOverlay = deps.closeOverlay || (() => closeAddWordOverlay(doc));
    doc.getElementById('btn-add-save')?.addEventListener('click', () => submitCustomWord(doc, deps));
    doc.getElementById('btn-add-cancel')?.addEventListener('click', closeOverlay);
    doc.getElementById('btn-add-word')?.addEventListener('click', openOverlay);
  }

  return {
    readCustomWordForm,
    validateCustomWord,
    clearCustomWordForm,
    openAddWordOverlay,
    closeAddWordOverlay,
    submitCustomWord,
    bindCustomWordForm
  };
});
