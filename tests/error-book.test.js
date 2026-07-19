const assert = require('assert');
const {
  getErrorWords,
  buildErrorReviewQueue,
  renderErrorBookList
} = require('../src/error-book');

const errors = {
  shared_cet6: {
    category: 'cet6',
    count: 2,
    lastErrorDate: '2026-07-16',
    correctStreak: 0
  }
};
const words = [
  { word: 'shared', meaning: 'CET-4 meaning', _cat: 'cet4' },
  { word: 'shared', meaning: 'CET-6 meaning', _cat: 'cet6' }
];

const errorWords = getErrorWords(errors, words);
assert.strictEqual(errorWords.length, 1);
assert.strictEqual(errorWords[0].meaning, 'CET-6 meaning');

const queue = buildErrorReviewQueue(errorWords);
assert.strictEqual(queue[0]._cat, 'cet6');

function createFakeDocument() {
  return {
    createDocumentFragment() {
      return {
        children: [],
        appendChild(child) { this.children.push(child); }
      };
    },
    createElement(tagName) {
      return {
        tagName,
        className: '',
        innerHTML: ''
      };
    },
    getElementById() {
      return { textContent: '' };
    }
  };
}

const errorContainer = {
  innerHTML: '',
  children: [],
  appendChild(child) { this.children.push(child); }
};
renderErrorBookList(createFakeDocument(), errorContainer, [{
  word: '<img src=x onerror=alert(1)>',
  category: '<script>alert(1)</script>',
  count: 1,
  lastErrorDate: '2026-07-19<script>'
}]);
const renderedErrorBook = JSON.stringify(errorContainer);
assert.ok(!renderedErrorBook.includes('<img'));
assert.ok(!renderedErrorBook.includes('<script>'));
assert.ok(renderedErrorBook.includes('&lt;img'));
