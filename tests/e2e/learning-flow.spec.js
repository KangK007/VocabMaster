const { test, expect } = require('@playwright/test');
const path = require('path');

const words = [
  {
    word: 'abandon',
    phonetic: '/əˈbændən/',
    meaning: 'v. 放弃；抛弃',
    example: 'The crew abandoned the sinking ship.',
    exampleTranslation: '船员们放弃了正在下沉的船。'
  },
  {
    word: 'ability',
    phonetic: '/əˈbɪləti/',
    meaning: 'n. 能力；才能',
    example: 'She has the ability to learn quickly.',
    exampleTranslation: '她有快速学习的能力。'
  },
  {
    word: 'adapt',
    phonetic: '/əˈdæpt/',
    meaning: 'v. 适应；改编',
    example: 'She adapted quickly.',
    exampleTranslation: '她很快适应了。'
  },
  {
    word: 'balance',
    phonetic: '/ˈbæləns/',
    meaning: 'n. 平衡',
    example: 'She kept her balance.',
    exampleTranslation: '她保持了平衡。'
  }
];

const cet6Words = [
  {
    word: 'binary',
    phonetic: '/ˈbaɪnəri/',
    meaning: 'adj. 二元的',
    example: 'The system uses binary numbers.',
    exampleTranslation: '该系统使用二进制数字。'
  },
  {
    word: 'capacity',
    phonetic: '/kəˈpæsəti/',
    meaning: 'n. 容量；能力',
    example: 'The battery has a large capacity.',
    exampleTranslation: '这块电池容量很大。'
  },
  {
    word: 'derive',
    phonetic: '/dɪˈraɪv/',
    meaning: 'v. 获得；源自',
    example: 'The word derives from Latin.',
    exampleTranslation: '这个词源自拉丁语。'
  }
];

