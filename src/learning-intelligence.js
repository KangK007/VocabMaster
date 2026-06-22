(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterLearning = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function wordKeyFor(word, category) {
    return `${String(word.word || '').toLowerCase()}_${category}`;
  }

  function daysBetween(a, b) {
    const start = new Date(`${a}T00:00:00`);
    const end = new Date(`${b}T00:00:00`);
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
  }

  function isDue(card, today) {
    return !card || !card.nextReview || card.nextReview <= today;
  }

  function scoreWeakWord(card, due = false) {
    if (!card) return 8;
    let score = 0;
    score += Math.max(0, 2.5 - (card.ef || 2.5)) * 18;
    score += Math.min(6, card.lapses || 0) * 10;
    score += Math.max(0, 3 - (card.repetitions || 0)) * 4;
    if ((card.lastQuality || 5) < 3) score += 18;
    if (due) score += 12;
    return Math.round(score);
  }

  function buildWeakQueue(words, progress, category, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const limit = options.limit || 20;
    const favorites = new Set(options.favorites || []);

    return words
      .map(word => {
        const key = wordKeyFor(word, category);
        const card = progress[key];
        const due = isDue(card, today);
        const favoriteBoost = favorites.has(key) ? 8 : 0;
        return {
          ...word,
          _weakScore: scoreWeakWord(card, due) + favoriteBoost
        };
      })
      .filter(word => word._weakScore >= 18)
      .sort((a, b) => b._weakScore - a._weakScore || a.word.localeCompare(b.word))
      .slice(0, limit);
  }

  function estimateTomorrowDue(words, progress, category, today) {
    return words.filter(word => {
      const card = progress[wordKeyFor(word, category)];
      if (!card || !card.nextReview) return false;
      const diff = daysBetween(today, card.nextReview);
      return diff <= 1;
    }).length;
  }

  function createLearningReport({ words, progress, category, stats, today }) {
    const daily = (stats && stats.daily && stats.daily[today]) || { studied: 0, correct: 0, total: 0 };
    const accuracy = daily.total > 0 ? Math.round((daily.correct / daily.total) * 100) : 0;
    const weakWords = buildWeakQueue(words, progress, category, { today, limit: 5 });
    const tomorrowDue = estimateTomorrowDue(words, progress, category, today);
    const mastered = Object.values(progress || {}).filter(card => card.repetitions >= 3 && card.ef >= 2.0).length;

    let suggestion = '今天可以保持当前节奏，优先完成到期复习。';
    if (daily.total === 0) {
      suggestion = '今天还没有学习记录，建议先完成一轮复习再学习新词。';
    } else if (accuracy < 60 || weakWords.length >= 5) {
      suggestion = '正确率偏低，建议进入强化模式，先处理薄弱词再学习新词。';
    } else if (tomorrowDue > Math.max(20, daily.studied || 0)) {
      suggestion = '明天复习压力偏高，建议今天减少新词，集中巩固旧词。';
    } else if (accuracy >= 85 && weakWords.length <= 2) {
      suggestion = '表现稳定，可以适当增加新词量。';
    }

    return {
      todayStudied: daily.studied || 0,
      accuracy,
      streak: (stats && stats.streak) || 0,
      mastered,
      tomorrowDue,
      weakWords,
      suggestion
    };
  }

  return {
    scoreWeakWord,
    buildWeakQueue,
    createLearningReport
  };
});
