const assert = require('assert');
const {
  normalizeAccent,
  normalizeRate,
  pickVoice,
  createUtterance,
  speak
} = require('../src/tts');

assert.strictEqual(normalizeAccent('en-GB'), 'en-GB');
assert.strictEqual(normalizeAccent('invalid'), 'en-US');
assert.strictEqual(normalizeRate('1.05'), 1.05);
assert.strictEqual(normalizeRate('2'), 1.15);
assert.strictEqual(normalizeRate('0.4'), 0.65);

const voices = [
  { name: 'Microsoft Zira', lang: 'en-US', localService: true },
  { name: 'Microsoft Sonia', lang: 'en-GB', localService: true },
  { name: 'Spanish Voice', lang: 'es-ES', localService: true }
];
assert.strictEqual(pickVoice(voices, 'en-GB').name, 'Microsoft Sonia');
assert.strictEqual(pickVoice(voices, 'en-US').name, 'Microsoft Zira');

const fakeSynth = {
  lastSpoken: null,
  cancelled: false,
  getVoices: () => voices,
  cancel() { this.cancelled = true; },
  speak(utterance) { this.lastSpoken = utterance; }
};
function FakeUtterance(text) {
  this.text = text;
}

const utterance = createUtterance('hello', { speechAccent: 'en-GB', speechRate: 1.05 }, {
  speechSynthesis: fakeSynth,
  SpeechSynthesisUtterance: FakeUtterance
});
assert.strictEqual(utterance.lang, 'en-GB');
assert.strictEqual(utterance.rate, 1.05);
assert.strictEqual(utterance.voice.name, 'Microsoft Sonia');

let started = false;
const result = speak('hello', { speechAccent: 'en-US', speechRate: 0.75 }, {
  speechSynthesis: fakeSynth,
  SpeechSynthesisUtterance: FakeUtterance,
  onStart: () => { started = true; }
});
assert.strictEqual(result.success, true);
assert.strictEqual(started, true);
assert.strictEqual(fakeSynth.cancelled, true);
assert.strictEqual(fakeSynth.lastSpoken.lang, 'en-US');
assert.strictEqual(fakeSynth.lastSpoken.rate, 0.75);

assert.strictEqual(speak('hello', {}, {}).success, false);