async function openApp(page, options = {}) {
  await page.addInitScript(({ words, cet6Words, options }) => {
    const clone = value => JSON.parse(JSON.stringify(value));
    if (!options.keepLocalStorage) {
      localStorage.clear();
    }
    if (!options.showOnboarding) {
      localStorage.setItem('vocabmaster_onboarding_v1', '1');
    }
    if (options.clientCache) {
      localStorage.setItem('vocabmaster.clientState.v1', JSON.stringify(options.clientCache));
    }
    const store = {
      wordsByCategory: {
        cet4: [...(options.words || words)],
        cet6: [...cet6Words]
      },
      progress: options.progress || {},
      stats: options.stats || { daily: { '2026-07-01': { studied: 4, correct: 3, total: 4 } }, streak: 1, lastStudyDate: '2026-07-01' },
      settings: { fontSize: 18, dailyGoal: 2, darkMode: false, category: 'cet4', closeToTray: true, startupEnabled: false, ...(options.settings || {}) },
      favorites: options.favorites || [],
      backups: [{ id: 'backup-one.json', modified: '2026-07-07T10:00:00', size: 2048 }],
      resetCount: 0
    };
    window.__vmStore = store;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) {
        store.lastUtterance = {
          text: utterance.text,
          lang: utterance.lang,
          rate: utterance.rate,
          voice: utterance.voice ? utterance.voice.name : ''
        };
        if (typeof utterance.onend === 'function') utterance.onend();
      },
      cancel() {},
      getVoices() {
        return [
          { name: 'Microsoft Zira', lang: 'en-US', localService: true },
          { name: 'Microsoft Sonia', lang: 'en-GB', localService: true }
        ];
      }
    } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: function SpeechSynthesisUtterance(text) { this.text = text; }
    });
    const pywebviewBridge = {
      api: {
        get_word_list: async (category) => store.wordsByCategory[category] || [],
        get_all_words: async () => clone(store.wordsByCategory),
        get_progress: async () => clone(store.progress),
        save_progress: async (progress) => {
          if (options.delayProgressSave) {
            await new Promise(resolve => { window.__resolveProgressSave = resolve; });
          }
          store.progress = clone(progress);
          return true;
        },
        save_learning_state: async (progress, stats, settings) => {
          if (options.delayProgressSave) {
            await new Promise(resolve => { window.__resolveProgressSave = resolve; });
          }
          if (options.failLearningSave) {
            return { success: false, message: 'simulated learning save failure' };
          }
          store.progress = clone(progress);
          store.stats = clone(stats);
          store.settings = clone(settings);
          return { success: true };
        },
        get_stats: async () => clone(store.stats),
        save_stats: async (stats) => { store.stats = clone(stats); return true; },
        get_settings: async () => clone(store.settings),
        save_settings: async (settings) => {
          if (options.delaySettingsSave) {
            await new Promise(resolve => { window.__resolveSettingsSave = resolve; });
          }
          if (options.failSettingsSave) return false;
          store.settings = clone(settings);
          return true;
        },
        set_reminder: async (enabled, time) => {
          if (options.failReminderSave) return { success: false, message: 'simulated reminder failure' };
          store.settings.reminderEnabled = enabled;
          store.settings.reminderTime = time;
          return { success: true };
        },
        set_hotkey: async (modifiers, key) => {
          store.settings.hotkeyModifiers = modifiers;
          store.settings.hotkeyKey = key;
          return { success: true };
        },
        get_startup_status: async () => ({ available: true, enabled: Boolean(store.settings.startupEnabled) }),
        set_startup: async (enabled) => {
          if (options.failStartupSave) return { success: false, message: 'simulated startup failure' };
          store.settings.startupEnabled = Boolean(enabled);
          return { success: true, available: true, enabled: store.settings.startupEnabled };
        },
        get_favorites: async () => store.favorites,
        save_favorites: async (favorites) => {
          if (options.failFavoritesSave) return false;
          store.favorites = favorites;
          return true;
        },
        import_words: async () => options.importResult || ({ success: false, message: 'not used in e2e' }),
        export_data: async () => {
          store.exportedProfile = {
            exportVersion: 2,
            progress: clone(store.progress),
            statistics: clone(store.stats),
            settings: clone(store.settings),
            favorites: clone(store.favorites),
            customWords: clone(store.wordsByCategory)
          };
          return { success: true, message: 'export ok' };
        },
        restore_data: async () => { store.progress = { restored_cet4: { interval: 1, repetitions: 1, ef: 2.5, nextReview: '2026-07-08' } }; store.stats = { daily: {}, streak: 0, lastStudyDate: null }; return { success: true, message: '????' }; },
        reset_progress: async () => { store.resetCount += 1; store.progress = {}; store.stats = { daily: {}, streak: 0, lastStudyDate: null }; return { success: true }; },
        add_custom_word: async (category, word) => {
          store.wordsByCategory[category] = [...(store.wordsByCategory[category] || []), word];
          return { success: true, message: 'added' };
        },
        list_backups: async () => store.backups,
        restore_backup: async () => { store.progress = { backup_cet4: { interval: 4 } }; return { success: true, message: 'backup restored' }; },
        delete_backup: async (id) => { store.backups = store.backups.filter(backup => backup.id !== id); return { success: true, message: 'backup deleted' }; }
      }
    };
    if (options.delayedPywebview) {
      setTimeout(() => {
        window.pywebview = pywebviewBridge;
        window.dispatchEvent(new CustomEvent('pywebviewready'));
      }, 100);
    } else {
      window.pywebview = pywebviewBridge;
    }
  }, { words, cet6Words, options });

  await page.goto(`file://${path.resolve('src/index.html')}`);
  const expectedCategory = options.expectedCategory || (options.settings && options.settings.category);
  const expectedList = expectedCategory === 'cet6' ? cet6Words : (options.words || words);
  const expectedWords = new RegExp(
    expectedList.map(item => item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  );
  await expect(page.locator('#word-text')).toHaveText(expectedWords, { timeout: 5000 });
}

async function expectViewportContained(page, viewport) {
  await expect.poll(() => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }))).toEqual({
    scrollWidth: viewport.width,
    scrollHeight: viewport.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height
  });
}

async function revealAndRate(page, buttonId = '#btn-remember') {
  await page.locator('#btn-confirm').click();
  await page.locator(buttonId).click();
}

async function acceptAppConfirm(page) {
  await expect(page.locator('#confirm-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#btn-confirm-ok').click();
}

async function openSettingsSection(page, section) {
  await page.locator('#btn-settings').click();
  await page.locator(`.settings-nav-item[data-settings-target="${section}"]`).click();
}

async function canvasHasPaint(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  });
}

test('loads the study screen, reveals meaning, then rates the word', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('.mode-tab[data-mode="mixed"]')).toHaveClass(/active/);
  await expect(page.locator('#queue-mode')).toHaveText('混合');
  await expect(page.locator('#word-meaning')).toHaveClass(/hidden/);
  await expect(page.locator('#card-actions')).toHaveClass(/hidden/);
  await expect(page.locator('#btn-confirm')).toHaveText('确定');
  await page.locator('#btn-confirm').click();
  await expect(page.locator('#word-meaning')).not.toHaveClass(/hidden/);
  await expect(page.locator('#card-actions')).not.toHaveClass(/hidden/);
  await expect(page.locator('#card-actions .rating-label')).toHaveText(['认识', '模糊', '忘记']);
  await expect(page.locator('#rating-preview-remember')).toContainText('复习');
  await expect(page.locator('#rating-preview-easy')).toContainText('复习');
  await expect(page.locator('#rating-preview-forgot')).toContainText('复习');
  await expect(page.locator('#btn-remember')).toHaveAttribute('aria-label', /认识，.*复习/);
  await page.locator('#btn-remember').click();
  await expect(page.locator('#stat-today')).toHaveText('1');
});

