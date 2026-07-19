const assert = require('assert');
const {
  analyzeMorphology,
  coverage
} = require('../src/morphology');

const abnormal = analyzeMorphology('abnormal');
assert.deepStrictEqual(abnormal.map(part => part.type), ['prefix', 'root', 'suffix']);
assert.deepStrictEqual(abnormal.map(part => part.text), ['ab', 'norm', 'al']);

const transport = analyzeMorphology('transportation');
assert(transport.some(part => part.text === 'trans'));
assert(transport.some(part => part.text === 'port'));
assert(transport.some(part => part.text === 'ation'));

assert.deepStrictEqual(analyzeMorphology('cat'), []);

const stats = coverage([
  { word: 'abnormal' },
  { word: 'transportation' },
  { word: 'cat' }
]);
assert.strictEqual(stats.total, 3);
assert.strictEqual(stats.covered, 2);
assert.strictEqual(Math.round(stats.ratio * 100), 67);
