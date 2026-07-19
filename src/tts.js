(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterTTS = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ACCENTS = new Set(['en-US', 'en-GB']);

  function normalizeAccent(value, fallback = 'en-US') {
    return ACCENTS.has(value) ? value : fallback;
  }

  function normalizeRate(value, fallback = 0.85) {
    const parsed = Number.parseFloat(value);
    const rate = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(0.65, Math.min(1.15, rate));
  }

  function voiceScore(voice, accent) {
    const lang = String(voice.lang || '');
    const name = String(voice.name || '').toLowerCase();
    let score = 0;
    if (lang === accent) score += 30;
    if (accent === 'en-US' && /(^|[-_])us\b|united states|zira|david|aria|jenny|guy/.test(name)) score += 12;
    if (accent === 'en-GB' && /(^|[-_])gb\b|united kingdom|british|sonia|george|hazel|libby|ryan/.test(name)) score += 12;
    if (lang.startsWith('en')) score += 6;
    if (voice.localService) score += 4;
    return score;
  }

  function pickVoice(voices, accent = 'en-US') {
    const list = Array.isArray(voices) ? voices : [];
    const preferredAccent = normalizeAccent(accent);
    return list
      .filter(voice => String(voice.lang || '').startsWith('en'))
      .sort((a, b) => voiceScore(b, preferredAccent) - voiceScore(a, preferredAccent))[0] || null;
  }

  function getSpeechApi(overrides = {}) {
    const root = typeof window !== 'undefined' ? window : null;
    return {
      synth: overrides.speechSynthesis || (root && root.speechSynthesis),
      Utterance: overrides.SpeechSynthesisUtterance || (root && root.SpeechSynthesisUtterance)
    };
  }

  function createUtterance(text, settings = {}, overrides = {}) {
    const { synth, Utterance } = getSpeechApi(overrides);
    if (!synth || !Utterance) return null;

    const accent = normalizeAccent(settings.speechAccent || settings.accent);
    const utterance = new Utterance(text);
    utterance.lang = accent;
    utterance.rate = normalizeRate(settings.speechRate || settings.rate);
    utterance.pitch = 1;
    const voice = pickVoice(synth.getVoices ? synth.getVoices() : [], accent);
    if (voice) utterance.voice = voice;
    return utterance;
  }

  function speak(text, settings = {}, overrides = {}) {
    const { synth } = getSpeechApi(overrides);
    const utterance = createUtterance(text, settings, overrides);
    if (!synth || !utterance) {
      return { success: false, message: 'speech api unavailable' };
    }
    if (typeof overrides.onStart === 'function') overrides.onStart();
    utterance.onend = () => {
      if (typeof overrides.onEnd === 'function') overrides.onEnd();
    };
    utterance.onerror = () => {
      if (typeof overrides.onEnd === 'function') overrides.onEnd();
    };
    synth.cancel();
    synth.speak(utterance);
    return {
      success: true,
      lang: utterance.lang,
      rate: utterance.rate,
      voice: utterance.voice ? utterance.voice.name : ''
    };
  }

  function warmup(overrides = {}) {
    const { synth } = getSpeechApi(overrides);
    if (!synth || typeof synth.getVoices !== 'function') return [];
    const voices = synth.getVoices();
    if ('onvoiceschanged' in synth && typeof synth.onvoiceschanged !== 'function') {
      synth.onvoiceschanged = () => synth.getVoices();
    }
    return voices;
  }

  return {
    normalizeAccent,
    normalizeRate,
    pickVoice,
    createUtterance,
    speak,
    warmup
  };
});