test('fits the supported minimum desktop window size', async ({ page }) => {
  const viewport = { width: 620, height: 480 };
  await page.setViewportSize(viewport);
  await openApp(page);

  await expectViewportContained(page, viewport);

  await page.locator('#btn-settings').click();
  await expect.poll(async () => {
    const bounds = await page.getByRole('dialog', { name: /设置/ })
      .locator('.overlay-content')
      .boundingBox();
    return bounds.y >= 0 && bounds.y + bounds.height <= 480;
  }).toBe(true);
});

test('adapts the desktop shell across common window sizes', async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 720 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 }
  ]) {
    await page.setViewportSize(viewport);
    await openApp(page);

    await expect(page.locator('.side-nav')).toBeVisible();
    await expect(page.locator('#word-card')).toBeVisible();
    await expectViewportContained(page, viewport);

    if (viewport.width >= 1366) {
      await expect(page.locator('.learning-queue-panel')).toBeVisible();
      await expect(page.locator('.assistant-panel')).toBeVisible();
    }
  }
});

test('keeps the desktop shell stable in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openApp(page);

  await openSettingsSection(page, 'data');
  await page.locator('#btn-theme').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#word-card')).toBeVisible();
  await expect(page.locator('.side-nav')).toBeVisible();
  await expect(page.locator('.assistant-panel')).toBeVisible();
  await expectViewportContained(page, { width: 1366, height: 768 });
});

test('hides unavailable ECDICT example placeholders', async ({ page }) => {
  await openApp(page, {
    words: [{
      word: 'placeholder',
      phonetic: '/placeholder/',
      meaning: '占位词',
      example: 'No example available in ECDICT.',
      exampleTranslation: 'ECDICT 未提供例句。'
    }]
  });

  await page.locator('#btn-confirm').click();
  await expect(page.locator('#word-meaning')).not.toHaveClass(/hidden/);
  await expect(page.locator('#word-example')).toHaveClass(/hidden/);
  await expect(page.locator('#word-example-trans')).toHaveClass(/hidden/);
});

test('shows onboarding on first run and persists dismissal', async ({ page }) => {
  await openApp(page, { showOnboarding: true });

  await expect(page.locator('#onboarding-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#btn-onboarding-skip').click();
  await expect(page.locator('#onboarding-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vocabmaster_onboarding_v1'))).toBe('1');
});

test('searches words and jumps to a result', async ({ page }) => {
  await openApp(page);

  await page.locator('#word-search').fill('ability');
  await expect(page.locator('.search-result-item')).toHaveCount(1);
  await page.locator('.search-result-item').click();
  await expect(page.locator('#word-text')).toHaveText('ability');
});

test('switches to test mode and answers a choice', async ({ page }) => {
  await openApp(page);

  await openSettingsSection(page, 'data');
  await page.locator('#btn-test-mode').click();
  await expect(page.locator('#test-options')).not.toHaveClass(/hidden/);
  await expect(page.locator('.test-choice')).toHaveCount(4);
  await expect(page.locator('.test-type-tab.active')).toHaveText('选择');
  await expect(page.locator('#word-meaning')).toHaveClass(/hidden/);
  await expect(page.locator('#word-example')).toHaveClass(/hidden/);
  await page.locator('.test-choice').first().click();
  await expect(page.locator('#test-actions')).not.toHaveClass(/hidden/);
  await expect(page.locator('#word-meaning')).not.toHaveClass(/hidden/);
  await expect(page.locator('.test-choice.correct')).toHaveCount(1);
});

test('shows content hints and study plan explanation on the word card', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('#word-insights')).toContainText('v.');
  await expect(page.locator('#word-insights')).toContainText('有例句');
  await expect(page.locator('#plan-today')).toHaveText('0/2');
  await expect(page.locator('#plan-due')).toHaveText('0');
  await expect(page.locator('#plan-reason')).toContainText('新词');
});

test('shows morphology hints on the word card', async ({ page }) => {
  await openApp(page, {
    words: [
      {
        word: 'abnormal',
        phonetic: '/æbˈnɔːrməl/',
        meaning: 'adj. 反常的',
        example: 'His abnormal schedule made him tired.',
        exampleTranslation: '他反常的作息让他很累。'
      },
      ...words
    ]
  });

  await expect(page.locator('#word-insights')).toContainText('ab:');
  await expect(page.locator('#word-insights')).toContainText('norm:');
  await expect(page.locator('#word-insights')).toContainText('al:');
});

