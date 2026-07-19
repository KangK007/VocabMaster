(function (root, factory) {
  const api = factory(root && root.VocabMasterUtils);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterSearch = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (utils) {
  const resolvedUtils = utils || (typeof require === 'function' ? require('./core-utils') : null);
  const escape = resolvedUtils && resolvedUtils.escapeHtml;
  if (typeof escape !== 'function') {
    throw new Error('VocabMasterUtils.escapeHtml is required before search-utils.js');
  }

  function filterWords(words, query, limit = 20) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];
    return (Array.isArray(words) ? words : [])
      .filter(word =>
        String(word.word || '').toLowerCase().includes(normalized) ||
        String(word.meaning || '').includes(normalized)
      )
      .slice(0, limit);
  }

  function renderSearchResultsHtml(matches) {
    if (!Array.isArray(matches) || matches.length === 0) {
      return '<div style="padding:12px 14px;color:var(--text-muted);font-size:13px;">未找到匹配单词</div>';
    }
    return matches.map(word => `
    <div class="search-result-item" data-word="${escape(word.word)}">
      <span class="search-result-word">${escape(word.word)}</span>
      <span class="search-result-meaning">${escape(word.meaning || '')}</span>
    </div>
  `).join('');
  }

  return { filterWords, renderSearchResultsHtml };
});
