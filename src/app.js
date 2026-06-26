// ============================================================
// VocabMaster - Main Application Logic
// Backend: Python + pywebview
// ============================================================

const {
  escapeHtml = (value) => String(value),
  localDateKey = (date = new Date()) => {
    const pad2 = (value) => String(value).padStart(2, '0');
    return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join('-');
  }
} = window.VocabMasterUtils || {};
const {
  buildWeakQueue = () => [],
  createLearningReport = () => ({
    todayStudied: 0,
    accuracy: 0,
    streak: 0,
    mastered: 0,
    tomorrowDue: 0,
    weakWords: [],
    suggestion: ''
  })
} = window.VocabMasterLearning || {};
const {
  calculateSM2 = null,
  isDue: schedulerIsDue = null,
  buildLearningQueue = null,
  wordKeyFor: schedulerWordKeyFor = null
} = window.VocabMasterScheduler || {};
const {
  filterWords: filterSearchWords = null,
  renderSearchResultsHtml = null
} = window.VocabMasterSearch || {};

// --- API Helper ---
// Wraps pywebview API calls with error handling
const api = new Proxy({}, {
  get(target, method) {
    return (...args) => {
      if (window.pywebview && window.pywebview.api) {
        try {
          const result = window.pywebview.api[method](...args);
          if (result && typeof result.then === 'function') {
            return result;
          }
          return Promise.resolve(result);
        } catch (e) {
          return Promise.reject(e);
        }
      }
      // Fallback: use localStorage for demo/dev mode
      return fallbackAPI(method, ...args);
    };
  }
});

// Fallback when running outside pywebview (e.g., in browser for testing)
function fallbackAPI(method, ...args) {
  switch (method) {
    case 'get_word_list': {
      const cat = args[0] || 'cet4';
      try {
        // In browser, fetch from local server or use embedded data
        return Promise.resolve([]);
      } catch (e) { return Promise.resolve([]); }
    }
    case 'get_progress':
      return Promise.resolve(JSON.parse(localStorage.getItem('vm_progress') || '{}'));
    case 'save_progress':
      localStorage.setItem('vm_progress', JSON.stringify(args[0]));
      return Promise.resolve(true);
    case 'get_stats':
      return Promise.resolve(JSON.parse(localStorage.getItem('vm_stats') || '{"daily":{},"streak":0,"lastStudyDate":null}'));
    case 'save_stats':
      localStorage.setItem('vm_stats', JSON.stringify(args[0]));
      return Promise.resolve(true);
    case 'get_settings':
      return Promise.resolve(JSON.parse(localStorage.getItem('vm_settings') || '{"fontSize":18,"dailyGoal":30}'));
    case 'save_settings':
      localStorage.setItem('vm_settings', JSON.stringify(args[0]));
      return Promise.resolve(true);
    case 'get_favorites':
      return Promise.resolve(JSON.parse(localStorage.getItem('vm_favorites') || '[]'));
    case 'save_favorites':
      localStorage.setItem('vm_favorites', JSON.stringify(args[0]));
      return Promise.resolve(true);
    default:
      return Promise.resolve(null);
  }
}

// --- SM-2 Spaced Repetition Algorithm ---
const SM2 = {
  calc(q, card) {
    if (calculateSM2) {
      return calculateSM2(q, card, today());
    }
    if (!card) {
      card = { interval: 0, repetitions: 0, ef: 2.5, nextReview: null };
    }
    const prevEF = card.ef || 2.5;

    if (q >= 3) {
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

    const newEF = prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    card.ef = Math.max(1.3, newEF);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + card.interval);
    nextDate.setHours(0, 0, 0, 0);
    card.nextReview = localDateKey(nextDate);

    return card;
  },

  isDue(card) {
    if (schedulerIsDue) {
      return schedulerIsDue(card, today());
    }
    if (!card || !card.nextReview) return true;
    const todayStr = localDateKey();
    return card.nextReview <= todayStr;
  }
};

// --- Application State ---
const state = {
  mode: 'review',
  category: 'cet4',
  currentIndex: 0,
  wordList: [],
  currentWords: [],
  progress: {},
  stats: { daily: {}, streak: 0, lastStudyDate: null },
  settings: { fontSize: 18, dailyGoal: 30 },
  todayStats: { studied: 0, correct: 0, total: 0 },
  testState: null,
  wordRated: false,
  ratingInProgress: false,
  favorites: new Set(),
  searchResults: [],
  learningReport: null,
  sessionRatings: {}  // key -> quality, tracks per-session rating
};

// --- DOM Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  wordText: $('#word-text'),
  wordPhonetic: $('#word-phonetic'),
  wordMeaning: $('#word-meaning'),
  wordExample: $('#word-example'),
  wordExampleTrans: $('#word-example-trans'),
  btnPronounce: $('#btn-pronounce'),
  currentIndex: $('#current-index'),
  totalCount: $('#total-count'),
  cardActions: $('#card-actions'),
  btnForgot: $('#btn-forgot'),
  btnRemember: $('#btn-remember'),
  btnEasy: $('#btn-easy'),
  testOptions: $('#test-options'),
  testChoices: $('#test-choices'),
  testQuestion: $('#test-question'),
  testActions: $('#test-actions'),
  btnNextTest: $('#btn-next-test'),
  btnConfirm: $('#btn-confirm'),
  btnBack: $('#btn-back'),
  confirmActions: $('#confirm-actions'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  catTabs: $$('.cat-tab'),
  modeTabs: $$('.mode-tab'),
  progressFill: $('#progress-fill'),
  progressPercent: $('#progress-percent'),
  statToday: $('#stat-today'),
  statAccuracy: $('#stat-accuracy'),
  statStreak: $('#stat-streak'),
  statMastered: $('#stat-mastered'),
  completeOverlay: $('#complete-overlay'),
  completeTitle: $('#complete-title'),
  completeMessage: $('#complete-message'),
  completeStats: $('#complete-stats'),
  settingsOverlay: $('#settings-overlay'),
  fontDisplay: $('#font-size-display'),
  toast: $('#toast')
};