test('opens the wordbook page and switches wordbanks', async ({ page }) => {
  await openApp(page);

  await page.locator('#btn-wordbooks').click();
  await expect(page.locator('#wordbook-overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('.wordbook-card')).toHaveCount(5);
  await expect(page.locator('.wordbook-card[data-category="cet4"]')).toContainText('4');
  await expect(page.locator('.wordbook-card[data-category="cet4"] .wordbook-select')).toBeDisabled();

  await page.locator('.wordbook-card[data-category="cet6"] .wordbook-select').click();

  await expect(page.locator('#wordbook-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.category)).toBe('cet6');
  await expect(page.locator('#word-text')).toHaveText(/binary|capacity|derive/);
});

test('shows a seven day review pressure forecast in stats', async ({ page }) => {
  const date = new Date();
  const todayKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0')
  ].join('-');

  await openApp(page, {
    progress: {
      abandon_cet4: { interval: 1, repetitions: 1, ef: 2.5, nextReview: todayKey },
      ability_cet4: { interval: 1, repetitions: 1, ef: 2.5, nextReview: tomorrowKey }
    }
  });

  await openSettingsSection(page, 'data');
  await page.locator('#btn-stats').click();

  await expect(page.locator('#review-pressure-forecast .pressure-row')).toHaveCount(7);
  await expect(page.locator('#review-pressure-forecast .pressure-row').nth(0).locator('.pressure-count')).toHaveText('1');
  await expect(page.locator('#review-pressure-forecast .pressure-row').nth(1).locator('.pressure-count')).toHaveText('1');
});

test('shows weekly report and local achievements in stats', async ({ page }) => {
  const date = new Date();
  const todayKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, '0'),
    String(yesterday.getDate()).padStart(2, '0')
  ].join('-');

  await openApp(page, {
    progress: {
      abandon_cet4: { interval: 21, repetitions: 3, ef: 2.1, nextReview: todayKey },
      ability_cet4: { interval: 3, repetitions: 1, ef: 2.5, nextReview: todayKey },
      binary_cet6: { interval: 3, repetitions: 1, ef: 2.5, nextReview: todayKey }
    },
    favorites: ['abandon_cet4', 'ability_cet4', 'adapt_cet4', 'balance_cet4', 'binary_cet6'],
    stats: {
      daily: {
        [yesterdayKey]: { studied: 4, correct: 3, total: 4 },
        [todayKey]: { studied: 5, correct: 5, total: 5 }
      },
      streak: 7,
      lastStudyDate: todayKey,
      testHistory: [{}, {}, {}, {}, {}]
    }
  });

  await openSettingsSection(page, 'data');
  await page.locator('#btn-stats').click();

  await expect(page.locator('#weekly-report')).toContainText('9');
  await expect(page.locator('#weekly-report')).toContainText('2/7');
  await expect(page.locator('.achievement-badge[data-achievement-id="steady-week"]')).toHaveClass(/unlocked/);
  await expect(page.locator('.achievement-badge[data-achievement-id="collector"]')).toHaveClass(/unlocked/);
  await expect(page.locator('.achievement-badge[data-achievement-id="tester"]')).toHaveClass(/unlocked/);
  await expect(page.locator('.achievement-badge[data-achievement-id="explorer"]')).toHaveClass(/unlocked/);
});

test('exports a complete learning profile from settings', async ({ page }) => {
  await openApp(page, {
    progress: {
      abandon_cet4: { interval: 3, repetitions: 1, ef: 2.5, nextReview: '2026-07-17' }
    },
    favorites: ['abandon_cet4']
  });

  await openSettingsSection(page, 'data');
  await page.locator('#btn-export').click();

  await expect(page.locator('#toast')).toContainText('export ok');
  await expect.poll(() => page.evaluate(() => window.__vmStore.exportedProfile.exportVersion)).toBe(2);
  await expect.poll(() => page.evaluate(() => Boolean(window.__vmStore.exportedProfile.progress.abandon_cet4))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vmStore.exportedProfile.favorites)).toEqual(['abandon_cet4']);
});

