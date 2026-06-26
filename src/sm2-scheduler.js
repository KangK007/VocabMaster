(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterScheduler = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join('-');
  }

  function addDays(dateKey, days) {
    const date = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return localDateKey(date);
  }

  function wordKeyFor(word, category) {
    return `${String(word.word || '').toLowerCase()}_${category}`;
  }

  function calculateSM2(quality, existingCard, dateKey) {
    const card = existingCard
      ? { ...existingCard }
      : { interval: 0, repetitions: 0, ef: 2.5, nextReview: null };
    const prevEF = card.ef || 2.5;

    if (quality >= 3) {
      if (card.repetitions === 0) {
        card.interval = 1;
      } else if (card.repetitions === 1) {
        card.interval = 3;
      } else {
        card.interval = Math.round(card.interval * prevEF);
      }
      card.repetitions++;
    } else {
      card.interval = 1;
      card.repetitions = 0;
    }

    const newEF = prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    card.ef = Math.max(1.3, newEF);
    card.nextReview = addDays(dateKey, card.interval);
    return card;
  }

  function isDue(card, dateKey) {
    if (!card || !card.nextReview) return true;
    return card.nextReview <= (dateKey || localDateKey());
  }

  function defaultShuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function buildDueWords(words, progress, category, dateKey) {
    return words
      .filter(word => {
        const card = progress[wordKeyFor(word, category)];
        return card && isDue(card, dateKey);
      })
      .sort((a, b) => {
        const ca = progress[wordKeyFor(a, category)];
        const cb = progress[wordKeyFor(b, category)];
        const aOverdue = ca && ca.nextReview && ca.nextReview < dateKey ? 1 : 0;
        const bOverdue = cb && cb.nextReview && cb.nextReview < dateKey ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        return (ca ? ca.ef : 2.5) - (cb ? cb.ef : 2.5);
      });
  }

  function buildLearningQueue({
    words,
    progress,
    category,
    mode,
    settings,
    today,
    favorites = [],
    shuffleFn = defaultShuffle,
    buildWeakQueue
  }) {
    const dateKey = today || localDateKey();
    const allWords = Array.isArray(words) ? words : [];
    const allProgress = progress || {};
    const dailyGoal = (settings && settings.dailyGoal) || 30;
    const dueWords = buildDueWords(allWords, allProgress, category, dateKey);

    if (mode === 'review') {
      return dueWords;
    }

    if (mode === 'new') {
      const remaining = Math.max(0, dailyGoal - dueWords.length);
      const newWords = allWords.filter(word => {
        const card = allProgress[wordKeyFor(word, category)];
        return !card || card.repetitions === 0;
      });
      return shuffleFn(newWords).slice(0, remaining);
    }

    if (mode === 'weak') {
      if (typeof buildWeakQueue !== 'function') return [];
      return buildWeakQueue(allWords, allProgress, category, {
        today: dateKey,
        limit: Math.max(10, Math.min(30, dailyGoal)),
        favorites
      });
    }

    if (mode === 'test') {
      const learned = allWords.filter(word => {
        const card = allProgress[wordKeyFor(word, category)];
        return card && card.repetitions > 0;
      });
      return learned.length === 0
        ? shuffleFn(allWords).slice(0, 20)
        : shuffleFn(learned).slice(0, Math.min(20, learned.length));
    }

    return [];
  }

  return {
    calculateSM2,
    isDue,
    buildLearningQueue,
    wordKeyFor
  };
});

