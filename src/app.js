// ============================================================
// VocabMaster - Main Application Logic
// Backend: Python + pywebview
// ============================================================

const utils = window.VocabMasterUtils;
if (!utils || typeof utils.escapeHtml !== 'function' ||
    typeof utils.localDateKey !== 'function' ||
    typeof utils.debounce !== 'function') {
  throw new Error('VocabMasterUtils must be loaded before app.js');
}
const { escapeHtml, localDateKey, debounce } = utils;
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
const scheduler = window.VocabMasterScheduler;
if (!scheduler || typeof scheduler.calculateSM2 !== 'function' ||
    typeof scheduler.isDue !== 'function' ||
    typeof scheduler.buildMixedQueue !== 'function' ||
    typeof scheduler.buildLearningQueue !== 'function' ||
    typeof scheduler.wordKeyFor !== 'function') {
  throw new Error('VocabMasterScheduler must be loaded before app.js');
}
const {
  calculateSM2,
  isDue: schedulerIsDue,
  buildMixedQueue,
  buildLearningQueue,
  wordKeyFor: schedulerWordKeyFor
} = scheduler;
const {
  filterWords: filterSearchWords = null,
  renderSearchResultsHtml = null
} = window.VocabMasterSearch || {};
const {
  calculateStatsSummary = null,
  renderStatsSummary = null,
  renderHeatmapCanvas = null,
  renderAccuracyChartCanvas = null,
  renderCategoryProgress = null,
  renderTestHistory = null,
  buildWeeklyReport = null,
  buildAchievements = null,
  renderWeeklyReport = null,
  renderAchievements = null
} = window.VocabMasterStats || {};
const {
  renderMemoryCurve = null
} = window.VocabMasterMemoryCurve || {};
const {
  analyzeMorphology = () => []
} = window.VocabMasterMorphology || {};
const tts = window.VocabMasterTTS;
if (!tts || typeof tts.speak !== 'function' || typeof tts.warmup !== 'function') {
  throw new Error('VocabMasterTTS must be loaded before app.js');
}
const { speak: speakWord, warmup: warmupSpeech } = tts;
const {
  recordError: ebRecordError = null,
  recordCorrect: ebRecordCorrect = null,
  getErrorWords: ebGetErrorWords = null,
  renderErrorBookList: ebRenderErrorBookList = null,
  buildErrorReviewQueue: ebBuildErrorReviewQueue = null
} = window.VocabMasterErrorBook || {};
const {
  applyFontDelta = null,
  openSettingsModal = null,
  closeSettingsModal = null,
  readSettingsForm = null,
  normalizeCategory: normalizeSettingsCategory = null
} = window.VocabMasterSettings || {};
const {
  bindBackupActions = null
} = window.VocabMasterBackupActions || {};
const {
  openAddWordOverlay = null,
  closeAddWordOverlay = null,
  bindCustomWordForm = null
} = window.VocabMasterWordForm || {};
const {
  createShortcutHandler = null
} = window.VocabMasterKeyboardShortcuts || {};

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
    case 'save_learning_state':
      localStorage.setItem('vm_progress', JSON.stringify(args[0]));
      localStorage.setItem('vm_stats', JSON.stringify(args[1]));
      localStorage.setItem('vm_settings', JSON.stringify(args[2]));
      return Promise.resolve({ success: true });
    case 'get_all_words':
      return Promise.resolve({ [state.category]: state.wordList });
    case 'get_startup_status':
      return Promise.resolve({ available: false, enabled: false });
    case 'set_startup':
      return Promise.resolve({ success: true, available: false, enabled: Boolean(args[0]) });
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
    return calculateSM2(q, card, today());
  },

  isDue(card) {
    return schedulerIsDue(card, today());
  }
};

// --- Application State ---
const state = {
  mode: 'mixed',
  category: 'cet4',
  currentIndex: 0,
  wordList: [],
  currentWords: [],
  progress: {},
  stats: { daily: {}, streak: 0, lastStudyDate: null },
  settings: {
    fontSize: 18,
    dailyGoal: 30,
    darkMode: false,
    category: 'cet4',
    closeToTray: true,
    speechAccent: 'en-US',
    speechRate: 0.85
  },
  todayStats: { studied: 0, correct: 0, total: 0 },
  testState: null,
  testType: 'choice',
  answerRevealed: false,
  wordRated: false,
  ratingInProgress: false,
  favorites: new Set(),
  searchResults: [],
  learningReport: null,
  sessionNewLimit: null,
  sessionRatings: {},  // key -> quality, tracks per-session rating
  undoStack: [],         // max depth 10, for Ctrl+Z undo
  testStartTime: null,   // test mode start timestamp (P2)
  testSessionStats: null,
  allWordsCache: null,   // all words cache for dashboard (P2)
  queueMeta: { reviewCount: 0, newCount: 0 },
  metricsVersion: 0,
  uiMetricsCache: { key: '', mastered: 0, dueToday: 0, dueTomorrow: 0 }
};

// --- DOM Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const VALID_CATEGORIES = ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl'];
const CATEGORY_LABELS = {
  cet4: 'CET-4',
  cet6: 'CET-6',
  postgraduate: '考研',
  ielts: '雅思',
  toefl: '托福'
};
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let activeDialogs = [];