test('supports spelling and listening test types', async ({ page }) => {
  await openApp(page);

  await page.locator('.mode-tab[data-mode="test"]').click();
  await page.locator('.test-type-tab[data-test-type="spelling"]').click();
  await expect(page.locator('.test-type-tab.active')).toHaveText('拼写');
  await expect(page.locator('#test-input-form')).not.toHaveClass(/hidden/);
  const firstWord = await page.locator('#word-text').textContent();
  await page.locator('#test-answer-input').fill(firstWord);
  await page.locator('#btn-test-submit').click();
  await expect(page.locator('#test-answer-input')).toHaveClass(/correct/);
  await page.locator('#btn-next-test').click();

  await page.locator('.test-type-tab[data-test-type="listening"]').click();
  await expect(page.locator('.test-type-tab.active')).toHaveText('听音');
  const secondWord = await page.locator('#word-text').textContent();
  await page.locator('#test-answer-input').fill(secondWord);
  await page.locator('#btn-test-submit').click();
  await expect(page.locator('#test-answer-input')).toHaveClass(/correct/);
});

test('records test history from the current test session only', async ({ page }) => {
  const date = new Date();
  const todayKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  await openApp(page, {
    stats: {
      daily: { [todayKey]: { studied: 5, correct: 4, total: 5 } },
      streak: 1,
      lastStudyDate: todayKey,
      testHistory: []
    }
  });

  await page.locator('.mode-tab[data-mode="test"]').click();
  for (let index = 0; index < words.length; index++) {
    const meaning = await page.locator('#word-meaning').textContent();
    await page.locator('.test-choice').filter({ hasText: meaning }).click();
    await page.locator('#btn-next-test').click();
  }

  await expect(page.locator('#complete-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#btn-complete-close').click();
  await openSettingsSection(page, 'data');
  await page.locator('#btn-stats').click();
  await expect(page.locator('.test-history-table tbody tr').first().locator('td').nth(2)).toHaveText('4/4');
});


test('saves settings through the settings modal', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('#total-count')).toHaveText('2');
  await page.locator('#btn-settings').click();
  await expect(page.getByRole('dialog', { name: /设置/ })).toBeVisible();
  await page.locator('#setting-daily-goal').fill('5');
  await page.locator('#setting-speech-accent').selectOption('en-GB');
  await page.locator('#setting-speech-rate').selectOption('1.05');
  await page.locator('.settings-nav-item[data-settings-target="desktop"]').click();
  await page.locator('#setting-close-to-tray').uncheck();
  await page.locator('#setting-startup-enabled').check();
  await page.locator('#btn-settings-save').click();

  await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.dailyGoal)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.speechAccent)).toBe('en-GB');
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.speechRate)).toBe(1.05);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.closeToTray)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.startupEnabled)).toBe(true);
  await expect(page.locator('#total-count')).toHaveText('4');

  await page.locator('#btn-pronounce').click();
  await expect.poll(() => page.evaluate(() => window.__vmStore.lastUtterance && window.__vmStore.lastUtterance.lang)).toBe('en-GB');
  await expect.poll(() => page.evaluate(() => window.__vmStore.lastUtterance && window.__vmStore.lastUtterance.rate)).toBe(1.05);
});

test('organizes settings into desktop sections', async ({ page }) => {
  await openApp(page);

  await page.locator('#btn-settings').click();
  await expect(page.locator('.settings-nav-item')).toHaveText(['学习', '桌面', '数据', '安全', '关于']);
  await expect(page.locator('[data-settings-section="learning"]')).not.toHaveClass(/is-hidden/);

  await page.locator('.settings-nav-item[data-settings-target="desktop"]').click();
  await expect(page.locator('[data-settings-section="learning"]')).toHaveClass(/is-hidden/);
  await expect(page.locator('[data-settings-section="desktop"]')).not.toHaveClass(/is-hidden/);
  await expect(page.locator('#setting-startup-enabled')).toBeVisible();

  await page.locator('.settings-nav-item[data-settings-target="data"]').click();
  await expect(page.locator('[data-settings-section="data"]')).not.toHaveClass(/is-hidden/);
  await expect(page.locator('#import-preview-status')).toContainText('导入词条会先统计');
});

test('traps focus inside settings dialog and restores the launcher', async ({ page }) => {
  await openApp(page);

  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('btn-settings-save');

  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('#settings-overlay')))).toBe(true);
  }

  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('#settings-overlay')))).toBe(true);
  await page.keyboard.press('Escape');

  await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('btn-settings');
});

test('shows import preview feedback in settings data section', async ({ page }) => {
  await openApp(page, {
    importResult: {
      success: true,
      message: '导入完成',
      preview: { category: 'cet4', added: 3, duplicates: 1, invalid: 2 }
    }
  });

  await page.locator('#btn-settings').click();
  await page.locator('.settings-nav-item[data-settings-target="data"]').click();
  await page.locator('#btn-import').click();

  await expect(page.locator('#import-preview-status')).toContainText('新增 3 个');
  await expect(page.locator('#import-preview-status')).toContainText('重复 1 个');
  await expect(page.locator('#import-preview-status')).toContainText('无效 2 个');
});

