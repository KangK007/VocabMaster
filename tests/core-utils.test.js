const assert = require('assert');
const { escapeHtml, localDateKey, debounce, pad2 } = require('../src/core-utils');

assert.strictEqual(
  escapeHtml('<img src=x onerror=alert(1)>&"\''),
  '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;'
);

const date = new Date(2026, 0, 2, 3, 4, 5);
assert.strictEqual(localDateKey(date), '2026-01-02');

const offsetEdge = new Date(2026, 5, 21, 0, 30, 0);
assert.strictEqual(localDateKey(offsetEdge), '2026-06-21');
assert.strictEqual(pad2(3), '03');

let calls = 0;
const debounced = debounce(() => { calls += 1; }, 5);
debounced();
debounced();
setTimeout(() => {
  assert.strictEqual(calls, 1);
}, 20);