const dom = {
  wordCard: $('#word-card'),
  wordText: $('#word-text'),
  wordPhonetic: $('#word-phonetic'),
  wordMeaning: $('#word-meaning'),
  wordExample: $('#word-example'),
  wordExampleTrans: $('#word-example-trans'),
  wordInsights: $('#word-insights'),
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
  testTypeTabs: $$('.test-type-tab'),
  testInputForm: $('#test-input-form'),
  testAnswerInput: $('#test-answer-input'),
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
  queueNote: $('.queue-note'),
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

const CARD_TRANSITION_MS = 200;
let cardTransitionTimer = null;

function clearCardTransitionClasses() {
  if (!dom.wordCard) return;
  dom.wordCard.classList.remove(
    'slide-out-left',
    'slide-in-right',
    'slide-out-right',
    'slide-in-left'
  );
}

function prefersReducedMotion() {
  return window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function transitionCard(direction, updateView) {
  if (!dom.wordCard || prefersReducedMotion()) {
    updateView();
    return;
  }
  const isBack = direction === 'back';
  const inClass = isBack ? 'slide-in-left' : 'slide-in-right';
  clearTimeout(cardTransitionTimer);
  clearCardTransitionClasses();
  updateView();
  requestAnimationFrame(() => {
    dom.wordCard.classList.add(inClass);
    cardTransitionTimer = setTimeout(() => {
      clearCardTransitionClasses();
    }, CARD_TRANSITION_MS);
  });
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function activateDialog(overlay, preferredFocus = null) {
  if (!overlay) return;
  const existingIndex = activeDialogs.findIndex(item => item.overlay === overlay);
  if (existingIndex >= 0) activeDialogs.splice(existingIndex, 1);
  activeDialogs.push({
    overlay,
    restoreTo: document.activeElement instanceof HTMLElement ? document.activeElement : null
  });

  const focusTarget = preferredFocus || getFocusableElements(overlay)[0] || overlay;
  if (!overlay.hasAttribute('tabindex')) overlay.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => {
    if (!overlay.classList.contains('hidden') && focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
      if (typeof focusTarget.select === 'function') focusTarget.select();
    }
  });
}

function deactivateDialog(overlay, restoreFocus = true) {
  const index = activeDialogs.findIndex(item => item.overlay === overlay);
  const entry = index >= 0 ? activeDialogs.splice(index, 1)[0] : null;
  if (!restoreFocus || !entry || !entry.restoreTo || !document.contains(entry.restoreTo)) return;
  requestAnimationFrame(() => {
    if (entry.restoreTo && typeof entry.restoreTo.focus === 'function') entry.restoreTo.focus();
  });
}

function trapDialogFocus(event) {
  if (event.key !== 'Tab' || activeDialogs.length === 0) return;
  const current = activeDialogs[activeDialogs.length - 1].overlay;
  if (!current || current.classList.contains('hidden')) return;
  const focusable = getFocusableElements(current);
  if (focusable.length === 0) {
    event.preventDefault();
    current.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openAddWordDialog() {
  openAddWordOverlay(document);
  const overlay = $('#add-word-overlay');
  activateDialog(overlay, $('#add-word-text'));
}

function closeAddWordDialog() {
  const overlay = $('#add-word-overlay');
  closeAddWordOverlay(document);
  deactivateDialog(overlay);
}

// --- Helpers ---
function wordKey(word) {
  const category = word._cat || state.category;
  return wordKeyForCategory(word, category);
}

function wordKeyForCategory(word, category) {
  if (schedulerWordKeyFor) {
    return schedulerWordKeyFor(word, category);
  }
  return `${word.word.toLowerCase()}_${category}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasUsableExample(word) {
  const example = String(word.example || '').trim();
  const translation = String(word.exampleTranslation || '').trim();
  return Boolean(example &&
    example !== 'No example available in ECDICT.' &&
    translation !== 'ECDICT 未提供例句。');
}

function extractPartOfSpeech(meaning) {
  const text = String(meaning || '');
  const matches = text.match(/\b(n|v|adj|adv|prep|conj|pron|num|int)\./gi) || [];
  return [...new Set(matches.map(item => item.toLowerCase()))].slice(0, 4);
}

function tomorrowKey() {
  const date = new Date(`${today()}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function dateKeyFromOffset(offset) {
  const date = new Date(`${today()}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
}

function dueCountFor(dateKey) {
  return state.wordList.filter(word => {
    const card = state.progress[wordKey(word)];
    return card && card.nextReview && card.nextReview <= dateKey;
  }).length;
}

function markMetricsDirty() {
  state.metricsVersion += 1;
  state.uiMetricsCache.key = '';
}

function getLearningMetrics() {
  const cacheKey = `${state.metricsVersion}:${state.wordList.length}:${today()}`;
  if (state.uiMetricsCache.key === cacheKey) return state.uiMetricsCache;

  const todayKey = today();
  const tomorrow = tomorrowKey();
  let dueToday = 0;
  let dueTomorrow = 0;

  for (const word of state.wordList) {
    const card = state.progress[wordKey(word)];
    if (!card || !card.nextReview) continue;
    if (card.nextReview <= todayKey) dueToday += 1;
    if (card.nextReview <= tomorrow) dueTomorrow += 1;
  }

  const mastered = Object.values(state.progress)
    .filter(card => card.repetitions >= 3 && card.ef >= 2.0)
    .length;

  state.uiMetricsCache = { key: cacheKey, mastered, dueToday, dueTomorrow };
  return state.uiMetricsCache;
}

function buildReviewForecast(days = 7) {
  const forecast = [];
  for (let offset = 0; offset < days; offset++) {
    const dateKey = dateKeyFromOffset(offset);
    let count = 0;
    Object.values(state.progress || {}).forEach(card => {
      if (!card || !card.nextReview) return;
      if (offset === 0) {
        if (card.nextReview <= dateKey) count++;
      } else if (card.nextReview === dateKey) {
        count++;
      }
    });
    forecast.push({
      date: dateKey,
      label: offset === 0 ? '今天' : offset === 1 ? '明天' : `${offset}天后`,
      count
    });
  }
  return forecast;
}

function renderReviewForecast() {
  const container = $('#review-pressure-forecast');
  if (!container) return;
  const forecast = buildReviewForecast(7);
  const maxCount = Math.max(1, ...forecast.map(item => item.count));
  container.innerHTML = forecast.map(item => `
    <div class="pressure-row">
      <span class="pressure-date">${escapeHtml(item.label)}</span>
      <div class="pressure-bar-track">
        <div class="pressure-bar-fill" style="width:${Math.round((item.count / maxCount) * 100)}%"></div>
      </div>
      <span class="pressure-count">${item.count}</span>
    </div>
  `).join('');
}

function explainCurrentWord(word) {
  const key = wordKey(word);
  const card = state.progress[key];
  if (state.mode === 'mixed') {
    if (!card || card.repetitions === 0) {
      return '智能混合新词：当前没有更优先的到期复习，完成评级后会生成下次复习日期。';
    }
    if (card.nextReview && card.nextReview < today()) {
      return `智能混合复习：该词已逾期，原计划 ${card.nextReview}。`;
    }
    return `智能混合复习：该词今天到期，当前间隔 ${card.interval || 0} 天。`;
  }
  if (state.mode === 'new') {
    return card && card.repetitions > 0
      ? '补入今日新学队列，继续巩固已开始学习的单词。'
      : '新词：尚未建立记忆记录，完成评级后会生成下次复习日期。';
  }
  if (state.mode === 'review') {
    if (!card || !card.nextReview) return '复习：该词缺少完整复习记录，需要重新确认掌握情况。';
    if (card.nextReview < today()) return `逾期复习：原计划 ${card.nextReview}，优先处理避免遗忘累积。`;
    return `到期复习：计划今天复习，当前间隔 ${card.interval || 0} 天。`;
  }
  if (state.mode === 'weak') {
    const lapses = card && card.lapses ? card.lapses : 0;
    if (state.favorites.has(key)) return '强化：你已收藏该词，系统将其纳入重点练习。';
    if (lapses > 0) return `强化：历史遗忘 ${lapses} 次，需要集中巩固。`;
    return '强化：该词难度系数较低或近期表现不稳。';
  }
  if (state.testType === 'spelling') return '拼写测试：根据释义回忆英文拼写。';
  if (state.testType === 'listening') return '听音测试：根据发音输入英文单词。';
  return '选择测试：从干扰项中辨认正确释义。';
}

function updateWordInsights(word) {
  if (!dom.wordInsights) return;
  const key = wordKey(word);
  const card = state.progress[key];
  const chips = [];
  extractPartOfSpeech(word.meaning).forEach(pos => chips.push({ label: pos, type: 'meta' }));
  chips.push({ label: hasUsableExample(word) ? '有例句' : '缺例句', type: 'meta' });
  analyzeMorphology(word.word).forEach(part => {
    chips.push({
      label: `${part.text}: ${part.meaning}`,
      type: `morph-${part.type}`,
      title: `${part.type} · ${part.meaning}`
    });
  });
  if (state.favorites.has(key)) chips.push({ label: '已收藏', type: 'meta' });
  if (card && card.lapses > 0) chips.push({ label: `遗忘${card.lapses}次`, type: 'meta' });
  if (card && card.repetitions > 0) chips.push({ label: `复习${card.repetitions}轮`, type: 'meta' });
  dom.wordInsights.innerHTML = chips
    .map(chip => `<span class="word-insight-chip ${escapeHtml(chip.type)}" title="${escapeHtml(chip.title || chip.label)}">${escapeHtml(chip.label)}</span>`)
    .join('');
}

function updateStudyPlan(word = null) {
  const todayGoal = Math.max(1, state.settings.dailyGoal || 30);
  const todayStudied = state.todayStats.studied || 0;
  const metrics = getLearningMetrics();
  const planToday = $('#plan-today');
  const planDue = $('#plan-due');
  const planTomorrow = $('#plan-tomorrow');
  const planReason = $('#plan-reason');
  if (planToday) planToday.textContent = `${Math.min(todayStudied, todayGoal)}/${todayGoal}`;
  if (planDue) planDue.textContent = String(metrics.dueToday);
  if (planTomorrow) planTomorrow.textContent = String(metrics.dueTomorrow);
  if (planReason) {
    planReason.textContent = word
      ? explainCurrentWord(word)
      : '当前队列为空，可以切换模式或调整每日目标。';
  }
}

function formatIntervalPreview(card) {
  const interval = Math.max(1, Number(card && card.interval) || 1);
  if (interval === 1) return '明天复习';
  if (interval < 7) return `${interval}天后复习`;
  if (interval < 30) return `${Math.round(interval / 7)}周后复习`;
  return `${Math.round(interval / 30)}个月后复习`;
}

function updateRatingPreviews(word) {
  const key = word ? wordKey(word) : '';
  const baseCard = key && state.progress[key] ? cloneJson(state.progress[key]) : null;
  const previews = [
    { selector: '#rating-preview-remember', button: dom.btnRemember, quality: 5, label: '认识' },
    { selector: '#rating-preview-easy', button: dom.btnEasy, quality: 3, label: '模糊' },
    { selector: '#rating-preview-forgot', button: dom.btnForgot, quality: 1, label: '忘记' }
  ];

  previews.forEach(item => {
    if (!word) {
      const el = $(item.selector);
      if (el) el.textContent = '下次 -';
      if (item.button) {
        item.button.setAttribute('aria-label', item.label);
        item.button.title = item.label;
      }
      return;
    }
    const previewCard = SM2.calc(item.quality, baseCard ? cloneJson(baseCard) : null);
    const text = formatIntervalPreview(previewCard);
    const el = $(item.selector);
    if (el) el.textContent = text;
    if (item.button) {
      item.button.setAttribute('aria-label', `${item.label}，${text}`);
      item.button.title = `${item.label}，${text}`;
    }
  });
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

function newLearningTarget() {
  return state.sessionNewLimit || state.settings.dailyGoal;
}

function isCurrentNewLearningSession(session, target) {
  return session
    && session.date === today()
    && session.category === state.category
    && session.target === target
    && Array.isArray(session.wordKeys)
    && Array.isArray(session.completedKeys);
}

function ensureNewLearningSession(target) {
  if (isCurrentNewLearningSession(state.settings.newLearningSession, target)) {
    return state.settings.newLearningSession;
  }

  const selectedWords = state.wordList
    .filter(word => {
      const card = state.progress[wordKey(word)];
      return !card || card.repetitions === 0;
    })
    .slice(0, target);

  state.settings.newLearningSession = {
    date: today(),
    category: state.category,
    target,
    wordKeys: selectedWords.map(wordKey),
    completedKeys: []
  };
  return state.settings.newLearningSession;
}

function buildNewLearningQueue(target) {
  const session = ensureNewLearningSession(target);
  const completed = new Set(session.completedKeys || []);
  return session.wordKeys
    .map(key => state.wordList.find(word => wordKey(word) === key))
    .filter(Boolean)
    .filter(word => !completed.has(wordKey(word)));
}

function recordNewLearningProgress(key) {
  if (state.mode !== 'new' && state.mode !== 'mixed') return true;
  const session = ensureNewLearningSession(newLearningTarget());
  if (!session.wordKeys.includes(key)) return true;
  if (!session.completedKeys.includes(key)) {
    session.completedKeys.push(key);
  }
  return true;
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
function requireSuccessfulSave(result, fallbackMessage) {
  if (result === true || (result && result.success === true)) return result;
  throw new Error((result && result.message) || fallbackMessage);
}

async function loadData() {
  try {
    const [progress, stats, settings] = await Promise.all([
      api.get_progress(),
      api.get_stats(),
      api.get_settings()
    ]);
    state.progress = progress || {};
    state.stats = stats || { daily: {}, streak: 0, lastStudyDate: null };
    state.stats.errorBook = state.stats.errorBook || {};
    state.stats.testHistory = Array.isArray(state.stats.testHistory) ? state.stats.testHistory : [];
    state.settings = {
      fontSize: 18,
      dailyGoal: 30,
      darkMode: false,
      category: 'cet4',
      closeToTray: true,
      startupEnabled: false,
      speechAccent: 'en-US',
      speechRate: 0.85,
      newLearningSession: null,
      ...(settings || {})
    };
    state.settings.category = normalizeCategory(state.settings.category);
    state.category = state.settings.category;
    // Migrate old settings
    delete state.settings.reviewCount;
    delete state.settings.newWordCount;
    markMetricsDirty();
  } catch (e) {
    console.error('Load data error:', e);
  }

  const t = today();
  if (!state.stats.daily[t]) {
    state.stats.daily[t] = { studied: 0, correct: 0, total: 0 };
  }
  state.todayStats = { ...state.stats.daily[t] };
  // Streak is updated only when actual study occurs (rateWord, handleTestChoice, showComplete)
}

async function saveProgress() {
  const result = await api.save_progress(state.progress);
  return requireSuccessfulSave(result, '保存学习进度失败');
}

async function saveStats() {
  const t = today();
  state.stats.daily[t] = { ...state.todayStats };
  const result = await api.save_stats(state.stats);
  return requireSuccessfulSave(result, '保存统计数据失败');
}

async function saveSettings() {
  const result = await api.save_settings(state.settings);
  return requireSuccessfulSave(result, '保存设置失败');
}

async function saveLearningState() {
  const t = today();
  state.stats.daily[t] = { ...state.todayStats };
  const result = await api.save_learning_state(state.progress, state.stats, state.settings);
  return requireSuccessfulSave(result, '保存学习状态失败');
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
// Word list cache: Map<category, word[]>
const wordListCache = new Map();

function invalidateWordCache(category = null) {
  if (category) {
    wordListCache.delete(category);
  } else {
    wordListCache.clear();
  }
  state.allWordsCache = null;
}

async function loadWordList(category) {
  category = category || state.category;
  // Show spinner
  const spinner = $('#loading-overlay');
  if (spinner) spinner.classList.remove('hidden');

  try {
    if (wordListCache.has(category)) {
      state.wordList = wordListCache.get(category);
    } else {
      const words = await api.get_word_list(category);
      wordListCache.set(category, words || []);
      state.wordList = words || [];
    }
  } catch (e) {
    showToast('词库加载失败: ' + (e.message || '未知错误'), 'error');
    // Keep current wordList if available
    state.wordList = state.wordList || [];
  } finally {
    if (spinner) spinner.classList.add('hidden');
  }

  markMetricsDirty();
  buildQueue();
}

function buildQueue() {
  state.queueMeta = { reviewCount: 0, newCount: 0 };

  if (state.mode === 'mixed') {
    const session = ensureNewLearningSession(newLearningTarget());
    const completed = new Set(session.completedKeys || []);
    const plannedNewWords = session.wordKeys
      .map(key => state.wordList.find(word => wordKey(word) === key))
      .filter(Boolean)
      .filter(word => !completed.has(wordKey(word)));
    const mixedQueue = buildMixedQueue({
      words: state.wordList,
      progress: state.progress,
      category: state.category,
      settings: state.settings,
      today: today(),
      newWords: plannedNewWords,
      shuffleFn: shuffle
    });
    state.currentWords = mixedQueue.words;
    state.queueMeta = {
      reviewCount: mixedQueue.reviewCount,
      newCount: mixedQueue.newCount
    };
    state.currentIndex = 0;
    state.testState = null;
    state.answerRevealed = false;
    return;
  }

  if (state.mode === 'new') {
    state.currentWords = buildNewLearningQueue(newLearningTarget());
    state.queueMeta = { reviewCount: 0, newCount: state.currentWords.length };
    state.currentIndex = 0;
    state.testState = null;
    state.answerRevealed = false;
    return;
  }

  if (buildLearningQueue) {
    const queueSettings = {
      ...state.settings,
      dailyGoal: state.settings.dailyGoal
    };
    state.currentWords = buildLearningQueue({
      words: state.wordList,
      progress: state.progress,
      category: state.category,
      mode: state.mode,
      settings: queueSettings,
      today: today(),
      favorites: [...state.favorites],
      shuffleFn: shuffle,
      buildWeakQueue
    });
    state.queueMeta = {
      reviewCount: state.mode === 'review' ? state.currentWords.length : 0,
      newCount: state.mode === 'new' ? state.currentWords.length : 0
    };
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
    state.queueMeta = { reviewCount: dueWords.length, newCount: 0 };
  } else if (state.mode === 'weak') {
    state.currentWords = buildWeakQueue(state.wordList, state.progress, state.category, {
      today: todayStr,
      limit: Math.max(10, Math.min(30, state.settings.dailyGoal)),
      favorites: [...state.favorites]
    });
    state.queueMeta = { reviewCount: 0, newCount: 0 };
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
    state.queueMeta = { reviewCount: 0, newCount: 0 };
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
  const hasExample = hasUsableExample(word);
  dom.wordExample.textContent = hasExample ? `"${word.example}"` : '';
  dom.wordExampleTrans.textContent = hasExample ? (word.exampleTranslation || '') : '';
  updateWordInsights(word);
  updateStudyPlan(word);
  updateRatingPreviews(word);

  // In review/new modes, hide meaning until user rates (unless already rated this session)
  if (state.mode !== 'test') {
    if (sessionQuality !== undefined) {
      // Already rated this session — show meaning
      dom.wordMeaning.classList.remove('hidden');
      dom.wordExample.classList.remove('hidden');
      dom.wordExampleTrans.classList.remove('hidden');
      // Show confirm/back, hide rating buttons
      dom.cardActions.classList.add('hidden');
      dom.confirmActions.classList.add('hidden');
      // Highlight which rating was given
      highlightRatedQuality(sessionQuality);
    } else if (state.answerRevealed) {
      dom.wordMeaning.classList.remove('hidden');
      dom.wordExample.classList.remove('hidden');
      dom.wordExampleTrans.classList.remove('hidden');
      dom.cardActions.classList.remove('hidden');
      dom.confirmActions.classList.add('hidden');
    } else {
      // Not yet revealed — hide meaning and rating buttons.
      dom.wordMeaning.classList.add('hidden');
      dom.wordExample.classList.add('hidden');
      dom.wordExampleTrans.classList.add('hidden');
      dom.cardActions.classList.add('hidden');
      dom.confirmActions.classList.remove('hidden');
    }
  } else {
    dom.wordMeaning.classList.add('hidden');
    dom.wordExample.classList.add('hidden');
    dom.wordExampleTrans.classList.add('hidden');
  }
  if (!hasExample) {
    dom.wordExample.classList.add('hidden');
    dom.wordExampleTrans.classList.add('hidden');
  }

  // Back button visibility (only when there are previous words)
  if (dom.btnBack) {
    dom.btnBack.classList.add('hidden');
  }

  const displayProgress = getDisplayProgress();
  dom.currentIndex.textContent = displayProgress.current;
  dom.totalCount.textContent = displayProgress.total;

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
  updateDesktopShell();
  updateFavoriteIcon();
}

function highlightRatedQuality(quality) {
  // Visually indicate which rating was given on the rating buttons
  [dom.btnForgot, dom.btnRemember, dom.btnEasy].forEach(b => {
    if (b) b.classList.remove('rated');
  });
  if (quality === 1 && dom.btnForgot) dom.btnForgot.classList.add('rated');
  if (quality === 3 && dom.btnEasy) dom.btnEasy.classList.add('rated');
  if (quality === 5 && dom.btnRemember) dom.btnRemember.classList.add('rated');
}

function getDisplayProgress() {
  if (state.mode === 'mixed' &&
      (state.queueMeta.reviewCount || 0) === 0 &&
      isCurrentNewLearningSession(state.settings.newLearningSession, newLearningTarget())) {
    const session = state.settings.newLearningSession;
    const completed = session.completedKeys.length;
    const total = session.wordKeys.length;
    return {
      current: total > 0 ? Math.min(total, completed + (state.currentWords.length > 0 ? 1 : 0)) : 0,
      total
    };
  }
  if (state.mode === 'new' && isCurrentNewLearningSession(state.settings.newLearningSession, newLearningTarget())) {
    const session = state.settings.newLearningSession;
    const completed = session.completedKeys.length;
    const total = session.wordKeys.length;
    return {
      current: total > 0 ? Math.min(total, completed + (state.currentWords.length > 0 ? 1 : 0)) : 0,
      total
    };
  }
  return {
    current: state.currentWords.length > 0 ? state.currentIndex + 1 : 0,
    total: state.currentWords.length
  };
}

function modeLabel(mode) {
  return {
    mixed: '混合',
    review: '复习',
    new: '新学',
    weak: '强化',
    test: '测试'
  }[mode] || mode;
}

function updateDesktopShell() {
  const progress = getDisplayProgress();
  const toolbarCategory = $('#toolbar-category');
  if (toolbarCategory) toolbarCategory.textContent = CATEGORY_LABELS[state.category] || state.category;
  const queueCurrent = $('#queue-current');
  const queueTotal = $('#queue-total');
  const queueMode = $('#queue-mode');
  if (queueCurrent) queueCurrent.textContent = String(progress.current);
  if (queueTotal) queueTotal.textContent = String(progress.total);
  if (queueMode) queueMode.textContent = modeLabel(state.mode);
  if (dom.queueNote) {
    dom.queueNote.textContent = state.mode === 'mixed'
      ? `智能混合：先处理 ${state.queueMeta.reviewCount || 0} 个到期复习，再学习 ${state.queueMeta.newCount || 0} 个新词。`
      : '按 Enter 显示答案，使用 1/2/3 完成记忆判断。';
  }
  getSideNavItems().forEach(item => item.classList.remove('active'));
  const active = state.mode === 'test'
    ? $('#nav-stats')
    : $('#nav-today');
  if (active) active.classList.add('active');
}

let sideNavItems = null;
function getSideNavItems() {
  if (!sideNavItems) sideNavItems = $$('.side-nav-item');
  return sideNavItems;
}

function showEmptyState() {
  if (state.mode === 'mixed') {
    dom.wordText.textContent = '今日暂无学习任务';
    dom.wordMeaning.textContent = '没有到期复习词，今日新词计划也已完成。可以切换词库或进入强化/测试。';
  } else if (state.mode === 'review') {
    dom.wordText.textContent = '没有待复习的单词';
    dom.wordMeaning.textContent = '所有单词都按遗忘曲线处于记忆周期中，暂无到期单词。';
  } else if (state.mode === 'new') {
    dom.wordText.textContent = '没有新单词可学';
    dom.wordMeaning.textContent = '该词库中所有单词都已学过，请切换词库或添加自定义单词。';
  }
  dom.wordPhonetic.textContent = '';
  dom.wordExample.textContent = '';
  dom.wordExampleTrans.textContent = '';
  if (dom.wordInsights) dom.wordInsights.innerHTML = '';
  updateRatingPreviews(null);
  dom.wordMeaning.classList.remove('hidden');
  dom.wordExample.classList.add('hidden');
  dom.wordExampleTrans.classList.add('hidden');
  dom.testOptions.classList.add('hidden');
  dom.cardActions.classList.add('hidden');
  dom.confirmActions.classList.add('hidden');
  dom.testActions.classList.add('hidden');
  dom.currentIndex.textContent = '0';
  dom.totalCount.textContent = '0';
  updateStudyPlan(null);
  updateProgress();
  updateDesktopShell();
}

function renderTestQuestion(currentWord) {
  dom.testTypeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.testType === state.testType);
  });

  if (state.testType === 'spelling' || state.testType === 'listening') {
    const prompt = state.testType === 'spelling'
      ? `请根据释义拼写英文：${currentWord.meaning || ''}`
      : '请根据发音输入你听到的英文单词。';
    dom.testQuestion.textContent = prompt;
    dom.testChoices.innerHTML = '';
    dom.testChoices.classList.add('hidden');
    dom.testInputForm.classList.remove('hidden');
    dom.testAnswerInput.value = '';
    dom.testAnswerInput.disabled = false;
    dom.testAnswerInput.classList.remove('correct', 'wrong');
    dom.testAnswerInput.placeholder = state.testType === 'spelling' ? '输入英文单词' : '听音后输入英文';

    state.testState = {
      word: currentWord,
      choices: [],
      selectedIndex: -1,
      answered: false,
      typedAnswer: ''
    };

    if (state.testType === 'listening') {
      setTimeout(() => pronounce(currentWord.word), 120);
    }
    dom.btnNextTest.classList.add('hidden');
    return;
  }

  dom.testQuestion.textContent = `"${currentWord.word}" 的意思是？`;
  dom.testChoices.classList.remove('hidden');
  dom.testInputForm.classList.add('hidden');

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

async function handleTestChoice(index) {
  if (state.testState.answered) return;
  await completeTestAnswer(state.testState.choices[index].correct, index);
}

function normalizeTypedAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function handleTextTestSubmit(event) {
  event.preventDefault();
  if (!state.testState || state.testState.answered) return;
  const answer = normalizeTypedAnswer(dom.testAnswerInput.value);
  if (!answer) {
    showToast('请输入答案', 'warning');
    dom.testAnswerInput.focus();
    return;
  }
  state.testState.typedAnswer = answer;
  await completeTestAnswer(answer === normalizeTypedAnswer(state.testState.word.word), -1);
}

async function completeTestAnswer(isCorrect, selectedIndex) {
  const snapshot = {
    progress: cloneJson(state.progress),
    stats: cloneJson(state.stats),
    settings: cloneJson(state.settings),
    todayStats: { ...state.todayStats },
    testSessionStats: state.testSessionStats ? { ...state.testSessionStats } : null
  };
  state.testState.answered = true;
  state.testState.selectedIndex = selectedIndex;

  const buttons = dom.testChoices.querySelectorAll('.test-choice');
  buttons.forEach((btn, i) => {
    if (i === selectedIndex) btn.classList.add('selected');
    btn.classList.add(state.testState.choices[i].correct ? 'correct' : 'wrong');
    btn.disabled = true;
  });
  if (dom.testAnswerInput) {
    dom.testAnswerInput.disabled = true;
    dom.testAnswerInput.classList.toggle('correct', isCorrect);
    dom.testAnswerInput.classList.toggle('wrong', !isCorrect);
  }
  dom.wordMeaning.classList.remove('hidden');
  if (hasUsableExample(state.testState.word)) {
    dom.wordExample.classList.remove('hidden');
    dom.wordExampleTrans.classList.remove('hidden');
  } else {
    dom.wordExample.classList.add('hidden');
    dom.wordExampleTrans.classList.add('hidden');
  }

  state.todayStats.total++;
  state.todayStats.studied++;
  if (state.testSessionStats) {
    state.testSessionStats.total++;
  }
  if (isCorrect) {
    state.todayStats.correct++;
    if (state.testSessionStats) {
      state.testSessionStats.correct++;
    }
    const key = wordKey(state.testState.word);
    state.progress[key] = SM2.calc(5, state.progress[key]);
    state.progress[key].lastQuality = 5;
  } else {
    // Record error in errorBook (P2)
    if (ebRecordError) {
      state.stats.errorBook = ebRecordError(
        state.testState.word, state.testState.word._cat || state.category, state.stats.errorBook || {}
      );
    }
    const key = wordKey(state.testState.word);
    state.progress[key] = SM2.calc(1, state.progress[key]);
    state.progress[key].lastQuality = 1;
    state.progress[key].lapses = (state.progress[key].lapses || 0) + 1;
  }
  markMetricsDirty();

  updateStreak();
  try {
    await saveLearningState();
  } catch (e) {
    state.progress = snapshot.progress;
    state.stats = snapshot.stats;
    state.settings = snapshot.settings;
    state.todayStats = snapshot.todayStats;
    state.testSessionStats = snapshot.testSessionStats;
    state.testState = null;
    markMetricsDirty();
    renderCard();
    updateStatsDisplay();
    updateProgress();
    showToast(e.message || '保存测试结果失败', 'error');
    return;
  }

  dom.btnNextTest.classList.remove('hidden');

  if (isCorrect) {
    showToast('回答正确', 'success');
  } else {
    const correctText = state.testType === 'choice'
      ? state.testState.choices.find(c => c.correct).meaning
      : state.testState.word.word;
    showToast(`正确答案是：${correctText}`, 'error');
  }

  updateStatsDisplay();
  updateProgress();
}

function updateProgress() {
  const displayProgress = getDisplayProgress();
  if (displayProgress.total === 0) {
    dom.progressFill.style.width = '0%';
    dom.progressFill.style.background = '';
    dom.progressPercent.textContent = '0%';
    return;
  }
  const pct = Math.round((displayProgress.current / displayProgress.total) * 100);
  dom.progressFill.style.width = pct + '%';
  if (state.mode === 'mixed') {
    const reviewCount = state.queueMeta.reviewCount || 0;
    const newCount = state.queueMeta.newCount || 0;
    const segmentTotal = Math.max(1, reviewCount + newCount);
    const reviewPct = Math.round((reviewCount / segmentTotal) * 100);
    dom.progressFill.style.background = `linear-gradient(90deg, var(--accent) 0 ${reviewPct}%, #b7791f ${reviewPct}% 100%)`;
  } else {
    dom.progressFill.style.background = '';
  }
  dom.progressPercent.textContent = pct + '%';
}

function updateStatsDisplay() {
  const metrics = getLearningMetrics();
  dom.statToday.textContent = state.todayStats.studied;
  dom.statAccuracy.textContent = state.todayStats.total > 0
    ? Math.round((state.todayStats.correct / state.todayStats.total) * 100) + '%'
    : '-';
  dom.statStreak.textContent = state.stats.streak + ' 天';
  dom.statMastered.textContent = metrics.mastered;
  const statDue = $('#stat-due');
  if (statDue) statDue.textContent = metrics.dueToday;
}

function countMastered() {
  return getLearningMetrics().mastered;
}

// --- Actions ---
function moveNext() {
  if (state.currentWords.length === 0) return;

  if (state.mode === 'test') {
    if (!state.testState || !state.testState.answered) {
      showToast('请先选择答案', 'warning');
      return;
    }
    moveNextAfterTest();
    return;
  }
  confirmAndNext();
}

function movePrev() {
  if (state.currentWords.length === 0) return;
  if (state.currentIndex > 0) {
    transitionCard('back', () => {
      state.currentIndex--;
      state.testState = null;
      state.wordRated = false;
      renderCard();
    });
  }
}

function pushUndoSnapshot() {
  if (state.currentWords.length === 0) return;
  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  const oldCard = state.progress[key];
  const snapshot = {
    index: state.currentIndex,
    key,
    oldCard: oldCard ? { ...oldCard } : null,
    wasRated: state.wordRated,
    answerRevealed: state.answerRevealed,
    todayStats: { ...state.todayStats },
    stats: cloneJson(state.stats),
    settings: cloneJson(state.settings)
  };
  state.undoStack.push(snapshot);
  if (state.undoStack.length > 10) state.undoStack.shift();
  return snapshot;
}

function restoreRatingSnapshot(snap) {
  if (snap.oldCard) {
    state.progress[snap.key] = snap.oldCard;
  } else {
    delete state.progress[snap.key];
  }
  markMetricsDirty();
  state.currentIndex = snap.index;
  state.wordRated = snap.wasRated;
  state.answerRevealed = snap.answerRevealed;
  state.todayStats = { ...snap.todayStats };
  state.stats = cloneJson(snap.stats);
  state.settings = cloneJson(snap.settings);
  state.testState = null;
  delete state.sessionRatings[snap.key];
}

async function undoRating() {
  if (state.undoStack.length === 0 || state.mode === 'test') {
    showToast('没有可撤销的操作', 'warning');
    return;
  }
  const snap = state.undoStack.pop();
  restoreRatingSnapshot(snap);
  try {
    await saveLearningState();
  } catch (e) {
    await loadData();
    await loadWordList();
    renderCard();
    showToast(e.message || '撤销保存失败', 'error');
    return;
  }
  buildQueue();
  renderCard();
  showToast('已撤销');
}

async function rateWord(quality) {
  if (state.currentWords.length === 0) return;
  if (!state.answerRevealed && state.mode !== 'test') return;
  if (state.wordRated || state.ratingInProgress) return; // Prevent double-rating

  // Save undo snapshot before modifying progress
  const undoSnapshot = pushUndoSnapshot();

  state.ratingInProgress = true;
  state.wordRated = true;

  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  state.progress[key] = SM2.calc(quality, state.progress[key]);
  state.progress[key].lastQuality = quality;
  if (quality < 3) {
    state.progress[key].lapses = (state.progress[key].lapses || 0) + 1;
  }
  recordNewLearningProgress(key);
  markMetricsDirty();

  state.todayStats.studied++;
  state.todayStats.total++;
  if (quality >= 3) {
    state.todayStats.correct++;
    // Record correct in errorBook (P2)
    if (ebRecordCorrect) {
      state.stats.errorBook = ebRecordCorrect(
        state.currentWords[state.currentIndex], state.category, state.stats.errorBook || {}
      );
    }
  }

  updateStreak();
  try {
    await saveLearningState();
  } catch (e) {
    restoreRatingSnapshot(undoSnapshot);
    if (state.undoStack.at(-1) === undoSnapshot) state.undoStack.pop();
    state.ratingInProgress = false;
    renderCard();
    showToast(e.message || '保存学习状态失败', 'error');
    return;
  }

  // Record per-session rating
  state.sessionRatings[key] = quality;
  state.answerRevealed = false;
  state.ratingInProgress = false;
  moveAfterRating();
}

function revealAnswer() {
  if (state.currentWords.length === 0 || state.mode === 'test') return;
  state.answerRevealed = true;
  renderCard();
}

function confirmAndNext() {
  if (state.currentWords.length === 0) return;
  if (!state.answerRevealed && state.mode !== 'test') {
    revealAnswer();
    return;
  }
  if (!state.wordRated) {
    showToast('请先选择认识、模糊或忘记', 'warning');
    return;
  }
  moveAfterRating();
}

function moveAfterRating() {
  transitionCard('forward', () => {
    buildQueue();
    state.currentIndex = 0;
    state.testState = null;
    state.wordRated = false;
    state.answerRevealed = false;
    if (state.currentWords.length > 0) {
      renderCard();
      return;
    }
    showComplete();
  });
}

async function moveNextAfterTest() {
  if (state.currentIndex < state.currentWords.length - 1) {
    transitionCard('forward', () => {
      state.currentIndex++;
      state.testState = null;
      state.wordRated = false;
      state.answerRevealed = false;
      renderCard();
    });
  } else {
    await showComplete();
  }
}

function goBack() {
  if (state.currentWords.length === 0) return;
  if (state.currentIndex > 0) {
    transitionCard('back', () => {
      state.currentIndex--;
      state.testState = null;
      renderCard();
    });
  }
}

async function showComplete() {
  const statsSnapshot = cloneJson(state.stats);
  // Record test history (P2)
  if (state.mode === 'test' && state.testSessionStats &&
      state.testSessionStats.total > 0 && !state.testSessionStats.recorded) {
    const duration = Math.round((Date.now() - state.testStartTime) / 1000);
    state.stats.testHistory = state.stats.testHistory || [];
    state.stats.testHistory.push({
      date: today(),
      category: state.category,
      correct: state.testSessionStats.correct,
      total: state.testSessionStats.total,
      duration: duration
    });
    state.testSessionStats.recorded = true;
    // Keep only last 50 entries
    if (state.stats.testHistory.length > 50) {
      state.stats.testHistory = state.stats.testHistory.slice(-50);
    }
  }

  updateStreak();
  try {
    await saveStats();
  } catch (e) {
    state.stats = statsSnapshot;
    if (state.testSessionStats) state.testSessionStats.recorded = false;
    showToast(e.message || '保存完成记录失败', 'error');
    return;
  }

  const dailyGoal = state.settings.dailyGoal;
  const done = state.todayStats.studied >= dailyGoal;

  // Count remaining due reviews
  const dueRemaining = state.wordList.filter(w => {
    const key = wordKey(w);
    const card = state.progress[key];
    return card && SM2.isDue(card);
  }).length;

  dom.completeTitle.textContent = done ? '今日目标已完成' : '本轮学习完成';
  if (state.mode === 'mixed') {
    dom.completeMessage.textContent = '智能混合阶段已完成。你可以继续新学，或进入强化集中处理薄弱词。';
  } else if (state.mode === 'review') {
    dom.completeMessage.textContent = '复习阶段已完成。你可以继续新学，或进入强化集中处理薄弱词。';
  } else if (state.mode === 'weak') {
    dom.completeMessage.textContent = '强化阶段已完成。可以稍后继续学习，或回到新学阶段。';
  } else if (done) {
    dom.completeMessage.textContent = `你已完成今日目标 ${dailyGoal} 个单词！`;
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

  renderCompleteActions(done, dueRemaining);
  dom.completeOverlay.classList.remove('hidden');
  activateDialog(dom.completeOverlay, $('#btn-complete-close'));

  // Confetti if daily goal met
  if (done) {
    setTimeout(() => launchConfetti(), 300);
  }
}

function setHidden(element, hidden) {
  if (element) element.classList.toggle('hidden', hidden);
}

function renderCompleteActions(done, dueRemaining = 0) {
  const reviewButton = $('#btn-complete-review');
  const newOptions = $('#complete-new-options');
  const weakButton = $('#btn-complete-weak');
  const newCount = $('#complete-new-count');

  setHidden(reviewButton, true);
  setHidden(newOptions, true);
  setHidden(weakButton, true);

  if (state.mode === 'mixed') {
    if (dueRemaining > 0) setHidden(reviewButton, false);
    if (newCount) newCount.value = state.settings.dailyGoal;
    setHidden(newOptions, false);
    setHidden(weakButton, false);
  } else if (state.mode === 'new' && done) {
    setHidden(reviewButton, false);
  } else if (state.mode === 'review') {
    if (newCount) newCount.value = state.settings.dailyGoal;
    setHidden(newOptions, false);
    setHidden(weakButton, false);
  } else if (state.mode === 'weak') {
    if (newCount) newCount.value = state.settings.dailyGoal;
    setHidden(newOptions, false);
  }
}

function closeCompleteOverlay() {
  dom.completeOverlay.classList.add('hidden');
  deactivateDialog(dom.completeOverlay);
  state.sessionRatings = {};
}

async function startModeFromComplete(mode, options = {}) {
  closeCompleteOverlay();
  await switchMode(mode, options);
}

// --- Pronunciation ---
function pronounce(word) {
  const result = speakWord(word, state.settings, {
    onStart: () => dom.btnPronounce.classList.add('playing'),
    onEnd: () => dom.btnPronounce.classList.remove('playing')
  });
  if (!result.success) {
    dom.btnPronounce.classList.remove('playing');
    showToast('您的系统不支持发音功能', 'error');
  }
}

let activeConfirm = null;
const confirmQueue = [];

function askConfirm(message) {
  const overlay = $('#confirm-overlay');
  const messageEl = $('#confirm-message');
  if (!overlay || !messageEl) {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise(resolve => {
    confirmQueue.push({ message, resolve });
    showNextConfirmDialog();
  });
}

function showNextConfirmDialog() {
  if (activeConfirm || confirmQueue.length === 0) return;
  const overlay = $('#confirm-overlay');
  const messageEl = $('#confirm-message');
  if (!overlay || !messageEl) {
    const pending = confirmQueue.shift();
    pending.resolve(window.confirm(pending.message));
    showNextConfirmDialog();
    return;
  }
  activeConfirm = confirmQueue.shift();
  messageEl.textContent = activeConfirm.message;
  overlay.classList.remove('hidden');
  activateDialog(overlay, $('#btn-confirm-ok'));
}

function closeConfirmDialog(accepted = false) {
  const overlay = $('#confirm-overlay');
  if (overlay && activeConfirm) overlay.classList.add('hidden');
  deactivateDialog(overlay);
  if (activeConfirm) {
    const resolve = activeConfirm.resolve;
    activeConfirm = null;
    resolve(Boolean(accepted));
    requestAnimationFrame(showNextConfirmDialog);
  }
}

function openHotkeyEditor() {
  const modifiers = new Set(state.settings.hotkeyModifiers || ['Ctrl', 'Alt']);
  const boxes = {
    Ctrl: $('#hotkey-ctrl'),
    Alt: $('#hotkey-alt'),
    Shift: $('#hotkey-shift'),
    Win: $('#hotkey-win')
  };
  Object.entries(boxes).forEach(([name, input]) => {
    if (input) input.checked = modifiers.has(name);
  });
  const keyInput = $('#hotkey-key');
  if (keyInput) keyInput.value = state.settings.hotkeyKey || 'V';
  const overlay = $('#hotkey-overlay');
  overlay?.classList.remove('hidden');
  activateDialog(overlay, keyInput);
}

function closeHotkeyEditor() {
  const overlay = $('#hotkey-overlay');
  overlay?.classList.add('hidden');
  deactivateDialog(overlay);
}

async function saveHotkeyEditor() {
  const modList = [
    ['Ctrl', $('#hotkey-ctrl')],
    ['Alt', $('#hotkey-alt')],
    ['Shift', $('#hotkey-shift')],
    ['Win', $('#hotkey-win')]
  ].filter(([, input]) => input && input.checked).map(([name]) => name);
  const key = String($('#hotkey-key')?.value || '').trim().toUpperCase();

  if (modList.length === 0) {
    showToast('请至少选择一个修饰键', 'error');
    return;
  }
  if (!/^[A-Z]$/.test(key)) {
    showToast('热键必须是 A-Z 的单个字母', 'error');
    return;
  }

  const result = await api.set_hotkey(modList, key);
  if (result && result.success) {
    state.settings.hotkeyModifiers = modList;
    state.settings.hotkeyKey = key;
    updateHotkeyDisplay();
    closeHotkeyEditor();
    showToast('热键已更新');
    return;
  }
  showToast(result?.message || '热键设置失败', 'error');
}

// --- Mode & Category Switching ---
async function switchMode(mode, options = {}) {
  // Warn if switching away from an in-progress test
  if (state.mode === 'test' && state.testState && !state.testState.answered) {
    if (!(await askConfirm('当前测试未完成，切换模式将丢失进度。确定要切换吗？'))) return;
  }

  state.mode = mode;
  // Record test start time (P2)
  if (mode === 'test') {
    state.testStartTime = Date.now();
    state.testSessionStats = { correct: 0, total: 0, recorded: false };
  } else {
    state.testSessionStats = null;
  }
  state.sessionNewLimit = mode === 'new' && options.newLimit
    ? options.newLimit
    : null;
  state.currentIndex = 0;
  state.wordRated = false;
  state.testState = null;
  state.answerRevealed = false;
  state.sessionRatings = {};

  dom.modeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  // Use error queue directly (P2)
  if (mode === 'weak' && options.errorQueue && Array.isArray(options.errorQueue) && options.errorQueue.length > 0) {
    state.currentWords = options.errorQueue;
    state.currentIndex = 0;
    state.wordRated = false;
    state.testState = null;
    state.answerRevealed = false;
    state.sessionRatings = {};
    renderCard();
    return;
  }

  await loadWordList();
  renderCard();
}

async function switchCategory(category) {
  // Warn if switching away from an in-progress test
  if (state.mode === 'test' && state.testState && !state.testState.answered) {
    if (!(await askConfirm('当前测试未完成，切换词库将丢失进度。确定要切换吗？'))) return;
  }

  const previousCategory = state.category;
  const previousSettings = cloneJson(state.settings);
  state.category = normalizeCategory(category);
  state.settings.category = state.category;
  state.currentIndex = 0;
  state.wordRated = false;
  state.testState = null;
  state.answerRevealed = false;
  state.sessionNewLimit = null;
  state.sessionRatings = {};

  dom.catTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === state.category);
  });

  try {
    await saveSettings();
  } catch (e) {
    state.category = previousCategory;
    state.settings = previousSettings;
    dom.catTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === previousCategory);
    });
    showToast(e.message || '保存词库设置失败', 'error');
    return;
  }
  await loadWordList();
  renderCard();
}

async function updateFontSize(delta) {
  const previousSettings = cloneJson(state.settings);
  state.settings = applyFontDelta
    ? applyFontDelta(state.settings, delta)
    : { ...state.settings, fontSize: Math.max(14, Math.min(28, state.settings.fontSize + delta)) };
  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
  if (dom.fontDisplay) dom.fontDisplay.textContent = state.settings.fontSize + 'px';
  try {
    await saveSettings();
  } catch (e) {
    state.settings = previousSettings;
    document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
    if (dom.fontDisplay) dom.fontDisplay.textContent = state.settings.fontSize + 'px';
    showToast(e.message || '保存字体设置失败', 'error');
  }
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

async function saveFavorites() {
  const result = await api.save_favorites([...state.favorites]);
  return requireSuccessfulSave(result, '保存收藏失败');
}

async function toggleFavorite() {
  if (state.currentWords.length === 0) return;
  const previousFavorites = new Set(state.favorites);
  const word = state.currentWords[state.currentIndex];
  const key = wordKey(word);
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
  } else {
    state.favorites.add(key);
  }
  try {
    await saveFavorites();
    updateFavoriteIcon();
  } catch (e) {
    state.favorites = previousFavorites;
    updateFavoriteIcon();
    showToast(e.message || '保存收藏失败', 'error');
  }
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
    const assistantNext = $('#assistant-next-review');
    const assistantInterval = $('#assistant-interval');
    if (assistantNext) assistantNext.textContent = '无任务';
    if (assistantInterval) assistantInterval.textContent = '-';
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
    const assistantNext = $('#assistant-next-review');
    const assistantInterval = $('#assistant-interval');
    if (assistantNext) assistantNext.textContent = card.nextReview || '今天';
    if (assistantInterval) assistantInterval.textContent = card.interval + ' 天';
  } else {
    $('#detail-interval').textContent = '未学习';
    $('#detail-next-review').textContent = '待学习';
    $('#detail-repetitions').textContent = '0 次';
    $('#detail-ef').textContent = '2.5';
    const assistantNext = $('#assistant-next-review');
    const assistantInterval = $('#assistant-interval');
    if (assistantNext) assistantNext.textContent = '待学习';
    if (assistantInterval) assistantInterval.textContent = '新词';
  }
}

function toggleDetailPanel() {
  const panel = $('#word-detail-panel');
  if (panel) panel.classList.toggle('show');
}

// --- Dark Mode ---
function setThemeButtonLabel(isDark) {
  const btn = $('#btn-theme');
  if (btn) btn.textContent = isDark ? '浅色模式' : '深色模式';
}

function initTheme() {
  const saved = state.settings.darkMode;
  if (saved) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  setThemeButtonLabel(Boolean(saved));
}

async function toggleTheme() {
  const previousDarkMode = Boolean(state.settings.darkMode);
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? null : 'dark';
  if (next) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  state.settings.darkMode = next === 'dark';
  setThemeButtonLabel(state.settings.darkMode);
  try {
    await saveSettings();
  } catch (e) {
    state.settings.darkMode = previousDarkMode;
    if (previousDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    setThemeButtonLabel(previousDarkMode);
    showToast(e.message || '保存主题设置失败', 'error');
  }
}

// --- Search ---
function initSearch() {
  const input = $('#word-search');
  const clearBtn = $('#btn-search-clear');
  const results = $('#search-results');
  const debouncedFilterWords = debounce((value) => filterWords(value.toLowerCase()), 200);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.classList.toggle('hidden', !val);
    if (!val) { results.classList.remove('show'); return; }
    debouncedFilterWords(val);
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

function focusSearch() {
  const input = $('#word-search');
  if (!input) return;
  input.focus();
  input.select();
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
let memoryCurveDays = 7;

function isDarkThemeActive() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function renderMemoryCurvePanel() {
  if (!renderMemoryCurve) return;
  renderMemoryCurve($('#chart-memory-curve'), state.progress, {
    days: memoryCurveDays,
    darkMode: isDarkThemeActive()
  });
}

function setMemoryCurveDays(days) {
  memoryCurveDays = Math.max(7, Math.min(30, Number(days) || 7));
  document.querySelectorAll('.memory-range-btn').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.memoryDays) === memoryCurveDays);
  });
  renderMemoryCurvePanel();
}