test('keeps reminder state unchanged when saving fails', async ({ page }) => {
  await openApp(page, { failReminderSave: true });

  await openSettingsSection(page, 'desktop');
  await page.locator('#btn-reminder-toggle').click();

  await expect(page.locator('#toast')).toContainText('simulated reminder failure');
  await expect(page.locator('#btn-reminder-toggle')).toHaveText('关闭');
  await expect.poll(() => page.evaluate(() => Boolean(window.__vmStore.settings.reminderEnabled))).toBe(false);
});

test('updates global hotkey through the in-app editor', async ({ page }) => {
  await openApp(page);

  await openSettingsSection(page, 'desktop');
  await page.locator('#btn-hotkey-edit').click();
  await expect(page.locator('#hotkey-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#hotkey-alt').uncheck();
  await page.locator('#hotkey-shift').check();
  await page.locator('#hotkey-key').fill('k');
  await page.locator('#btn-hotkey-save').click();

  await expect(page.locator('#hotkey-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#hotkey-display')).toHaveText('Ctrl+Shift+K');
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.hotkeyKey)).toBe('K');
});

test('switches wordbank from settings and persists the choice', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('.cat-tab')).toHaveCount(5);
  await expect(page.locator('.mode-tab')).toHaveCount(5);
  await expect(page.locator('#word-text')).toHaveText(/abandon|ability|adapt|balance/);
  await page.locator('#btn-settings').click();
  await page.locator('#setting-category').selectOption('cet6');
  await page.locator('#btn-settings-save').click();

  await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.category)).toBe('cet6');
  await expect(page.locator('#word-text')).toHaveText(/binary|capacity|derive/);

  await page.locator('#btn-settings').click();
  await expect(page.locator('#setting-category')).toHaveValue('cet6');
});

test('keeps selected wordbank after reopening the app', async ({ page, context }) => {
  await openApp(page);

  await page.locator('#btn-settings').click();
  await page.locator('#setting-category').selectOption('cet6');
  await page.locator('#btn-settings-save').click();
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.category)).toBe('cet6');

  const persisted = await page.evaluate(() => ({
    settings: window.__vmStore.settings,
    progress: window.__vmStore.progress,
    stats: window.__vmStore.stats
  }));

  const reopened = await context.newPage();
  await openApp(reopened, persisted);
  await expect(reopened.locator('#word-text')).toHaveText(/binary|capacity|derive/);
  await reopened.locator('#btn-settings').click();
  await expect(reopened.locator('#setting-category')).toHaveValue('cet6');
});

test('waits for delayed pywebview bridge before loading words', async ({ page }) => {
  await openApp(page, { delayedPywebview: true });

  await expect(page.locator('#word-text')).toHaveText(/abandon|ability|adapt|balance/);
  await expect(page.locator('#total-count')).toHaveText('2');
});

test('does not let stale client cache override backend wordbank setting', async ({ page }) => {
  await openApp(page, {
    settings: { category: 'cet6' },
    clientCache: {
      savedAt: '2099-01-01T00:00:00.000Z',
      progress: {},
      stats: { daily: {}, streak: 0, lastStudyDate: null },
      settings: { fontSize: 18, dailyGoal: 2, darkMode: false, category: 'cet4' }
    }
  });

  await expect(page.locator('#word-text')).toHaveText(/binary|capacity|derive/);
  await page.locator('#btn-settings').click();
  await expect(page.locator('#setting-category')).toHaveValue('cet6');
});

test('starts in new learning and offers review after daily goal', async ({ page }) => {
  await openApp(page);
  await page.locator('.mode-tab[data-mode="new"]').click();

  await expect(page.locator('.mode-tab')).toHaveCount(5);
  await expect(page.locator('#total-count')).toHaveText('2');

  await revealAndRate(page);
  await revealAndRate(page);

  await expect(page.locator('#complete-overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#btn-complete-review')).not.toHaveClass(/hidden/);
  await expect(page.locator('#complete-new-options')).toHaveClass(/hidden/);
  await expect(page.locator('#btn-complete-weak')).toHaveClass(/hidden/);
});

