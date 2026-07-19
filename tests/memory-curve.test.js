const assert = require('assert');
const {
  aggregateRetention,
  estimateCardRetention,
  renderMemoryCurve
} = require('../src/memory-curve');

const progress = {
  alpha_cet4: { interval: 1, ef: 2.5, repetitions: 1, lapses: 0 },
  beta_cet4: { interval: 6, ef: 2.2, repetitions: 3, lapses: 1 }
};

const curve = aggregateRetention(progress, 7);
assert.strictEqual(curve.length, 8);
assert.strictEqual(curve[0].day, 0);
assert.strictEqual(curve[7].day, 7);
assert(curve[0].personal > curve[7].personal, 'personal retention should decline over time');
assert(curve[0].ideal > curve[7].ideal, 'ideal retention should decline over time');
assert(
  estimateCardRetention(progress.alpha_cet4, 0) > estimateCardRetention(progress.alpha_cet4, 7),
  'single-card retention should decline over time'
);

const emptyCurve = aggregateRetention({}, 14);
assert.strictEqual(emptyCurve.length, 15);
assert.strictEqual(emptyCurve[0].personal, null);

function createFakeCanvas() {
  const ops = [];
  const ctx = {
    ops,
    scale: (...args) => ops.push(['scale', ...args]),
    clearRect: (...args) => ops.push(['clearRect', ...args]),
    fillText: (...args) => ops.push(['fillText', ...args]),
    beginPath: () => ops.push(['beginPath']),
    moveTo: (...args) => ops.push(['moveTo', ...args]),
    lineTo: (...args) => ops.push(['lineTo', ...args]),
    stroke: () => ops.push(['stroke']),
    save: () => ops.push(['save']),
    restore: () => ops.push(['restore']),
    setLineDash: (...args) => ops.push(['setLineDash', ...args]),
    arc: (...args) => ops.push(['arc', ...args]),
    fill: () => ops.push(['fill'])
  };
  return {
    width: 620,
    height: 220,
    ownerDocument: { defaultView: { devicePixelRatio: 1 } },
    getBoundingClientRect: () => ({ width: 620, height: 220 }),
    getContext: () => ctx,
    ops
  };
}

const canvas = createFakeCanvas();
const rendered = renderMemoryCurve(canvas, progress, { days: 7 });
assert.strictEqual(rendered.length, 8);
assert(canvas.ops.some(op => op[0] === 'stroke'), 'memory curve should draw lines');
assert(canvas.ops.some(op => op[0] === 'arc'), 'memory curve should draw personal markers');
