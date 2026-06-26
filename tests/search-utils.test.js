const assert = require('assert');
const { filterWords, renderSearchResultsHtml } = require('../src/search-utils');

const words = [
  { word: 'abandon', meaning: 'v. 放弃；抛弃' },
  { word: 'ability', meaning: 'n. 能力；才能' },
  { word: 'adapt', meaning: '<script>alert(1)</script>' }
];

assert.deepStrictEqual(
  filterWords(words, 'abi').map(w => w.word),
  ['ability']
);

assert.deepStrictEqual(
  filterWords(words, '放弃').map(w => w.word),
  ['abandon']
);

assert.strictEqual(filterWords(words, '').length, 0);
assert.strictEqual(filterWords(words, 'a', 2).length, 2);

const html = renderSearchResultsHtml([{ word: '<adapt>', meaning: '<b>适应</b>' }]);
assert(html.includes('&lt;adapt&gt;'));
assert(html.includes('&lt;b&gt;适应&lt;/b&gt;'));
assert(!html.includes('<adapt>'));

const empty = renderSearchResultsHtml([]);
assert(empty.includes('未找到匹配单词'));
