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
  }
];

async function openApp(page) {
  await page.addInitScript(({ words }) => {
    localStorage.clear();
    const store = {
      progress: {},
      stats: { daily: {}, streak: 0, lastStudyDate: null },
      settings: { fontSize: 18, dailyGoal: 3, darkMode: false },
      favorites: []
    };
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; } };
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
    window.pywebview = {
      api: {
        get_word_list: async () => words,
        get_progress: async () => store.progress,
        save_progress: async (progress) => { store.progress = progress; return true; },
        get_stats: async () => store.stats,
        save_stats: async (stats) => { store.stats = stats; return true; },
        get_settings: async () => store.settings,
        save_settings: async (settings) => { store.settings = settings; return true; },
        get_favorites: async () => store.favorites,
        save_favorites: async (favorites) => { store.favorites = favorites; return true; },
        import_words: async () => ({ success: false, message: 'not used in e2e' }),
        export_data: async () => ({ success: true, message: 'export ok' }),
        restore_data: async () => ({ success: false, message: 'not used in e2e' }),
        reset_progress: async () => ({ success: true })
      }
    };
  }, { words });

  await page.goto(`file://${path.resolve('src/index.html')}`);
  await page.locator('[data-mode="new"]').click();
  await expect(page.locator('#word-text')).toHaveText(/abandon|ability|adapt/, { timeout: 5000 });
}

test('loads the study screen and reveals meaning after rating', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('#word-meaning')).toHaveClass(/hidden/);
  await page.locator('#btn-remember').click();
  await expect(page.locator('#word-meaning')).not.toHaveClass(/hidden/);
  await expect(page.locator('#confirm-actions')).not.toHaveClass(/hidden/);
  await expect(page.locator('#stat-today')).toHaveText('1');
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

  await page.locator('[data-mode="test"]').click();
  await expect(page.locator('#test-options')).not.toHaveClass(/hidden/);
  await expect(page.locator('.test-choice')).toHaveCount(3);
  await page.locator('.test-choice').first().click();
  await expect(page.locator('#test-actions')).not.toHaveClass(/hidden/);
});