function openStats() {
  const overlay = $('#stats-overlay');
  if (!overlay) return;

  if (_statsRenderTimer) {
    clearTimeout(_statsRenderTimer);
    _statsRenderTimer = null;
  }

  if (renderStatsSummary) {
    renderStatsSummary(document, state.stats, countMastered());
  } else if (calculateStatsSummary) {
    const summary = calculateStatsSummary(state.stats, countMastered());
    $('#stats-total-studied').textContent = summary.totalStudied;
    $('#stats-accuracy-avg').textContent = summary.accuracyText;
    $('#stats-streak-max').textContent = summary.streak;
    $('#stats-mastered-total').textContent = summary.mastered;
  }

  if (buildWeeklyReport && renderWeeklyReport) {
    renderWeeklyReport(document, $('#weekly-report'), buildWeeklyReport(state.stats, state.settings));
  }
  renderLocalAchievements();
  renderReviewForecast();
  overlay.classList.remove('hidden');
  activateDialog(overlay, $('#btn-stats-close'));
  _statsRenderTimer = setTimeout(() => {
    _statsRenderTimer = null;
    renderHeatmapCanvas($('#chart-heatmap'), state.stats.daily || {}, localDateKey);
    renderAccuracyChartCanvas($('#chart-accuracy'), state.stats.daily || {});
    renderMemoryCurvePanel();
  }, 100);

  // Category progress dashboard (P2)
  if (renderCategoryProgress && !state.allWordsCache) {
    api.get_all_words().then(data => {
      state.allWordsCache = data;
      renderCategoryProgress(document, $('#category-progress'), data, state.progress);
      renderLocalAchievements();
    }).catch(() => {});
  } else if (renderCategoryProgress && state.allWordsCache) {
    renderCategoryProgress(document, $('#category-progress'), state.allWordsCache, state.progress);
  }

  // Test history (P2)
  if (renderTestHistory) {
    renderTestHistory(document, $('#test-history-section'), state.stats.testHistory);
  }
}

