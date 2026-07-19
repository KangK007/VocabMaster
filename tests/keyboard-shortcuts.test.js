const assert = require('assert');
const {
  shouldIgnoreShortcut,
  resolveShortcutAction
} = require('../src/keyboard-shortcuts');

assert.strictEqual(shouldIgnoreShortcut({ target: { tagName: 'INPUT' } }), true);
assert.strictEqual(shouldIgnoreShortcut({ target: { tagName: 'TEXTAREA' } }), true);
assert.strictEqual(shouldIgnoreShortcut({ target: { tagName: 'DIV' } }), false);

const context = { mode: 'new', wordRated: false, hasCurrentWord: true };
assert.strictEqual(resolveShortcutAction({ key: '1' }, context), 'rate-remember');
assert.strictEqual(resolveShortcutAction({ key: '2' }, context), 'rate-easy');
assert.strictEqual(resolveShortcutAction({ key: '3' }, context), 'rate-forgot');
assert.strictEqual(resolveShortcutAction({ key: 'Enter' }, context), 'confirm-next');
assert.strictEqual(resolveShortcutAction({ key: 'Enter' }, { ...context, wordRated: true }), 'confirm-next');
assert.strictEqual(resolveShortcutAction({ key: ' ' }, context), 'pronounce');
assert.strictEqual(resolveShortcutAction({ key: 'n', ctrlKey: true }, context), 'open-add-word');
assert.strictEqual(resolveShortcutAction({ key: 'n' }, context), 'mode-new');
assert.strictEqual(resolveShortcutAction({ key: 'r' }, context), 'mode-review');
assert.strictEqual(resolveShortcutAction({ key: 't' }, context), 'mode-test');
assert.strictEqual(resolveShortcutAction({ key: 'w' }, context), 'mode-weak');
assert.strictEqual(resolveShortcutAction({ key: 'ArrowRight' }, context), 'confirm-next');
assert.strictEqual(resolveShortcutAction({ key: 'ArrowLeft' }, context), 'go-back');
assert.strictEqual(resolveShortcutAction({ key: '1' }, { ...context, mode: 'test' }), null);
