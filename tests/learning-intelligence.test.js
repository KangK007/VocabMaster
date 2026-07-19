const assert = require('assert');
const {
  scoreWeakWord,
  buildWeakQueue,
  createLearningReport
} = require('../src/learning-intelligence');

const words = [
  { word: 'abandon', meaning: '放弃' },
  { word: 'ability', meaning: '能力' },
  { word: 'academic', meaning: '学术的' },
  { word: 'adapt', meaning: '适应' }
];

const progress = {
  abandon_cet4: { ef: 1.3, repetitions: 0, lapses: 3, lastQuality: 1, nextReview: '2026-06-20' },
  ability_cet4: { ef: 2.6, repetitions: 4, lapses: 0, lastQuality: 5, nextReview: '2026-07-01' },
  academic_cet4: { ef: 1.9, repetitions: 1, lapses: 1, lastQuality: 3, nextReview: '2026-06-19' }
};

assert(
  scoreWeakWord(progress.abandon_cet4, true) > scoreWeakWord(progress.ability_cet4, false),
  'repeatedly forgotten due words should score higher than mastered future words'
);

const weakQueue = buildWeakQueue(words, progress, 'cet4', {
  today: '2026-06-21',
  limit: 2,
  favorites: ['academic_cet4']
});

assert.deepStrictEqual(
  weakQueue.map(w => w.word),
  ['abandon', 'academic']
);

const report = createLearningReport({
  words,
  progress,
  category: 'cet4',
  stats: {
    daily: {
      '2026-06-21': { studied: 12, correct: 7, total: 12 }
    },
    streak: 4
  },
  today: '2026-06-21'
});

assert.strictEqual(report.todayStudied, 12);
assert.strictEqual(report.accuracy, 58);
assert.strictEqual(report.weakWords[0].word, 'abandon');
assert.strictEqual(report.tomorrowDue, 0, 'overdue cards should not be counted as due tomorrow');
assert(report.suggestion.length > 0, 'report should provide a coaching suggestion');

const exactTomorrowReport = createLearningReport({
  words,
  progress: {
    abandon_cet4: { repetitions: 1, ef: 2.5, nextReview: '2026-06-20' },
    ability_cet4: { repetitions: 1, ef: 2.5, nextReview: '2026-06-21' },
    academic_cet4: { repetitions: 1, ef: 2.5, nextReview: '2026-06-22' },
    adapt_cet4: { repetitions: 1, ef: 2.5, nextReview: '2026-06-23' }
  },
  category: 'cet4',
  stats: { daily: {}, streak: 0 },
  today: '2026-06-21'
});
assert.strictEqual(exactTomorrowReport.tomorrowDue, 1);
