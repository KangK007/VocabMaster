const assert = require('assert');
const {
  calculateSM2,
  isDue,
  buildLearningQueue,
  wordKeyFor
} = require('../src/sm2-scheduler');
const { buildWeakQueue } = require('../src/learning-intelligence');

const today = '2026-06-21';

const firstRemembered = calculateSM2(3, null, today);
assert.strictEqual(firstRemembered.interval, 1);
assert.strictEqual(firstRemembered.repetitions, 1);
assert.strictEqual(firstRemembered.nextReview, '2026-06-22');
assert(firstRemembered.ef < 2.5, 'quality 3 should reduce EF from the default');

const secondRemembered = calculateSM2(5, firstRemembered, today);
assert.strictEqual(secondRemembered.interval, 3);
assert.strictEqual(secondRemembered.repetitions, 2);
assert(secondRemembered.ef > firstRemembered.ef, 'easy rating should increase EF');

const forgotten = calculateSM2(1, secondRemembered, today);
assert.strictEqual(forgotten.interval, 1);
assert.strictEqual(forgotten.repetitions, 0);
assert(forgotten.ef >= 1.3, 'EF should not fall below the SM-2 floor');
assert.strictEqual(isDue({ nextReview: today }, today), true);
assert.strictEqual(isDue({ nextReview: '2026-06-22' }, today), false);

const words = [
  { word: 'alpha' },
  { word: 'beta' },
  { word: 'gamma' },
  { word: 'delta' }
];
const progress = {
  [wordKeyFor(words[0], 'cet4')]: { ef: 2.4, repetitions: 2, nextReview: '2026-06-20' },
  [wordKeyFor(words[1], 'cet4')]: { ef: 1.5, repetitions: 2, nextReview: today },
  [wordKeyFor(words[2], 'cet4')]: { ef: 2.5, repetitions: 1, nextReview: '2026-07-01' }
};

const reviewQueue = buildLearningQueue({
  words,
  progress,
  category: 'cet4',
  mode: 'review',
  settings: { dailyGoal: 2 },
  today
});
assert.deepStrictEqual(reviewQueue.map(w => w.word), ['alpha', 'beta']);

const newQueue = buildLearningQueue({
  words,
  progress,
  category: 'cet4',
  mode: 'new',
  settings: { dailyGoal: 3 },
  today,
  shuffleFn: items => items
});
assert.deepStrictEqual(newQueue.map(w => w.word), ['delta']);

const weakQueue = buildLearningQueue({
  words,
  progress,
  category: 'cet4',
  mode: 'weak',
  settings: { dailyGoal: 10 },
  today,
  favorites: [wordKeyFor(words[1], 'cet4')],
  buildWeakQueue
});
assert.strictEqual(weakQueue[0].word, 'beta');