test('after review can choose custom new count or strengthening', async ({ page }) => {
  await openApp(page, {
    progress: {
      abandon_cet4: { interval: 1, repetitions: 1, ef: 2.5, nextReview: '2026-01-01' }
    }
  });
  await page.locator('.mode-tab[data-mode="new"]').click();

  await expect(page.locator('#total-count')).toHaveText('2');
  await revealAndRate(page);
  await revealAndRate(page);
  await expect(page.locator('#complete-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#btn-complete-review').click();

  await expect(page.locator('#total-count')).toHaveText('1');
  await revealAndRate(page);

  await expect(page.locator('#complete-overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#complete-new-options')).not.toHaveClass(/hidden/);
  await expect(page.locator('#btn-complete-weak')).not.toHaveClass(/hidden/);

  await page.locator('#complete-new-count').fill('1');
  await page.locator('#btn-complete-new').click();
  await expect(page.locator('#complete-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#total-count')).toHaveText('1');
});

test('keeps daily new-learning progress after reopening', async ({ page, context }) => {
  await openApp(page);

  const firstWord = await page.locator('#word-text').textContent();
  await revealAndRate(page);
  await expect(page.locator('#current-index')).toHaveText('2');
  await expect(page.locator('#total-count')).toHaveText('2');

  const persisted = await page.evaluate(() => ({
    progress: window.__vmStore.progress,
    settings: window.__vmStore.settings,
    stats: window.__vmStore.stats
  }));

  const reopened = await context.newPage();
  await openApp(reopened, persisted);
  await expect(reopened.locator('#current-index')).toHaveText('2');
  await expect(reopened.locator('#total-count')).toHaveText('2');
  await expect(reopened.locator('#word-text')).not.toHaveText(firstWord);
});

test('waits for progress save before advancing to the next word', async ({ page }) => {
  await openApp(page, { delayProgressSave: true });

  const firstWord = await page.locator('#word-text').textContent();
  await page.locator('#btn-confirm').click();
  await page.locator('#btn-remember').click();

  await page.waitForTimeout(100);
  await expect(page.locator('#word-text')).toHaveText(firstWord);

  await page.evaluate(() => window.__resolveProgressSave());
  await expect(page.locator('#current-index')).toHaveText('2');
});

test('keeps the current word when the learning transaction fails', async ({ page }) => {
  await openApp(page, { failLearningSave: true });

  const firstWord = await page.locator('#word-text').textContent();
  await page.locator('#btn-confirm').click();
  await page.locator('#btn-remember').click();

  await expect(page.locator('#toast')).toContainText('simulated learning save failure');
  await expect(page.locator('#word-text')).toHaveText(firstWord);
  await expect(page.locator('#stat-today')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress).length)).toBe(0);
});

test('keeps the current test question when saving the answer fails', async ({ page }) => {
  await openApp(page, { failLearningSave: true });
  await page.locator('.mode-tab[data-mode="test"]').click();

  const firstWord = await page.locator('#word-text').textContent();
  const meaning = await page.locator('#word-meaning').textContent();
  await page.locator('.test-choice').filter({ hasText: meaning }).click();

  await expect(page.locator('#toast')).toContainText('simulated learning save failure');
  await expect(page.locator('#word-text')).toHaveText(firstWord);
  await expect(page.locator('#btn-next-test')).toHaveClass(/hidden/);
  await expect(page.locator('#stat-today')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress).length)).toBe(0);
});

test('persists undo after rating a word', async ({ page }) => {
  await openApp(page);

  const firstWord = await page.locator('#word-text').textContent();
  await revealAndRate(page);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress).length)).toBe(1);

  await page.keyboard.press('Control+Z');

  await expect(page.locator('#word-text')).toHaveText(firstWord);
  await expect(page.locator('#stat-today')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress).length)).toBe(0);
});

test('keeps settings open and active category unchanged when saving fails', async ({ page }) => {
  await openApp(page, { failSettingsSave: true });

  await page.locator('#btn-settings').click();
  await page.locator('#setting-category').selectOption('cet6');
  await page.locator('#btn-settings-save').click();

  await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#toast')).toContainText('保存设置失败');
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.category)).toBe('cet4');
  await expect(page.locator('.cat-tab.active')).toHaveAttribute('data-category', 'cet4');
});

test('rolls back direct wordbank and theme changes when settings saving fails', async ({ page }) => {
  await openApp(page, { failSettingsSave: true });

  await page.locator('.cat-tab[data-category="cet6"]').click();
  await expect(page.locator('.cat-tab.active')).toHaveAttribute('data-category', 'cet4');
  await expect(page.locator('#word-text')).toHaveText(/abandon|ability|adapt|balance/);

  await openSettingsSection(page, 'data');
  await page.locator('#btn-theme').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => window.__vmStore.settings.darkMode)).toBe(false);
});

test('rolls back favorite state when saving fails', async ({ page }) => {
  await openApp(page, { failFavoritesSave: true });

  await page.locator('#btn-favorite').click();

  await expect(page.locator('#toast')).toContainText('保存收藏失败');
  await expect(page.locator('#btn-favorite')).toHaveText('\u2606');
  await expect.poll(() => page.evaluate(() => window.__vmStore.favorites.length)).toBe(0);
});

