const assert = require('assert');
const {
  normalizeDailyGoal,
  normalizeCategory,
  normalizeSpeechAccent,
  normalizeSpeechRate,
  applyFontDelta,
  readSettingsForm
} = require('../src/settings-ui');

assert.strictEqual(normalizeDailyGoal('40'), 40);
assert.strictEqual(normalizeDailyGoal('bad'), 30);
assert.strictEqual(normalizeDailyGoal('2'), 5);
assert.strictEqual(normalizeDailyGoal('999'), 200);

assert.strictEqual(normalizeCategory('cet6'), 'cet6');
assert.strictEqual(normalizeCategory('bad'), 'cet4');
assert.strictEqual(normalizeSpeechAccent('en-GB'), 'en-GB');
assert.strictEqual(normalizeSpeechAccent('bad'), 'en-US');
assert.strictEqual(normalizeSpeechRate('1.05'), 1.05);
assert.strictEqual(normalizeSpeechRate('2'), 1.15);
assert.strictEqual(normalizeSpeechRate('0.4'), 0.65);

assert.strictEqual(applyFontDelta({ fontSize: 18 }, 1).fontSize, 19);
assert.strictEqual(applyFontDelta({ fontSize: 28 }, 1).fontSize, 28);
assert.strictEqual(applyFontDelta({ fontSize: 14 }, -1).fontSize, 14);

const controls = {
  'setting-daily-goal': { value: '25' },
  'setting-category': { value: 'cet6' },
  'setting-speech-accent': { value: 'en-GB' },
  'setting-speech-rate': { value: '1.05' },
  'setting-close-to-tray': { checked: false },
  'setting-startup-enabled': { checked: true }
};
const formSettings = readSettingsForm(
  { getElementById(id) { return controls[id] || null; } },
  { dailyGoal: 30, category: 'cet4', closeToTray: true, startupEnabled: false }
);
assert.strictEqual(formSettings.closeToTray, false);
assert.strictEqual(formSettings.startupEnabled, true);
assert.strictEqual(formSettings.speechAccent, 'en-GB');
assert.strictEqual(formSettings.speechRate, 1.05);