function renderLocalAchievements() {
  if (!buildAchievements || !renderAchievements) return;
  const favorites = [...(state.favorites || new Set())];
  renderAchievements(
    document,
    $('#achievement-list'),
    buildAchievements(state.stats, state.progress, favorites, state.allWordsCache || {})
  );
}

function normalizeCategory(category) {
  if (normalizeSettingsCategory) return normalizeSettingsCategory(category);
  return VALID_CATEGORIES.includes(category) ? category : 'cet4';
}

function closeStats() {
  if (_statsRenderTimer) {
    clearTimeout(_statsRenderTimer);
    _statsRenderTimer = null;
  }
  const overlay = $('#stats-overlay');
  overlay.classList.add('hidden');
  deactivateDialog(overlay);
}

async function ensureAllWordsCache() {
  if (state.allWordsCache) return state.allWordsCache;
  try {
    const data = await api.get_all_words();
    state.allWordsCache = data && typeof data === 'object'
      ? data
      : { [state.category]: state.wordList };
  } catch (e) {
    state.allWordsCache = { [state.category]: state.wordList };
  }
  return state.allWordsCache;
}

function summarizeWordbook(category, words) {
  const total = words.length;
  let learned = 0;
  let due = 0;
  let mastered = 0;

  words.forEach(word => {
    const card = state.progress[wordKeyForCategory(word, category)];
    if (!card || !card.repetitions) return;
    learned++;
    if (SM2.isDue(card)) due++;
    if ((card.interval || 0) >= 21 && (card.repetitions || 0) >= 3) mastered++;
  });

  return {
    category,
    total,
    learned,
    due,
    mastered,
    progress: total ? Math.round((learned / total) * 100) : 0
  };
}

