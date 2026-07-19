(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.VocabMasterErrorBook = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  var ERROR_REMOVE_THRESHOLD = 3;
  var utils = (typeof window !== 'undefined' && window.VocabMasterUtils)
    || (typeof require === 'function' ? require('./core-utils') : null);
  var escapeHtml = utils && utils.escapeHtml;
  var localDateKey = utils && utils.localDateKey;

  if (typeof escapeHtml !== 'function' || typeof localDateKey !== 'function') {
    throw new Error('VocabMasterUtils is required before error-book.js');
  }

  function recordError(word, category, errorBook) {
    var key = word.word.toLowerCase() + '_' + category;
    var entry = errorBook[key];
    var today = localDateKey();
    if (entry) {
      entry.count = (entry.count || 0) + 1;
      entry.lastErrorDate = today;
      entry.correctStreak = 0;
    } else {
      errorBook[key] = {
        category: category,
        count: 1,
        lastErrorDate: today,
        correctStreak: 0
      };
    }
    return errorBook;
  }

  function recordCorrect(word, category, errorBook) {
    var key = word.word.toLowerCase() + '_' + category;
    var entry = errorBook[key];
    if (!entry) return errorBook;

    entry.correctStreak = (entry.correctStreak || 0) + 1;
    if (entry.correctStreak >= ERROR_REMOVE_THRESHOLD) {
      delete errorBook[key];
    }
    return errorBook;
  }

  function getErrorWords(errorBook, wordList) {
    if (!errorBook || typeof errorBook !== 'object') return [];
    var result = [];
    for (var key in errorBook) {
      if (!Object.prototype.hasOwnProperty.call(errorBook, key)) continue;
      var entry = errorBook[key];
      var idx = key.lastIndexOf('_');
      var wordText = idx > 0 ? key.substring(0, idx) : key;
      var word = null;
      for (var i = 0; i < wordList.length; i++) {
        if (wordList[i].word.toLowerCase() === wordText &&
            (!wordList[i]._cat || wordList[i]._cat === entry.category)) {
          word = wordList[i];
          break;
        }
      }
      if (word) {
        result.push({
          word: word.word,
          phonetic: word.phonetic || '',
          meaning: word.meaning || '',
          _cat: entry.category,
          category: entry.category,
          count: entry.count,
          lastErrorDate: entry.lastErrorDate,
          correctStreak: entry.correctStreak
        });
      }
    }
    result.sort(function (a, b) {
      return b.count - a.count || b.lastErrorDate.localeCompare(a.lastErrorDate);
    });
    return result;
  }

  function renderErrorBookList(doc, container, errorWords, onClickReview, onClickClear) {
    if (!errorWords || errorWords.length === 0) {
      container.innerHTML = '<div class="backup-empty">🎉 暂无错题，继续保持！</div>';
      return;
    }

    var frag = doc.createDocumentFragment();
    for (var i = 0; i < errorWords.length; i++) {
      var ew = errorWords[i];
      var row = doc.createElement('div');
      row.className = 'error-book-row';
      row.innerHTML =
        '<span class="error-word">' + escapeHtml(ew.word) + '</span>' +
        '<span class="error-cat">' + escapeHtml(ew.category) + '</span>' +
        '<span class="error-count">✗' + ew.count + '</span>' +
        '<span class="error-date">' + escapeHtml(ew.lastErrorDate) + '</span>';
      frag.appendChild(row);
    }

    container.innerHTML = '';
    container.appendChild(frag);

    var countEl = doc.getElementById('error-book-count');
    if (countEl) countEl.textContent = '共 ' + errorWords.length + ' 个错词';
  }

  function buildErrorReviewQueue(errorWords) {
    return errorWords.map(function (ew) {
      return {
        word: ew.word,
        phonetic: ew.phonetic,
        meaning: ew.meaning,
        _cat: ew.category,
        example: '',
        exampleTranslation: ''
      };
    });
  }

  return {
    recordError: recordError,
    recordCorrect: recordCorrect,
    getErrorWords: getErrorWords,
    renderErrorBookList: renderErrorBookList,
    buildErrorReviewQueue: buildErrorReviewQueue,
    ERROR_REMOVE_THRESHOLD: ERROR_REMOVE_THRESHOLD
  };
});