// --- Helpers ---
function wordKey(word) {
  if (schedulerWordKeyFor) {
    return schedulerWordKeyFor(word, state.category);
  }
  return `${word.word.toLowerCase()}_${state.category}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function today() {
  return localDateKey();
}

function showToast(msg, type = '') {
  const t = dom.toast;
  clearTimeout(t._timeout);
  // Reset: remove hidden and out, re-trigger enter animation
  t.classList.remove('hidden', 'out');
  t.textContent = msg;
  t.className = 'toast ' + type;
  // Schedule exit
  t._timeout = setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', function handler() {
      if (t.classList.contains('out')) {
        t.classList.add('hidden');
        t.classList.remove('out');
      }
      t.removeEventListener('animationend', handler);
    });
  }, 2000);
}

// --- Data Persistence ---
async function loadData() {
  try {
    const [progress, stats, settings] = await Promise.all([
      api.get_progress(),
      api.get_stats(),
      api.get_settings()
    ]);
    state.progress = progress || {};
    state.stats = stats || { daily: {}, streak: 0, lastStudyDate: null };
    state.settings = settings || { fontSize: 18, dailyGoal: 30, darkMode: false };
    // Migrate old settings
    delete state.settings.reviewCount;
    delete state.settings.newWordCount;
  } catch (e) {
    console.error('Load data error:', e);
  }

  const t = today();
  if (!state.stats.daily[t]) {
    state.stats.daily[t] = { studied: 0, correct: 0, total: 0 };
  }
  state.todayStats = { ...state.stats.daily[t] };
  // Streak is updated only when actual study occurs (rateWord, handleTestChoice, showComplete)
  await saveStats();
}

async function saveProgress() {
  try { await api.save_progress(state.progress); } catch (e) { console.error(e); }
}

async function saveStats() {
  const t = today();
  state.stats.daily[t] = { ...state.todayStats };
  try { await api.save_stats(state.stats); } catch (e) { console.error(e); }
}

async function saveSettings() {
  try { await api.save_settings(state.settings); } catch (e) { console.error(e); }
}

function updateStreak() {
  const t = today();
  const lastDate = state.stats.lastStudyDate;
  if (!lastDate) {
    state.stats.streak = state.todayStats.studied > 0 ? 1 : 0;
  } else if (lastDate === t) {
    // Already studied today — streak unchanged
  } else if (state.todayStats.studied > 0) {
    // Only update streak when actual studying happened
    const last = new Date(lastDate);
    const todayDate = new Date(t);
    const diff = (todayDate - last) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      state.stats.streak++;
    } else if (diff > 1) {
      state.stats.streak = 1;
    }
  } else if (state.mode === 'weak') {
    dom.wordText.textContent = '暂无薄弱词 🎯';
    dom.wordMeaning.textContent = '系统暂未发现需要强化的单词。继续学习后，这里会自动收集易错词。';
  }
  if (state.todayStats.studied > 0) {
    state.stats.lastStudyDate = t;
  }
}

// --- Word Loading ---
async function loadWordList() {
  try {
    state.wordList = await api.get_word_list(state.category);
  } catch (e) {
    console.error('Load word list error:', e);
    state.wordList = [];
  }
  buildQueue();
}

function buildQueue() {
  if (buildLearningQueue) {
    state.currentWords = buildLearningQueue({
      words: state.wordList,
      progress: state.progress,
      category: state.category,
      mode: state.mode,
      settings: state.settings,
      today: today(),
      favorites: [...state.favorites],
      shuffleFn: shuffle,
      buildWeakQueue
    });
    state.currentIndex = 0;
    state.testState = null;
    return;
  }

  const todayStr = today();

  // Count how many words are due for review (SM-2 forgetting curve)
  const dueWords = state.wordList.filter(w => {
    const key = wordKey(w);
    const card = state.progress[key];
    return card && SM2.isDue(card);
  });

  if (state.mode === 'review') {
    // ALL due words must be reviewed; no artificial cap
    // Sort by priority: overdue first, then harder words (lower EF) first
    dueWords.sort((a, b) => {
      const ca = state.progress[wordKey(a)];
      const cb = state.progress[wordKey(b)];
      const aOverdue = ca && ca.nextReview && ca.nextReview < todayStr ? 1 : 0;
      const bOverdue = cb && cb.nextReview && cb.nextReview < todayStr ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return (ca ? ca.ef : 2.5) - (cb ? cb.ef : 2.5);
    });
    state.currentWords = dueWords;
  } else if (state.mode === 'new') {
    // New words fill the gap: dailyGoal - dueReviewCount
    const remaining = Math.max(0, state.settings.dailyGoal - dueWords.length);
    const newWords = state.wordList.filter(w => {
      const key = wordKey(w);
      return !state.progress[key] || state.progress[key].repetitions === 0;
    });
    state.currentWords = shuffle(newWords).slice(0, remaining);
  } else if (state.mode === 'weak') {
    state.currentWords = buildWeakQueue(state.wordList, state.progress, state.category, {
      today: todayStr,
      limit: Math.max(10, Math.min(30, state.settings.dailyGoal)),
      favorites: [...state.favorites]
    });
  } else if (state.mode === 'test') {
    const learned = state.wordList.filter(w => {
      const key = wordKey(w);
      return state.progress[key] && state.progress[key].repetitions > 0;
    });
    if (learned.length === 0) {
      state.currentWords = shuffle(state.wordList).slice(0, 20);
    } else {
      state.currentWords = shuffle(learned).slice(0, Math.min(20, learned.length));
    }
  }
  state.currentIndex = 0;
  state.testState = null;
}

// --- UI Rendering ---
function renderCard() {
  if (state.currentWords.length === 0) {
    showEmptyState();
    return;
  }

  const word = state.currentWords[state.currentIndex];
  if (!word) return;

  const key = wordKey(word);
  const sessionQuality = state.sessionRatings[key];

  // If already rated this session, restore rated state
  if (sessionQuality !== undefined) {
    state.wordRated = true;
  } else {
    state.wordRated = false;
  }

  dom.wordText.textContent = word.word;
  dom.wordPhonetic.textContent = word.phonetic || '';
  dom.wordMeaning.textContent = word.meaning || '';
  dom.wordExample.textContent = word.example ? `"${word.example}"` : '';
  dom.wordExampleTrans.textContent = word.exampleTranslation || '';

  // In review/new modes, hide meaning until user rates (unless already rated this session)
  if (state.mode !== 'test') {
    if (sessionQuality !== undefined) {
      // Already rated this session — show meaning
      dom.wordMeaning.classList.remove('hidden');
      dom.wordExample.classList.remove('hidden');
      dom.wordExampleTrans.classList.remove('hidden');
      // Show confirm/back, hide rating buttons
      dom.cardActions.classList.add('hidden');
      dom.confirmActions.classList.remove('hidden');
      // Highlight which rating was given
      highlightRatedQuality(sessionQuality);
    } else {
      // Not yet rated — hide meaning, show rating buttons
      dom.wordMeaning.classList.add('hidden');
      dom.wordExample.classList.add('hidden');
      dom.wordExampleTrans.classList.add('hidden');
      dom.cardActions.classList.remove('hidden');
      dom.confirmActions.classList.add('hidden');
    }
  } else {
    dom.wordMeaning.classList.remove('hidden');
    dom.wordExample.classList.remove('hidden');
    dom.wordExampleTrans.classList.remove('hidden');
  }

  // Back button visibility (only when there are previous words)
  if (dom.btnBack) {
    dom.btnBack.style.visibility = state.currentIndex > 0 ? 'visible' : 'hidden';
  }

  dom.currentIndex.textContent = state.currentIndex + 1;
  dom.totalCount.textContent = state.currentWords.length;

  if (state.mode === 'test') {
    dom.testOptions.classList.remove('hidden');
    dom.cardActions.classList.add('hidden');
    dom.confirmActions.classList.add('hidden');
    dom.testActions.classList.remove('hidden');
    renderTestQuestion(word);
  } else {
    dom.testOptions.classList.add('hidden');
    dom.testActions.classList.add('hidden');
  }

  updateProgress();
  updateStatsDisplay();
  updateWordDetail();
  updateFavoriteIcon();
}

function highlightRatedQuality(quality) {
  // Visually indicate which rating was given on the rating buttons
  [dom.btnForgot, dom.btnRemember, dom.btnEasy].forEach(b => {
    if (b) b.classList.remove('rated');
  });
  if (quality === 1 && dom.btnForgot) dom.btnForgot.classList.add('rated');
  if (quality === 3 && dom.btnRemember) dom.btnRemember.classList.add('rated');
  if (quality === 5 && dom.btnEasy) dom.btnEasy.classList.add('rated');
}

function showEmptyState() {
  if (state.mode === 'review') {
    dom.wordText.textContent = '没有待复习的单词 🎉';
    dom.wordMeaning.textContent = '所有单词都按遗忘曲线处于记忆周期中，暂无到期单词。';
  } else if (state.mode === 'new') {
    const dueCount = state.wordList.filter(w => {
      const key = wordKey(w);
      const card = state.progress[key];
      return card && SM2.isDue(card);
    }).length;
    if (dueCount >= state.settings.dailyGoal) {
      dom.wordText.textContent = '今日复习任务已满';
      dom.wordMeaning.textContent = `待复习单词 ${dueCount} 个已达到每日目标 ${state.settings.dailyGoal} 个，请先完成复习。`;
    } else {
      dom.wordText.textContent = '没有新单词可学';
      dom.wordMeaning.textContent = '该词库中所有单词都已学过，请切换词库或添加自定义单词。';
    }
  }
  dom.wordPhonetic.textContent = '';
  dom.wordExample.textContent = '';
  dom.wordExampleTrans.textContent = '';
  dom.wordMeaning.classList.remove('hidden');
  dom.wordExample.classList.remove('hidden');
  dom.wordExampleTrans.classList.remove('hidden');
  dom.testOptions.classList.add('hidden');
  dom.cardActions.classList.add('hidden');
  dom.confirmActions.classList.add('hidden');
  dom.testActions.classList.add('hidden');
  dom.currentIndex.textContent = '0';
  dom.totalCount.textContent = '0';
  updateProgress();
}

function renderTestQuestion(currentWord) {
  dom.testQuestion.textContent = `"${currentWord.word}" 的意思是？`;

  const wrongChoices = state.wordList
    .filter(w => w.word !== currentWord.word && w.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const choices = shuffle([
    { meaning: currentWord.meaning, correct: true },
    ...wrongChoices.map(w => ({ meaning: w.meaning, correct: false }))
  ]);

  state.testState = {
    word: currentWord,
    choices,
    selectedIndex: -1,
    answered: false
  };

  dom.testChoices.innerHTML = choices.map((c, i) => `
    <button class="test-choice" data-index="${i}">${escapeHtml(c.meaning)}</button>
  `).join('');

  dom.testChoices.querySelectorAll('.test-choice').forEach(btn => {
    btn.addEventListener('click', () => handleTestChoice(parseInt(btn.dataset.index)));
  });

  dom.btnNextTest.classList.add('hidden');
}

function handleTestChoice(index) {
  if (state.testState.answered) return;
  state.testState.answered = true;
  state.testState.selectedIndex = index;

  const isCorrect = state.testState.choices[index].correct;

  const buttons = dom.testChoices.querySelectorAll('.test-choice');
  buttons.forEach((btn, i) => {
    if (i === index) btn.classList.add('selected');
    btn.classList.add(state.testState.choices[i].correct ? 'correct' : 'wrong');
    btn.disabled = true;
  });

  state.todayStats.total++;
  state.todayStats.studied++;
  if (isCorrect) {
    state.todayStats.correct++;
    const key = wordKey(state.testState.word);
    state.progress[key] = SM2.calc(5, state.progress[key]);
    state.progress[key].lastQuality = 5;
  } else {
    const key = wordKey(state.testState.word);
    state.progress[key] = SM2.calc(1, state.progress[key]);
    state.progress[key].lastQuality = 1;
    state.progress[key].lapses = (state.progress[key].lapses || 0) + 1;
  }

  dom.btnNextTest.classList.remove('hidden');

  if (isCorrect) {
    showToast('✅ 回答正确！', 'success');
  } else {
    showToast(`❌ 正确答案是：${state.testState.choices.find(c => c.correct).meaning}`, 'error');
  }

  saveProgress();
  updateStreak();
  saveStats();
  updateStatsDisplay();
  updateProgress();
}

function updateProgress() {
  if (state.currentWords.length === 0) {
    dom.progressFill.style.width = '0%';
    dom.progressPercent.textContent = '0%';
    return;
  }
  const pct = Math.round(((state.currentIndex + 1) / state.currentWords.length) * 100);
  dom.progressFill.style.width = pct + '%';
  dom.progressPercent.textContent = pct + '%';
}

function updateStatsDisplay() {
  dom.statToday.textContent = state.todayStats.studied;
  dom.statAccuracy.textContent = state.todayStats.total > 0
    ? Math.round((state.todayStats.correct / state.todayStats.total) * 100) + '%'
    : '-';
  dom.statStreak.textContent = state.stats.streak + ' 天';
  dom.statMastered.textContent = countMastered();
  // Show due review count
  const dueCount = state.wordList.filter(w => {
    const key = wordKey(w);
    const card = state.progress[key];
    return card && SM2.isDue(card);
  }).length;
  const statDue = $('#stat-due');
  if (statDue) statDue.textContent = dueCount;
}

function countMastered() {
  return Object.values(state.progress).filter(c => c.repetitions >= 3 && c.ef >= 2.0).length;
}

// --- Actions ---
function moveNext() {
  if (state.currentWords.length === 0) return;

  if (state.mode === 'test') {
    if (!state.testState || !state.testState.answered) {
      showToast('请先选择答案', 'warning');
      return;
    }
  } else {
    // In review/new modes, rating is required before moving
    if (!state.wordRated) {
      showToast('请先评级（1 忘记 | 2 记得 | 3 简单）', 'warning');
      return;
    }
  }

  if (state.currentIndex < state.currentWords.length - 1) {
    state.currentIndex++;
    state.testState = null;
    state.wordRated = false;
    renderCard();
  } else {
    showComplete();
  }
}

function movePrev() {
  if (state.currentWords.length === 0) return;
  if (state.currentIndex > 0) {
    state.currentIndex--;
    state.testState = null;
    state.wordRated = false;
    renderCard();
  }
}

function rateWord(quality) {
  if (state.currentWords.length === 0) return;
  if (state.wordRated || state.ratingInProgress) return; // Prevent double-rating

  state.ratingInProgress = true;
  state.wordRated = true;

  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  state.progress[key] = SM2.calc(quality, state.progress[key]);
  state.progress[key].lastQuality = quality;
  if (quality < 3) {
    state.progress[key].lapses = (state.progress[key].lapses || 0) + 1;
  }

  state.todayStats.studied++;
  state.todayStats.total++;
  if (quality >= 3) {
    state.todayStats.correct++;
  }

  saveProgress();
  updateStreak();
  saveStats();
  updateStatsDisplay();

  // Record per-session rating
  state.sessionRatings[key] = quality;

  // Reveal meaning, example, and translation after rating
  dom.wordMeaning.classList.remove('hidden');
  dom.wordExample.classList.remove('hidden');
  dom.wordExampleTrans.classList.remove('hidden');

  // Hide rating buttons, show confirm button
  dom.cardActions.classList.add('hidden');
  dom.confirmActions.classList.remove('hidden');
  // Ensure back button visibility
  if (dom.btnBack) {
    dom.btnBack.style.visibility = state.currentIndex > 0 ? 'visible' : 'hidden';
  }

  state.ratingInProgress = false;
}

function confirmAndNext() {
  if (state.currentWords.length === 0) return;
  if (!state.wordRated) {
    showToast('请先评级（1 忘记 | 2 记得 | 3 简单）', 'warning');
    return;
  }
  if (state.currentIndex < state.currentWords.length - 1) {
    state.currentIndex++;
    state.testState = null;
    renderCard();
  } else {
    showComplete();
  }
}

function goBack() {
  if (state.currentWords.length === 0) return;
  if (state.currentIndex > 0) {
    state.currentIndex--;
    state.testState = null;
    renderCard();
  }
}

function showComplete() {
  updateStreak();
  saveStats();

  const dailyGoal = state.settings.dailyGoal;
  const done = state.todayStats.studied >= dailyGoal;

  // Count remaining due reviews
  const dueRemaining = state.wordList.filter(w => {
    const key = wordKey(w);
    const card = state.progress[key];
    return card && SM2.isDue(card);
  }).length;

  dom.completeTitle.textContent = done ? '🎉 太棒了！' : '👏 本轮完成！';
  if (done) {
    dom.completeMessage.textContent = `你已完成今日目标 ${dailyGoal} 个单词！`;
  } else if (state.mode === 'review' && dueRemaining > 0) {
    dom.completeMessage.textContent = `本轮复习完成，还有 ${dueRemaining} 个单词待复习，可继续或切换新学模式。`;
  } else {
    dom.completeMessage.textContent = `你已完成本轮学习，距离每日目标还差 ${Math.max(0, dailyGoal - state.todayStats.studied)} 个单词`;
  }

  state.learningReport = createLearningReport({
    words: state.wordList,
    progress: state.progress,
    category: state.category,
    stats: state.stats,
    today: today()
  });
  const weakList = state.learningReport.weakWords.length > 0
    ? state.learningReport.weakWords.map(w => `<span class="report-chip">${escapeHtml(w.word)}</span>`).join('')
    : '<span class="report-chip">暂无</span>';

  dom.completeStats.innerHTML = `
    <div class="complete-stat">
      <span class="complete-stat-value">${state.todayStats.studied}</span>
      <span class="complete-stat-label">今日学习</span>
    </div>
    <div class="complete-stat">
      <span class="complete-stat-value">${state.todayStats.total > 0 ? Math.round((state.todayStats.correct / state.todayStats.total) * 100) + '%' : '-'}</span>
      <span class="complete-stat-label">正确率</span>
    </div>
    <div class="complete-stat">
      <span class="complete-stat-value">${countMastered()}</span>
      <span class="complete-stat-label">已掌握</span>
    </div>
    <div class="complete-stat">
      <span class="complete-stat-value">${state.stats.streak}天</span>
      <span class="complete-stat-label">连续打卡</span>
    </div>
    <div class="learning-report">
      <div class="report-title">智能学习报告</div>
      <div class="report-row"><span>明日预计复习</span><strong>${state.learningReport.tomorrowDue}</strong></div>
      <div class="report-row"><span>建议</span><strong>${escapeHtml(state.learningReport.suggestion)}</strong></div>
      <div class="report-weak"><span>薄弱词</span><div>${weakList}</div></div>
    </div>
  `;

  // Close detail panel on complete
  const detailPanel = $('#word-detail-panel');
  if (detailPanel) detailPanel.classList.remove('show');

  dom.completeOverlay.classList.remove('hidden');

  // Confetti if daily goal met
  if (done) {
    setTimeout(() => launchConfetti(), 300);
  }
}

// --- Pronunciation ---
function pronounce(word) {
  if (!('speechSynthesis' in window)) {
    showToast('您的系统不支持发音功能', 'error');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
    || voices.find(v => v.lang.startsWith('en-US'))
    || voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;

  dom.btnPronounce.classList.add('playing');
  utterance.onend = () => dom.btnPronounce.classList.remove('playing');
  utterance.onerror = () => dom.btnPronounce.classList.remove('playing');

  window.speechSynthesis.speak(utterance);
}

// --- Mode & Category Switching ---
async function switchMode(mode) {
  // Warn if switching away from an in-progress test
  if (state.mode === 'test' && state.testState && !state.testState.answered) {
    if (!confirm('当前测试未完成，切换模式将丢失进度。确定要切换吗？')) return;
  }

  state.mode = mode;
  state.currentIndex = 0;
  state.wordRated = false;
  state.testState = null;
  state.sessionRatings = {};

  dom.modeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  await loadWordList();
  renderCard();
}

async function switchCategory(category) {
  // Warn if switching away from an in-progress test
  if (state.mode === 'test' && state.testState && !state.testState.answered) {
    if (!confirm('当前测试未完成，切换词库将丢失进度。确定要切换吗？')) return;
  }

  state.category = category;
  state.currentIndex = 0;
  state.wordRated = false;
  state.testState = null;
  state.sessionRatings = {};

  dom.catTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });

  await loadWordList();
  renderCard();
}

function updateFontSize(delta) {
  state.settings.fontSize = Math.max(14, Math.min(28, state.settings.fontSize + delta));
  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
  if (dom.fontDisplay) dom.fontDisplay.textContent = state.settings.fontSize + 'px';
  saveSettings();
}

// --- Favorites ---
async function loadFavorites() {
  try {
    const favorites = await api.get_favorites();
    state.favorites = new Set(Array.isArray(favorites) ? favorites : []);
  } catch (e) {
    state.favorites = new Set();
  }
}

function saveFavorites() {
  api.save_favorites([...state.favorites]).catch(e => console.error(e));
}

function toggleFavorite() {
  if (state.currentWords.length === 0) return;
  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
  } else {
    state.favorites.add(key);
  }
  saveFavorites();
  updateFavoriteIcon();
}

function updateFavoriteIcon() {
  const btn = $('#btn-favorite');
  if (!btn || state.currentWords.length === 0) return;
  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  if (state.favorites.has(key)) {
    btn.textContent = '★';
    btn.classList.add('active');
  } else {
    btn.textContent = '☆';
    btn.classList.remove('active');
  }
}

// --- Word Detail Panel ---
function updateWordDetail() {
  if (state.currentWords.length === 0) {
    $('#detail-interval').textContent = '-';
    $('#detail-next-review').textContent = '-';
    $('#detail-repetitions').textContent = '-';
    $('#detail-ef').textContent = '-';
    return;
  }
  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  const card = state.progress[key];
  if (card && card.repetitions > 0) {
    $('#detail-interval').textContent = card.interval + ' 天';
    $('#detail-next-review').textContent = card.nextReview || '今天';
    $('#detail-repetitions').textContent = card.repetitions + ' 次';
    $('#detail-ef').textContent = (card.ef || 2.5).toFixed(1);
  } else {
    $('#detail-interval').textContent = '未学习';
    $('#detail-next-review').textContent = '待学习';
    $('#detail-repetitions').textContent = '0 次';
    $('#detail-ef').textContent = '2.5';
  }
}

function toggleDetailPanel() {
  const panel = $('#word-detail-panel');
  if (panel) panel.classList.toggle('show');
}

// --- Dark Mode ---
function initTheme() {
  const saved = state.settings.darkMode;
  if (saved) {
    document.documentElement.setAttribute('data-theme', 'dark');
    $('#btn-theme').textContent = '☀️';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? null : 'dark';
  if (next) {
    document.documentElement.setAttribute('data-theme', 'dark');
    $('#btn-theme').textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    $('#btn-theme').textContent = '🌙';
  }
  state.settings.darkMode = next === 'dark';
  saveSettings();
}

// --- Search ---
function initSearch() {
  const input = $('#word-search');
  const clearBtn = $('#btn-search-clear');
  const results = $('#search-results');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    clearBtn.classList.toggle('hidden', !val);
    if (!val) { results.classList.remove('show'); return; }
    debounceTimer = setTimeout(() => filterWords(val.toLowerCase()), 150);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim() && state.searchResults && state.searchResults.length > 0) {
      results.classList.add('show');
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    results.classList.remove('show');
    state.searchResults = [];
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) {
      results.classList.remove('show');
    }
  });
}

function filterWords(query) {
  const matches = filterSearchWords
    ? filterSearchWords(state.wordList, query, 20)
    : state.wordList.filter(w =>
      w.word.toLowerCase().includes(query) ||
      (w.meaning && w.meaning.includes(query))
    ).slice(0, 20);
  state.searchResults = matches;
  renderSearchResults(matches);
}

function renderSearchResults(matches) {
  const container = $('#search-results');
  container.innerHTML = renderSearchResultsHtml
    ? renderSearchResultsHtml(matches)
    : (matches.length === 0
      ? '<div style="padding:12px 14px;color:var(--text-muted);font-size:13px;">未找到匹配单词</div>'
      : matches.map(w => `
    <div class="search-result-item" data-word="${escapeHtml(w.word)}">
      <span class="search-result-word">${escapeHtml(w.word)}</span>
      <span class="search-result-meaning">${escapeHtml(w.meaning || '')}</span>
    </div>
  `).join(''));
  container.classList.add('show');

  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const wordText = item.dataset.word;
      jumpToWord(wordText);
      container.classList.remove('show');
      $('#word-search').value = '';
      $('#btn-search-clear').classList.add('hidden');
    });
  });
}

function jumpToWord(wordText) {
  const idx = state.currentWords.findIndex(w => w.word === wordText);
  if (idx >= 0) {
    state.currentIndex = idx;
    state.wordRated = false;
    state.testState = null;
    renderCard();
  } else {
    // Word not in current queue — temporarily add and jump
    const word = state.wordList.find(w => w.word === wordText);
    if (word) {
      state.currentWords = [word];
      state.currentIndex = 0;
      state.wordRated = false;
      state.testState = null;
      renderCard();
      showToast('已跳转到单词：' + wordText + '（已临时替换当前队列）', '');
    }
  }
}

// --- Stats Dashboard ---
let _statsRenderTimer = null;

function openStats() {
  const overlay = $('#stats-overlay');
  if (!overlay) return;

  // Cancel any pending canvas render to avoid duplicates
  if (_statsRenderTimer) {
    clearTimeout(_statsRenderTimer);
    _statsRenderTimer = null;
  }

  // Update summary cards
  let totalStudied = 0, totalCorrect = 0, totalTotal = 0;
  const dailyData = state.stats.daily || {};
  for (const d of Object.values(dailyData)) {
    totalStudied += (d.studied || 0);
    totalCorrect += (d.correct || 0);
    totalTotal += (d.total || 0);
  }
  $('#stats-total-studied').textContent = totalStudied;
  $('#stats-accuracy-avg').textContent = totalTotal > 0
    ? Math.round((totalCorrect / totalTotal) * 100) + '%' : '-';
  $('#stats-streak-max').textContent = state.stats.streak || 0;
  $('#stats-mastered-total').textContent = countMastered();

  overlay.classList.remove('hidden');
  _statsRenderTimer = setTimeout(() => {
    _statsRenderTimer = null;
    renderHeatmap();
    renderAccuracyChart();
  }, 100);
}

function closeStats() {
  if (_statsRenderTimer) {
    clearTimeout(_statsRenderTimer);
    _statsRenderTimer = null;
  }
  $('#stats-overlay').classList.add('hidden');
}

function renderHeatmap() {
  const canvas = $('#chart-heatmap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const cellSize = 11, gap = 2, totalCell = cellSize + gap;
  const cols = 26; // half-year of weeks
  const rows = 7;
  const startX = w - cols * totalCell - 10;
  const startY = 10;
  const dailyData = state.stats.daily || {};

  // Fill last 26 weeks
  const todayDate = new Date();
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const dayOffset = (cols - 1 - col) * 7 + (6 - row);
      const d = new Date(todayDate);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = localDateKey(d);
      const dayData = dailyData[dateStr];
      const count = dayData ? (dayData.studied || 0) : 0;

      let color;
      if (count === 0) color = '#e8eef4';
      else if (count <= 5) color = '#b4d8f0';
      else if (count <= 15) color = '#6cb4ee';
      else if (count <= 30) color = '#4a90d9';
      else color = '#2c6fbb';

      ctx.fillStyle = color;
      ctx.fillRect(startX + col * totalCell, startY + row * totalCell, cellSize, cellSize);
      ctx.fillStyle = 'rgba(0,0,0,0)'; // no stroke
    }
  }

  // Day labels
  const dayLabels = ['一', '', '三', '', '五', '', '日'];
  ctx.fillStyle = '#6d7a8c';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 7; i++) {
    ctx.fillText(dayLabels[i], 2, startY + i * totalCell + 9);
  }

  // Legend
  const legendX = startX;
  const legendY = startY + rows * totalCell + 6;
  ctx.fillText('少', legendX, legendY + 9);
  const legendColors = ['#e8eef4', '#b4d8f0', '#6cb4ee', '#4a90d9', '#2c6fbb'];
  legendColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(legendX + 20 + i * (cellSize + 2), legendY, cellSize, cellSize);
  });
  ctx.fillStyle = '#6d7a8c';
  ctx.fillText('多', legendX + 20 + legendColors.length * (cellSize + 2) + 4, legendY + 9);
}

function renderAccuracyChart() {
  const canvas = $('#chart-accuracy');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const dailyData = state.stats.daily || {};
  const dates = Object.keys(dailyData).sort().slice(-14);
  if (dates.length === 0) {
    ctx.fillStyle = '#6d7a8c';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据，开始学习后将显示正确率趋势', w / 2, h / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 35 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barWidth = Math.max(8, chartW / dates.length - 4);
  const barGap = 2;

  // Y axis
  ctx.strokeStyle = '#dce3ea';
  ctx.lineWidth = 1;
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = padding.top + chartH - (pct / 100) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = '#6d7a8c';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', padding.left - 5, y + 4);
  }

  // Bars
  dates.forEach((dateStr, i) => {
    const dayData = dailyData[dateStr];
    const acc = dayData.total > 0 ? Math.round((dayData.correct / dayData.total) * 100) : 0;
    const x = padding.left + i * (barWidth + barGap) + barGap / 2;
    const barH = (acc / 100) * chartH;
    const y = padding.top + chartH - barH;

    const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    gradient.addColorStop(0, '#4a90d9');
    gradient.addColorStop(1, '#6cb4ee');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barH);

    // Date label every other
    if (i % 2 === 0) {
      ctx.fillStyle = '#6d7a8c';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      const shortDate = dateStr.slice(5);
      ctx.fillText(shortDate, x + barWidth / 2, padding.top + chartH + 15);
    }
  });

  // Title
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('近14天正确率趋势', w / 2, 14);
}

// --- Confetti ---
let _confettiAnimId = null;

function launchConfetti() {
  const canvas = $('#confetti-canvas');
  if (!canvas) return;

  // Cancel any running confetti animation
  if (_confettiAnimId) {
    cancelAnimationFrame(_confettiAnimId);
    _confettiAnimId = null;
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const particles = [];
  const colors = ['#4a90d9', '#27ae60', '#f39c12', '#e74c3c', '#a78bfa', '#f472b6', '#ffd700'];

  for (let i = 0; i < 200; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 300,
      y: canvas.height / 2 - 50,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 10 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      life: 1,
      decay: 0.006 + Math.random() * 0.012
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.18;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive) {
      _confettiAnimId = requestAnimationFrame(animate);
    } else {
      _confettiAnimId = null;
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  _confettiAnimId = requestAnimationFrame(animate);
}

// --- Loading Spinner ---
function showLoading() {
  $('#loading-overlay').classList.remove('hidden');
}
function hideLoading() {
  $('#loading-overlay').classList.add('hidden');
}

// --- About Modal ---
function openAbout() {
  $('#about-overlay').classList.remove('hidden');
}
function closeAbout() {
  $('#about-overlay').classList.add('hidden');
}

// --- Event Handlers ---
function init() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');

  // Category tabs
  dom.catTabs.forEach(tab => {
    tab.addEventListener('click', () => switchCategory(tab.dataset.category));
  });

  // Mode tabs
  dom.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Navigation — confirm and back buttons
  if (dom.btnConfirm) dom.btnConfirm.addEventListener('click', confirmAndNext);
  if (dom.btnBack) dom.btnBack.addEventListener('click', goBack);

  // Card click → pronounce
  $('#word-card').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (state.currentWords.length > 0 && state.mode !== 'test') {
      pronounce(state.currentWords[state.currentIndex].word);
    }
  });

  // Pronounce button
  dom.btnPronounce.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentWords.length > 0) {
      pronounce(state.currentWords[state.currentIndex].word);
    }
  });

  // Rating buttons
  dom.btnForgot.addEventListener('click', () => rateWord(1));
  dom.btnRemember.addEventListener('click', () => rateWord(3));
  dom.btnEasy.addEventListener('click', () => rateWord(5));

  // Test next
  dom.btnNextTest.addEventListener('click', moveNext);

  // Complete overlay
  $('#btn-complete-close').addEventListener('click', () => {
    dom.completeOverlay.classList.add('hidden');
    state.sessionRatings = {};
    buildQueue();
    renderCard();
  });

  // Settings
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-settings-cancel').addEventListener('click', closeSettings);
  $('#btn-settings-save').addEventListener('click', saveSettingsHandler);
  $('#btn-font-dec').addEventListener('click', () => updateFontSize(-1));
  $('#btn-font-inc').addEventListener('click', () => updateFontSize(1));

  // Import
  $('#btn-import').addEventListener('click', async () => {
    try {
      const result = await api.import_words();
      if (!result) {
        showToast('操作失败：无法连接到后端服务', 'error');
      } else if (result.success) {
        showToast(result.message, 'success');
        await loadWordList();
        renderCard();
      } else {
        showToast(result.message || '操作失败', 'error');
      }
    } catch (e) {
      showToast('导入失败: ' + e.message, 'error');
    }
  });

  // Export
  $('#btn-export').addEventListener('click', async () => {
    try {
      const result = await api.export_data();
      if (!result) {
        showToast('操作失败：无法连接到后端服务', 'error');
      } else if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message || '操作失败', 'error');
      }
    } catch (e) {
      showToast('导出失败: ' + e.message, 'error');
    }
  });

  // Restore full backup
  $('#btn-restore')?.addEventListener('click', async () => {
    if (!confirm('恢复备份会覆盖当前进度、统计、设置、收藏和自定义单词。确定继续吗？')) return;
    try {
      const result = await api.restore_data();
      if (!result) {
        showToast('操作失败：无法连接到后端服务', 'error');
      } else if (result.success) {
        showToast(result.message, 'success');
        await loadData();
        await loadFavorites();
        await loadWordList();
        renderCard();
      } else {
        showToast(result.message || '恢复失败', 'error');
      }
    } catch (e) {
      showToast('恢复失败: ' + e.message, 'error');
    }
  });

  // Reset progress
  $('#btn-reset')?.addEventListener('click', async () => {
    if (confirm('确定要重置所有学习进度吗？此操作不可撤销。')) {
      try {
        await api.reset_progress();
        state.progress = {};
        state.todayStats = { studied: 0, correct: 0, total: 0 };
        state.stats = { daily: {}, streak: 0, lastStudyDate: null };
        showToast('进度已重置', 'warning');
        await loadWordList();
        renderCard();
      } catch (e) {
        showToast('重置失败', 'error');
      }
    }
  });

  // Add word modal buttons
  $('#btn-add-save')?.addEventListener('click', addWord);
  $('#btn-add-cancel')?.addEventListener('click', closeAddWord);
  document.getElementById('btn-add-word')?.addEventListener('click', openAddWord);

  // Theme toggle
  $('#btn-theme').addEventListener('click', toggleTheme);

  // Search
  initSearch();
  $('#btn-search-toggle').addEventListener('click', () => {
    const input = $('#word-search');
    input.focus();
    input.select();
  });

  // Stats
  $('#btn-stats').addEventListener('click', openStats);
  $('#btn-stats-close')?.addEventListener('click', closeStats);

  // About
  $('#btn-about-close')?.addEventListener('click', closeAbout);

  // Favorites
  $('#btn-favorite')?.addEventListener('click', toggleFavorite);

  // Word detail toggle — click on progress area toggles detail panel
  $('#card-progress')?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    toggleDetailPanel();
  });

  // Close overlays on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeAddWord();
      closeStats();
      closeAbout();
      dom.completeOverlay.classList.add('hidden');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goBack();
        break;
      case 'Enter':
        if (state.mode !== 'test' && state.wordRated) {
          e.preventDefault();
          confirmAndNext();
        }
        break;
      case '1':
        if (state.mode !== 'test') { e.preventDefault(); rateWord(1); }
        break;
      case '2':
        if (state.mode !== 'test') { e.preventDefault(); rateWord(3); }
        break;
      case '3':
        if (state.mode !== 'test') { e.preventDefault(); rateWord(5); }
        break;
      case ' ':
        if (state.mode !== 'test' && state.currentWords.length > 0) {
          e.preventDefault();
          pronounce(state.currentWords[state.currentIndex].word);
        }
        break;
      case 'r':
        if (!e.ctrlKey && !e.metaKey) switchMode('review');
        break;
      case 'n':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openAddWord();
        } else {
          switchMode('new');
        }
        break;
      case 't':
        if (!e.ctrlKey && !e.metaKey) switchMode('test');
        break;
      case 'w':
        if (!e.ctrlKey && !e.metaKey) switchMode('weak');
        break;
    }
  });
}

// --- Settings ---
function openSettings() {
  $('#setting-daily-goal').value = state.settings.dailyGoal;
  dom.settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  dom.settingsOverlay.classList.add('hidden');
}

async function saveSettingsHandler() {
  state.settings.dailyGoal = parseInt($('#setting-daily-goal').value) || 30;
  state.settings.dailyGoal = Math.max(5, Math.min(200, state.settings.dailyGoal));
  await saveSettings();
  dom.settingsOverlay.classList.add('hidden');
  showToast('设置已保存', 'success');
  await loadWordList();
  renderCard();
}

// --- Add Word ---
function openAddWord() {
  const overlay = document.getElementById('add-word-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function closeAddWord() {
  const overlay = document.getElementById('add-word-overlay');
  if (overlay) overlay.classList.add('hidden');
}

async function addWord() {
  const wordText = $('#add-word-text')?.value?.trim();
  const meaning = $('#add-word-meaning')?.value?.trim();

  if (!wordText || !meaning) {
    showToast('请至少填写单词和释义', 'warning');
    return;
  }

  const word = {
    word: wordText,
    phonetic: $('#add-word-phonetic')?.value?.trim() || '',
    meaning: meaning,
    example: $('#add-word-example')?.value?.trim() || '',
    exampleTranslation: $('#add-word-example-trans')?.value?.trim() || ''
  };

  try {
    const result = await api.add_custom_word(state.category, word);
    if (result && result.success) {
      showToast(result.message, 'success');
      closeAddWord();
      // Clear form
      ['add-word-text', 'add-word-phonetic', 'add-word-meaning', 'add-word-example', 'add-word-example-trans'].forEach(id => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      await loadWordList();
      renderCard();
    } else if (result) {
      showToast(result.message, 'error');
    }
  } catch (e) {
    showToast('添加失败: ' + e.message, 'error');
  }
}

// --- Bootstrap ---
async function bootstrap() {
  await loadData();

  // Initialize favorites
  await loadFavorites();

  // Add "Add Word" button to header
  const headerRight = document.querySelector('.header-right');
  if (headerRight) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-icon';
    addBtn.id = 'btn-add-word';
    addBtn.title = '添加单词 (Ctrl+N)';
    addBtn.textContent = '➕';
    headerRight.insertBefore(addBtn, $('#btn-settings'));
    addBtn.addEventListener('click', openAddWord);
  }

  init();
  initTheme();

  await loadWordList();
  renderCard();
}

// Wait for pywebview API to be ready, then bootstrap
if (window.pywebview) {
  // pywebview API is available immediately when the page loads
  bootstrap().catch(err => {
    console.error('Failed to bootstrap:', err);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:18px;color:#e74c3c;">启动失败: ${escapeHtml(err.message)}</div>`;
  });
} else {
  // Running in browser (dev mode) - use fallback API
  window.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(err => {
      console.error('Failed to bootstrap:', err);
    });
  });
}