function renderWordbookPage() {
  const summaryEl = $('#wordbook-summary');
  const gridEl = $('#wordbook-grid');
  if (!summaryEl || !gridEl) return;

  const allWords = state.allWordsCache || {};
  const summaries = VALID_CATEGORIES.map(category =>
    summarizeWordbook(category, allWords[category] || [])
  );
  const totalWords = summaries.reduce((sum, item) => sum + item.total, 0);
  const totalLearned = summaries.reduce((sum, item) => sum + item.learned, 0);
  const totalDue = summaries.reduce((sum, item) => sum + item.due, 0);

  summaryEl.innerHTML = `
    <div class="wordbook-summary-item">
      <strong>${totalWords}</strong>
      <span>总词量</span>
    </div>
    <div class="wordbook-summary-item">
      <strong>${totalLearned}</strong>
      <span>已学习</span>
    </div>
    <div class="wordbook-summary-item">
      <strong>${totalDue}</strong>
      <span>待复习</span>
    </div>
  `;

  gridEl.innerHTML = summaries.map(item => `
    <article class="wordbook-card ${item.category === state.category ? 'active' : ''}" data-category="${item.category}">
      <div class="wordbook-card-head">
        <h3>${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</h3>
        <span>${item.progress}%</span>
      </div>
      <div class="wordbook-progress">
        <div class="wordbook-progress-fill" style="width:${item.progress}%"></div>
      </div>
      <div class="wordbook-stats">
        <span><strong>${item.total}</strong> 词</span>
        <span><strong>${item.learned}</strong> 已学</span>
        <span><strong>${item.due}</strong> 待复习</span>
        <span><strong>${item.mastered}</strong> 掌握</span>
      </div>
      <button class="btn-secondary wordbook-select" data-category="${item.category}" ${item.category === state.category ? 'disabled' : ''}>
        ${item.category === state.category ? '当前词库' : '切换'}
      </button>
    </article>
  `).join('');

  gridEl.querySelectorAll('.wordbook-select').forEach(button => {
    button.addEventListener('click', () => selectWordbook(button.dataset.category));
  });
}

