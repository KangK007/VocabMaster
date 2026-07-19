(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterKeyboardShortcuts = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function shouldIgnoreShortcut(event) {
    const tagName = event && event.target && event.target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA';
  }

  function resolveShortcutAction(event, context) {
    const key = event.key;
    const isCommand = Boolean(event.ctrlKey || event.metaKey);
    if (key === 'ArrowLeft') return 'go-back';
    if (key === 'ArrowRight') return 'confirm-next';
    if (key === 'Enter' && context.mode !== 'test') return 'confirm-next';
    if (key === '1' && context.mode !== 'test') return 'rate-remember';
    if (key === '2' && context.mode !== 'test') return 'rate-easy';
    if (key === '3' && context.mode !== 'test') return 'rate-forgot';
    if (key === ' ' && context.mode !== 'test' && context.hasCurrentWord) return 'pronounce';
    if (key === 'r' && !isCommand) return 'mode-review';
    if (key === 'n' && !isCommand) return 'mode-new';
    if (key === 'w' && !isCommand) return 'mode-weak';
    if (key === 't' && !isCommand) return 'mode-test';
    if (key === 'n' && isCommand) return 'open-add-word';
    return null;
  }

  function createShortcutHandler(getContext, actions) {
    return function handleShortcut(event) {
      if (shouldIgnoreShortcut(event)) return;
      const action = resolveShortcutAction(event, getContext());
      if (!action || !actions[action]) return;
      event.preventDefault();
      actions[action]();
    };
  }

  return {
    shouldIgnoreShortcut,
    resolveShortcutAction,
    createShortcutHandler
  };
});
