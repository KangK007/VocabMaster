(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterSettings = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function normalizeDailyGoal(value, fallback = 30) {
    const parsed = parseInt(value, 10);
    const goal = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(5, Math.min(200, goal));
  }

  function normalizeFontSize(value, fallback = 18) {
    const parsed = parseInt(value, 10);
    const size = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(14, Math.min(28, size));
  }

  function normalizeCategory(value, fallback = 'cet4') {
    const valid = new Set(['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl']);
    return valid.has(value) ? value : fallback;
  }

  function normalizeSpeechAccent(value, fallback = 'en-US') {
    const valid = new Set(['en-US', 'en-GB']);
    return valid.has(value) ? value : fallback;
  }

  function normalizeSpeechRate(value, fallback = 0.85) {
    const parsed = Number.parseFloat(value);
    const rate = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(0.65, Math.min(1.15, rate));
  }

  function applyFontDelta(settings, delta) {
    return {
      ...settings,
      fontSize: normalizeFontSize((settings && settings.fontSize) || 18) + delta > 28
        ? 28
        : normalizeFontSize((settings && settings.fontSize) || 18) + delta < 14
          ? 14
          : normalizeFontSize((settings && settings.fontSize) || 18) + delta
    };
  }

  function openSettingsModal(doc, settings) {
    const input = doc.getElementById('setting-daily-goal');
    const category = doc.getElementById('setting-category');
    const speechAccent = doc.getElementById('setting-speech-accent');
    const speechRate = doc.getElementById('setting-speech-rate');
    const closeToTray = doc.getElementById('setting-close-to-tray');
    const startupEnabled = doc.getElementById('setting-startup-enabled');
    const overlay = doc.getElementById('settings-overlay');
    if (input) input.value = settings.dailyGoal;
    if (category) category.value = normalizeCategory(settings.category);
    if (speechAccent) speechAccent.value = normalizeSpeechAccent(settings.speechAccent);
    if (speechRate) speechRate.value = String(normalizeSpeechRate(settings.speechRate));
    if (closeToTray) closeToTray.checked = settings.closeToTray !== false;
    if (startupEnabled) startupEnabled.checked = Boolean(settings.startupEnabled);
    if (overlay) overlay.classList.remove('hidden');
  }

  function closeSettingsModal(doc) {
    const overlay = doc.getElementById('settings-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function readSettingsForm(doc, currentSettings) {
    const input = doc.getElementById('setting-daily-goal');
    const category = doc.getElementById('setting-category');
    const speechAccent = doc.getElementById('setting-speech-accent');
    const speechRate = doc.getElementById('setting-speech-rate');
    const closeToTray = doc.getElementById('setting-close-to-tray');
    const startupEnabled = doc.getElementById('setting-startup-enabled');
    return {
      ...currentSettings,
      dailyGoal: normalizeDailyGoal(input ? input.value : currentSettings.dailyGoal, 30),
      category: normalizeCategory(category ? category.value : currentSettings.category),
      speechAccent: normalizeSpeechAccent(speechAccent ? speechAccent.value : currentSettings.speechAccent),
      speechRate: normalizeSpeechRate(speechRate ? speechRate.value : currentSettings.speechRate),
      closeToTray: closeToTray ? closeToTray.checked : currentSettings.closeToTray !== false,
      startupEnabled: startupEnabled ? startupEnabled.checked : Boolean(currentSettings.startupEnabled)
    };
  }

  return {
    normalizeDailyGoal,
    normalizeFontSize,
    normalizeCategory,
    normalizeSpeechAccent,
    normalizeSpeechRate,
    applyFontDelta,
    openSettingsModal,
    closeSettingsModal,
    readSettingsForm
  };
});