async function openWordbooks() {
  closeSettings();
  await ensureAllWordsCache();
  renderWordbookPage();
  const overlay = $('#wordbook-overlay');
  overlay?.classList.remove('hidden');
  activateDialog(overlay, $('#btn-wordbook-close'));
}

function closeWordbooks() {
  const overlay = $('#wordbook-overlay');
  overlay?.classList.add('hidden');
  deactivateDialog(overlay);
}

async function selectWordbook(category) {
  const nextCategory = normalizeCategory(category);
  closeWordbooks();
  if (nextCategory !== state.category) {
    await switchCategory(nextCategory);
  }
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
  const colors = ['#2d3561', '#b8860b', '#4a7c59', '#c4783c', '#8090cc', '#8b6508', '#e8ddca'];

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
  const overlay = $('#about-overlay');
  overlay.classList.remove('hidden');
  activateDialog(overlay, $('#btn-about-close'));
}
function closeAbout() {
  const overlay = $('#about-overlay');
  overlay.classList.add('hidden');
  deactivateDialog(overlay);
}

// --- Error Book ---
async function openErrorBook() {
  closeSettings();
  await ensureAllWordsCache();
  // Get all words from all categories for lookup
  const allWords = [];
  for (const cat of VALID_CATEGORIES) {
    const words = state.allWordsCache ? state.allWordsCache[cat] || [] : [];
    for (const w of words) allWords.push({...w, _cat: cat});
  }
  const errorWords = ebGetErrorWords ? ebGetErrorWords(state.stats.errorBook || {}, allWords) : [];
  ebRenderErrorBookList(document, $('#error-book-list'), errorWords);
  const overlay = $('#error-book-overlay');
  overlay.classList.remove('hidden');
  activateDialog(overlay, $('#btn-error-close'));
}

