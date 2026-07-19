const assert = require('assert');
const {
  calculateStatsSummary,
  getRecentAccuracyDates,
  getHeatmapCellColor,
  canvasHasPaint,
  isMasteredCard,
  buildWeeklyReport,
  buildAchievements,
  renderTestHistory,
  renderWeeklyReport,
  renderAchievements
} = require('../src/stats-renderer');

const stats = {
  daily: {
    '2026-07-01': { studied: 10, correct: 8, total: 10 },
    '2026-07-02': { studied: 5, correct: 2, total: 5 }
  },
  streak: 3
};

const summary = calculateStatsSummary(stats, 7);
assert.deepStrictEqual(summary, {
  totalStudied: 15,
  accuracyText: '67%',
  streak: 3,
  mastered: 7
});

assert.deepStrictEqual(
  getRecentAccuracyDates(stats.daily, 1),
  ['2026-07-02']
);

assert.strictEqual(getHeatmapCellColor(0), '#f3efe6');
assert.strictEqual(getHeatmapCellColor(4), '#eee5d5');
assert.strictEqual(getHeatmapCellColor(10), '#dfc784');
assert.strictEqual(getHeatmapCellColor(20), '#b8860b');
assert.strictEqual(getHeatmapCellColor(40), '#8b6508');
assert.strictEqual(isMasteredCard({ repetitions: 3, ef: 2.0 }), true);
assert.strictEqual(isMasteredCard({ repetitions: 2, ef: 2.5 }), false);

const weekly = buildWeeklyReport(stats, { dailyGoal: 5 }, new Date('2026-07-07T12:00:00'));
assert.strictEqual(weekly.studied, 15);
assert.strictEqual(weekly.activeDays, 2);
assert.strictEqual(weekly.goalDays, 2);
assert.strictEqual(weekly.accuracy, 67);
assert.strictEqual(weekly.averagePerActiveDay, 8);
assert.strictEqual(weekly.bestDay.date, '2026-07-01');

const achievements = buildAchievements(
  { ...stats, streak: 7, testHistory: [{}, {}, {}, {}, {}] },
  {
    abandon_cet4: { repetitions: 3, ef: 2.1 },
    ability_cet4: { repetitions: 1, ef: 2.5 },
    binary_cet6: { repetitions: 1, ef: 2.5 }
  },
  ['abandon_cet4', 'ability_cet4', 'binary_cet6', 'adapt_cet4', 'balance_cet4'],
  { cet4: [{ word: 'abandon' }] }
);
assert.strictEqual(achievements.find(item => item.id === 'steady-week').unlocked, true);
assert.strictEqual(achievements.find(item => item.id === 'collector').unlocked, true);
assert.strictEqual(achievements.find(item => item.id === 'explorer').unlocked, true);

assert.strictEqual(canvasHasPaint({
  width: 2,
  height: 1,
  getContext() {
    return {
      getImageData() {
        return { data: new Uint8ClampedArray([0, 0, 0, 0, 10, 20, 30, 255]) };
      }
    };
  }
}), true);

assert.strictEqual(canvasHasPaint({
  width: 1,
  height: 1,
  getContext() {
    return {
      getImageData() {
        return { data: new Uint8ClampedArray([0, 0, 0, 0]) };
      }
    };
  }
}), false);

function createFakeDocument() {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        innerHTML: '',
        children: [],
        appendChild(child) {
          this.children.push(child);
        }
      };
    }
  };
}

const weeklyContainer = { innerHTML: '' };
renderWeeklyReport(null, weeklyContainer, {
  ...weekly,
  bestDay: { date: '2026-07-<img src=x onerror=alert(1)>', studied: 8 },
  suggestion: '<script>alert(1)</script>'
});
assert(!weeklyContainer.innerHTML.includes('<script>'));
assert(!weeklyContainer.innerHTML.includes('<img'));
assert(weeklyContainer.innerHTML.includes('&lt;script&gt;'));

const historyContainer = {
  innerHTML: '',
  children: [],
  appendChild(child) { this.children.push(child); }
};
renderTestHistory(createFakeDocument(), historyContainer, [{
  date: '2026-07-18<script>',
  category: '<img src=x onerror=alert(1)>',
  correct: 1,
  total: 2,
  duration: 9
}]);
const historyHtml = JSON.stringify(historyContainer);
assert(!historyHtml.includes('<script>'));
assert(!historyHtml.includes('<img'));
assert(historyHtml.includes('&lt;img'));

const achievementContainer = { innerHTML: '' };
renderAchievements(null, achievementContainer, [{
  id: 'x" onclick="alert(1)',
  title: '<script>alert(1)</script>',
  detail: '<img src=x onerror=alert(1)>',
  unlocked: true
}]);
assert(!achievementContainer.innerHTML.includes('<script>'));
assert(!achievementContainer.innerHTML.includes('<img'));
assert(achievementContainer.innerHTML.includes('&lt;script&gt;'));
