const assert = require('assert');
const {
  readCustomWordForm,
  validateCustomWord,
  clearCustomWordForm
} = require('../src/word-form');

function createInput(value = '') {
  return { value };
}

function createDocument(fields) {
  return {
    getElementById(id) {
      return fields[id] || null;
    }
  };
}

const fields = {
  'add-word-text': createInput('  optics  '),
  'add-word-phonetic': createInput(' /optiks/ '),
  'add-word-meaning': createInput(' 光学 '),
  'add-word-example': createInput(' Optical systems need alignment. '),
  'add-word-example-trans': createInput(' 光学系统需要对准。 ')
};

const word = readCustomWordForm(createDocument(fields));
assert.deepStrictEqual(word, {
  word: 'optics',
  phonetic: '/optiks/',
  meaning: '光学',
  example: 'Optical systems need alignment.',
  exampleTranslation: '光学系统需要对准。'
});

assert.deepStrictEqual(validateCustomWord(word), { ok: true });
assert.deepStrictEqual(validateCustomWord({ word: '', meaning: 'x' }), {
  ok: false,
  message: '请至少填写单词和释义'
});

clearCustomWordForm(createDocument(fields));
assert.strictEqual(fields['add-word-text'].value, '');
assert.strictEqual(fields['add-word-meaning'].value, '');