function closeErrorBook() {
  const overlay = $('#error-book-overlay');
  overlay?.classList.add('hidden');
  deactivateDialog(overlay);
}

async function reviewErrorWords() {
  if (!ebGetErrorWords) return;
  const allWords = [];
  for (const cat of VALID_CATEGORIES) {
    const words = state.allWordsCache ? state.allWordsCache[cat] || [] : [];
    for (const w of words) allWords.push({...w, _cat: cat});
  }
  const errorWords = ebGetErrorWords(state.stats.errorBook || {}, allWords);
  if (errorWords.length === 0) { showToast('没有错题可复习', 'warning'); return; }
  const queue = ebBuildErrorReviewQueue(errorWords);
  closeErrorBook();
  await switchMode('weak', { errorQueue: queue });
}

async function clearErrorBook() {
  if (!(await askConfirm('确定清空所有错题记录吗？此操作不可恢复。'))) return;
  const previousErrorBook = cloneJson(state.stats.errorBook || {});
  state.stats.errorBook = {};
  try {
    await saveStats();
  } catch (e) {
    state.stats.errorBook = previousErrorBook;
    showToast(e.message || '清空错题本失败', 'error');
    return;
  }
  openErrorBook();
  showToast('错题本已清空');
}

// --- Onboarding ---
function checkOnboarding() {
  const completed = localStorage.getItem('vocabmaster_onboarding_v1');
  if (!completed) {
    showOnboarding();
  }
}

function showOnboarding() {
  const steps = [
    {
      title: '认识评级按钮',
      desc: '看到单词后先回忆释义，然后点击对应按钮：<br><strong>认识</strong> = 完全掌握 · <strong>模糊</strong> = 有点印象 · <strong>忘记</strong> = 没想起来'
    },
    {
      title: '发音和切换单词',
      desc: '点击单词卡片或发音按钮朗读（也可按<strong>空格键</strong>）<br>评级后按 <strong>Enter</strong> 进入下一个单词'
    },
    {
      title: '切换词库和模式',
      desc: '顶部标签栏可以<strong>点击切换词库</strong>（CET-4/6/考研/雅思/托福）<br>和<strong>学习模式</strong>（复习/新学/强化/测试）'
    },
    {
      title: '开始学习吧！',
      desc: '每天坚持学习，SM-2 算法会自动安排复习计划<br>快捷键：<strong>1/2/3</strong> 评级 | <strong>空格</strong> 发音 | <strong>Esc</strong> 关闭弹窗'
    }
  ];

  let currentStep = 0;
  const overlay = $('#onboarding-overlay');
  const title = $('#onboarding-title');
  const desc = $('#onboarding-desc');
  const prevBtn = $('#btn-onboarding-prev');
  const nextBtn = $('#btn-onboarding-next');
  const skipBtn = $('#btn-onboarding-skip');
  const stepLabel = $('#onboarding-step-label');
  const dots = $$('.onboarding-dot');

  function renderStep() {
    const s = steps[currentStep];
    title.textContent = s.title;
    desc.innerHTML = s.desc;
    stepLabel.textContent = `步骤 ${currentStep + 1}/${steps.length}`;

    dots.forEach(d => d.classList.toggle('active', parseInt(d.dataset.step) === currentStep));

    prevBtn.classList.toggle('hidden', currentStep === 0);
    if (currentStep === steps.length - 1) {
      nextBtn.textContent = '开始学习';
      skipBtn.classList.add('hidden');
    } else {
      nextBtn.textContent = '下一步';
      skipBtn.classList.remove('hidden');
    }
  }

  function finish() {
    overlay.classList.add('hidden');
    deactivateDialog(overlay);
    localStorage.setItem('vocabmaster_onboarding_v1', '1');
  }

  prevBtn.addEventListener('click', () => {
    if (currentStep > 0) { currentStep--; renderStep(); }
  });
  nextBtn.addEventListener('click', () => {
    if (currentStep < steps.length - 1) { currentStep++; renderStep(); }
    else finish();
  });
  skipBtn.addEventListener('click', finish);

  overlay.classList.remove('hidden');
  renderStep();
  activateDialog(overlay, nextBtn);
}