test('toggles favorite state for the current word', async ({ page }) => {
  await openApp(page);
  const firstWord = await page.locator('#word-text').textContent();

  await expect(page.locator('#btn-favorite')).toHaveText('\u2606');
  await page.locator('#btn-favorite').click();

  await expect(page.locator('#btn-favorite')).toHaveText('\u2605');
  await expect.poll(() => page.evaluate(() => window.__vmStore.favorites.length)).toBe(1);

  await revealAndRate(page);
  await expect(page.locator('#btn-favorite')).toHaveText('\u2606');
  await page.locator('#word-search').fill(firstWord);
  await page.locator('.search-result-item').click();
  await expect(page.locator('#btn-favorite')).toHaveText('\u2605');
});

test('restores backup and reloads local data', async ({ page }) => {
  await openApp(page, {
    progress: { old_cet4: { interval: 9, repetitions: 2, ef: 2.5, nextReview: '2026-07-01' } }
  });

  await openSettingsSection(page, 'data');
  await page.locator('#btn-restore').click();
  await acceptAppConfirm(page);

  await page.waitForTimeout(300);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress))).toEqual(['restored_cet4']);
  await expect(page.locator('#stat-streak')).toContainText('0');
});

test('opens stats dashboard with summary values', async ({ page }) => {
  await openApp(page);

  await openSettingsSection(page, 'data');
  await page.locator('#btn-stats').click();

  await expect(page.locator('#stats-overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#stats-total-studied')).toHaveText('4');
  await expect(page.locator('#stats-accuracy-avg')).toHaveText('75%');
  await expect.poll(() => canvasHasPaint(page, '#chart-accuracy')).toBe(true);
  await expect.poll(() => canvasHasPaint(page, '#chart-memory-curve')).toBe(true);
  await page.locator('.memory-range-btn[data-memory-days="30"]').click();
  await expect(page.locator('.memory-range-btn[data-memory-days="30"]')).toHaveClass(/active/);
});

test('resets progress after confirmation', async ({ page }) => {
  await openApp(page);

  await revealAndRate(page);
  await expect(page.locator('#stat-today')).toHaveText('1');

  await openSettingsSection(page, 'safety');
  await page.locator('#btn-reset').click();
  await acceptAppConfirm(page);

  await expect(page.locator('#stat-today')).toHaveText('0');
  await expect(page.locator('#stat-streak')).toContainText('0');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress).length)).toBe(0);
});

test('queues consecutive confirmation dialogs without dropping requests', async ({ page }) => {
  await openApp(page);

  await openSettingsSection(page, 'safety');
  await page.evaluate(() => {
    document.querySelector('#btn-reset').click();
    document.querySelector('#btn-reset').click();
    document.querySelector('#btn-reset').click();
  });

  await acceptAppConfirm(page);
  await acceptAppConfirm(page);
  await acceptAppConfirm(page);

  await expect.poll(() => page.evaluate(() => window.__vmStore.resetCount)).toBe(3);
  await expect(page.locator('#confirm-overlay')).toHaveClass(/hidden/);
});

test('adds a custom word and finds it through search', async ({ page }) => {
  await openApp(page);

  await page.locator('#btn-add-word').click();
  await expect(page.locator('#add-word-overlay')).not.toHaveClass(/hidden/);
  await page.locator('#add-word-text').fill('optics');
  await page.locator('#add-word-meaning').fill('n. 光学');
  await page.locator('#add-word-phonetic').fill('/optiks/');
  await page.locator('#btn-add-save').click();

  await expect(page.locator('#add-word-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => window.__vmStore.wordsByCategory.cet4.some(word => word.word === 'optics'))).toBe(true);

  await page.locator('#word-search').fill('optics');
  await expect(page.locator('.search-result-item')).toHaveCount(1);
  await page.locator('.search-result-item').click();
  await expect(page.locator('#word-text')).toHaveText('optics');
});

test('manages local backup list from settings', async ({ page }) => {
  await openApp(page);

  await openSettingsSection(page, 'safety');
  await page.locator('#btn-backups').click();
  await expect(page.locator('#backup-manager')).not.toHaveClass(/hidden/);
  await expect(page.locator('.backup-item')).toHaveCount(1);

  await page.locator('.backup-restore').click();
  await acceptAppConfirm(page);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vmStore.progress))).toContain('backup_cet4');

  await page.locator('.backup-delete').click();
  await acceptAppConfirm(page);
  await expect(page.locator('.backup-item')).toHaveCount(0);
});