// --- Event Handlers ---
function init() {
  warmupSpeech();

  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
  document.addEventListener('keydown', trapDialogFocus);

  // Sync category tabs with initial state
  dom.catTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === state.category);
  });
  // Sync mode tabs with initial state
  dom.modeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });

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
  dom.btnRemember.addEventListener('click', () => rateWord(5));
  dom.btnEasy.addEventListener('click', () => rateWord(3));

  // Test next
  dom.btnNextTest.addEventListener('click', moveNext);
  dom.testTypeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.testType = tab.dataset.testType || 'choice';
      state.testState = null;
      renderCard();
      if (state.testType !== 'choice') {
        dom.testAnswerInput?.focus();
      }
    });
  });
  dom.testInputForm?.addEventListener('submit', handleTextTestSubmit);

  // Complete overlay
  $('#btn-complete-close').addEventListener('click', () => {
    closeCompleteOverlay();
    buildQueue();
    renderCard();
  });
  $('#btn-complete-review')?.addEventListener('click', () => startModeFromComplete('review'));
  $('#btn-complete-new')?.addEventListener('click', () => {
    const input = $('#complete-new-count');
    const parsed = parseInt(input ? input.value : state.settings.dailyGoal, 10);
    const newLimit = Math.max(1, Math.min(200, Number.isFinite(parsed) ? parsed : state.settings.dailyGoal));
    startModeFromComplete('new', { newLimit });
  });
  $('#btn-complete-weak')?.addEventListener('click', () => startModeFromComplete('weak'));

  // Settings
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-wordbooks')?.addEventListener('click', openWordbooks);
  $('#btn-wordbook-close')?.addEventListener('click', closeWordbooks);
  $('#nav-today')?.addEventListener('click', () => switchMode(state.mode === 'test' ? 'new' : state.mode));
  $('#nav-wordbooks')?.addEventListener('click', openWordbooks);
  $('#nav-plan')?.addEventListener('click', () => {
    $('#study-plan-panel')?.scrollIntoView({ block: 'center' });
    $('#study-plan-panel')?.classList.add('panel-attention');
    setTimeout(() => $('#study-plan-panel')?.classList.remove('panel-attention'), 700);
  });
  $('#nav-search')?.addEventListener('click', focusSearch);
  $('#nav-stats')?.addEventListener('click', openStats);
  $('#nav-settings')?.addEventListener('click', openSettings);
  $('#btn-settings-cancel').addEventListener('click', closeSettings);
  $('#btn-settings-save').addEventListener('click', saveSettingsHandler);
  $('#btn-settings-about')?.addEventListener('click', () => { closeSettings(); openAbout(); });
  $('#btn-settings-about-inline')?.addEventListener('click', () => { closeSettings(); openAbout(); });
  initSettingsNavigation();
  $('#btn-font-dec').addEventListener('click', () => updateFontSize(-1));
  $('#btn-font-inc').addEventListener('click', () => updateFontSize(1));

  // Hotkey display and edit (P3)
  updateHotkeyDisplay();

  $('#btn-hotkey-edit')?.addEventListener('click', openHotkeyEditor);
  $('#btn-hotkey-cancel')?.addEventListener('click', closeHotkeyEditor);
  $('#btn-hotkey-save')?.addEventListener('click', saveHotkeyEditor);
  $('#hotkey-key')?.addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
  });
  $('#btn-confirm-cancel')?.addEventListener('click', () => closeConfirmDialog(false));
  $('#btn-confirm-ok')?.addEventListener('click', () => closeConfirmDialog(true));

  // Reminder UI and interaction (P3)
  updateReminderUI();

  $('#btn-reminder-toggle')?.addEventListener('click', async () => {
    const enabled = !state.settings.reminderEnabled;
    const time = $('#reminder-time')?.value || '20:00';
    const result = await api.set_reminder(enabled, time);
    if (!result || !result.success) {
      showToast(result?.message || '提醒设置保存失败', 'error');
      return;
    }
    state.settings.reminderEnabled = enabled;
    state.settings.reminderTime = time;
    updateReminderUI();
    showToast(enabled ? '每日学习提醒已开启' : '每日学习提醒已关闭');
  });

  $('#reminder-time')?.addEventListener('change', async () => {
    const time = $('#reminder-time').value;
    if (state.settings.reminderEnabled) {
      const result = await api.set_reminder(true, time);
      if (!result || !result.success) {
        $('#reminder-time').value = state.settings.reminderTime || '20:00';
        showToast(result?.message || '提醒设置保存失败', 'error');
        return;
      }
      state.settings.reminderTime = time;
      showToast('提醒时间已更新');
    }
  });

  bindBackupActions(document, {
    doc: document,
    api,
    state,
    showToast,
    loadData,
    loadFavorites,
    loadWordList,
    invalidateWordCache,
    renderCard,
    confirm: askConfirm
  });

  // Add word modal buttons
  bindCustomWordForm(document, {
    api,
    state,
    showToast,
    loadWordList,
    invalidateWordCache,
    renderCard,
    openOverlay: openAddWordDialog,
    closeOverlay: closeAddWordDialog
  });

  // Theme toggle
  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#btn-test-mode')?.addEventListener('click', async () => {
    closeSettings();
    await switchMode('test');
  });

  // Search
  initSearch();
  $('#btn-search-toggle').addEventListener('click', () => {
    focusSearch();
  });

  // Stats
  $('#btn-stats').addEventListener('click', openStats);
  $('#btn-stats-close')?.addEventListener('click', closeStats);
  document.querySelectorAll('.memory-range-btn').forEach(button => {
    button.addEventListener('click', () => setMemoryCurveDays(button.dataset.memoryDays));
  });

  // About
  $('#btn-about')?.addEventListener('click', openAbout);
  $('#btn-about-close')?.addEventListener('click', closeAbout);

  // Error book (P2)
  $('#btn-error-book')?.addEventListener('click', openErrorBook);
  $('#btn-error-close')?.addEventListener('click', closeErrorBook);
  $('#btn-error-review')?.addEventListener('click', reviewErrorWords);
  $('#btn-error-clear')?.addEventListener('click', clearErrorBook);

  // Favorites
  $('#btn-favorite')?.addEventListener('click', toggleFavorite);

  // Word detail toggle — click on progress area toggles detail panel
  $('#card-progress')?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    toggleDetailPanel();
  });
  $('#btn-detail-toggle')?.addEventListener('click', toggleDetailPanel);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      focusSearch();
    }
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && state.currentWords.length > 0) {
      const tagName = e.target && e.target.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleFavorite();
      }
    }
  });

  // Close overlays on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      closeAddWordDialog();
      closeStats();
      closeAbout();
      closeHotkeyEditor();
      closeConfirmDialog(false);
      closeWordbooks();
      closeErrorBook();
      closeCompleteOverlay();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', createShortcutHandler(
    () => ({
      mode: state.mode,
      wordRated: state.wordRated,
      hasCurrentWord: state.currentWords.length > 0
    }),
    {
      'go-back': goBack,
      'confirm-next': confirmAndNext,
      'rate-forgot': () => rateWord(1),
      'rate-remember': () => rateWord(5),
      'rate-easy': () => rateWord(3),
      pronounce: () => pronounce(state.currentWords[state.currentIndex].word),
      'mode-review': () => switchMode('review'),
      'mode-new': () => switchMode('new'),
      'mode-test': () => switchMode('test'),
      'mode-weak': () => switchMode('weak'),
      'open-add-word': openAddWordDialog
    }
  ));

  // Ctrl+Z undo rating (independent of createShortcutHandler)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.mode !== 'test') {
      e.preventDefault();
      undoRating();
    }
  });
}

// --- Settings ---
function updateHotkeyDisplay() {
  const modifiers = state.settings.hotkeyModifiers || ['Ctrl', 'Alt'];
  const key = state.settings.hotkeyKey || 'V';
  const display = $('#hotkey-display');
  if (display) display.textContent = modifiers.join('+') + '+' + key;
}

function updateReminderUI() {
  const enabled = Boolean(state.settings.reminderEnabled);
  const button = $('#btn-reminder-toggle');
  if (button) {
    button.textContent = enabled ? '已开启' : '关闭';
    button.style.background = enabled ? 'var(--success)' : '';
    button.style.color = enabled ? '#fff' : '';
  }
  const timeInput = $('#reminder-time');
  if (timeInput) timeInput.value = state.settings.reminderTime || '20:00';
}

function switchSettingsSection(sectionName) {
  const target = sectionName || 'learning';
  document.querySelectorAll('.settings-nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.settingsTarget === target);
  });
  document.querySelectorAll('[data-settings-section]').forEach(section => {
    section.classList.toggle('is-hidden', section.dataset.settingsSection !== target);
  });
}

function initSettingsNavigation() {
  document.querySelectorAll('.settings-nav-item').forEach(button => {
    button.addEventListener('click', () => switchSettingsSection(button.dataset.settingsTarget));
  });
}

async function syncStartupStatus() {
  try {
    const status = await api.get_startup_status();
    const input = $('#setting-startup-enabled');
    if (!status || status.available === false) {
      state.settings.startupEnabled = false;
      if (input) {
        input.checked = false;
        input.disabled = true;
        input.title = '开机自启仅支持 Windows 当前用户环境';
      }
      return;
    }
    state.settings.startupEnabled = Boolean(status.enabled);
    if (input) {
      input.checked = state.settings.startupEnabled;
      input.disabled = false;
      input.title = '';
    }
  } catch (e) {
    const input = $('#setting-startup-enabled');
    if (input) input.checked = Boolean(state.settings.startupEnabled);
  }
}

async function openSettings() {
  openSettingsModal(document, state.settings);
  activateDialog(dom.settingsOverlay, $('#btn-settings-save'));
  switchSettingsSection('learning');
  updateHotkeyDisplay();
  updateReminderUI();
  await syncStartupStatus();
}

function closeSettings() {
  closeSettingsModal(document);
  deactivateDialog(dom.settingsOverlay);
}

async function saveSettingsHandler() {
  const previousCategory = state.category;
  const previousSettings = cloneJson(state.settings);
  state.settings = readSettingsForm(document, state.settings);
  state.settings.category = normalizeCategory(state.settings.category);
  state.category = state.settings.category;
  const startupInput = $('#setting-startup-enabled');
  const shouldUpdateStartup = startupInput && !startupInput.disabled;
  const startupChanged = shouldUpdateStartup &&
    Boolean(previousSettings.startupEnabled) !== Boolean(state.settings.startupEnabled);
  if (state.category !== previousCategory) {
    state.currentIndex = 0;
    state.wordRated = false;
    state.testState = null;
    state.answerRevealed = false;
    state.sessionNewLimit = null;
    state.sessionRatings = {};
  }
  try {
    if (shouldUpdateStartup) {
      const startupResult = await api.set_startup(Boolean(state.settings.startupEnabled));
      if (!startupResult || startupResult.success !== true) {
        throw new Error(startupResult?.message || '开机自启设置失败');
      }
      state.settings.startupEnabled = Boolean(startupResult.enabled);
    }
    await saveSettings();
  } catch (e) {
    if (startupChanged) {
      try {
        await api.set_startup(Boolean(previousSettings.startupEnabled));
      } catch (_) {
        // Best-effort rollback; keep the visible error focused on the original failure.
      }
    }
    state.settings = previousSettings;
    state.category = previousCategory;
    dom.catTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === previousCategory);
    });
    showToast(e.message || '保存设置失败', 'error');
    return;
  }
  closeSettingsModal(document);
  deactivateDialog(dom.settingsOverlay);
  showToast('设置已保存', 'success');
  await loadWordList();
  renderCard();
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
    addBtn.textContent = '+';
    headerRight.insertBefore(addBtn, $('#btn-settings'));
  }

  init();
  initTheme();

  await loadWordList();
  renderCard();
  checkOnboarding();
}

// Wait for pywebview API to be ready. In real WebView2, the bridge can be
// injected after this script has loaded; starting too early falls back to an
// empty browser-only API.
let bootstrapStarted = false;

function startBootstrap() {
  if (bootstrapStarted) return;
  bootstrapStarted = true;
  bootstrap().catch(err => {
    console.error('Failed to bootstrap:', err);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:18px;color:#b5443c;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,sans-serif;">启动失败: ${escapeHtml(err.message)}</div>`;
  });
}

if (window.pywebview && window.pywebview.api) {
  startBootstrap();
} else {
  window.addEventListener('pywebviewready', startBootstrap, { once: true });
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (!window.pywebview || !window.pywebview.api) {
        startBootstrap();
      }
    }, 2000);
  });
}
