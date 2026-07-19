(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterStats = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const utils = (typeof window !== 'undefined' && window.VocabMasterUtils)
    || (typeof require === 'function' ? require('./core-utils') : null);
  const { escapeHtml, localDateKey } = utils || {};
  if (typeof escapeHtml !== 'function' || typeof localDateKey !== 'function') {
    throw new Error('VocabMasterUtils is required before stats-renderer.js');
  }

  const COLORS = {
    bgSubtle: '#f3efe6',
    border: '#e5dfd3',
    textPrimary: '#1c1c28',
    textMuted: '#8b8794',
    ink: '#2d3561',
    inkSoft: '#8090cc',
    accent: '#b8860b',
    accentLight: '#fdf3dc',
    accentDark: '#8b6508',
    success: '#4a7c59',
    warning: '#c4783c',
    danger: '#b5443c'
  };
  const HEATMAP_COLORS = [COLORS.bgSubtle, '#eee5d5', '#dfc784', COLORS.accent, COLORS.accentDark];

  function calculateStatsSummary(stats, mastered) {
    let totalStudied = 0;
    let totalCorrect = 0;
    let totalTotal = 0;
    const dailyData = (stats && stats.daily) || {};

    for (const day of Object.values(dailyData)) {
      totalStudied += day.studied || 0;
      totalCorrect += day.correct || 0;
      totalTotal += day.total || 0;
    }

    return {
      totalStudied,
      accuracyText: totalTotal > 0 ? Math.round((totalCorrect / totalTotal) * 100) + '%' : '-',
      streak: (stats && stats.streak) || 0,
      mastered: mastered || 0
    };
  }

  function getRecentAccuracyDates(dailyData, limit = 14) {
    return Object.keys(dailyData || {}).sort().slice(-limit);
  }

  function getHeatmapCellColor(count) {
    if (count === 0) return HEATMAP_COLORS[0];
    if (count <= 5) return HEATMAP_COLORS[1];
    if (count <= 15) return HEATMAP_COLORS[2];
    if (count <= 30) return HEATMAP_COLORS[3];
    return HEATMAP_COLORS[4];
  }

  function isMasteredCard(card) {
    return Boolean(card && card.repetitions >= 3 && card.ef >= 2.0);
  }

  function dateKeyFromOffset(todayDate, offset) {
    const date = new Date(todayDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return localDateKey(date);
  }

  function buildWeeklyReport(stats, settings, todayDate = new Date()) {
    const daily = (stats && stats.daily) || {};
    const dailyGoal = Math.max(1, (settings && settings.dailyGoal) || 30);
    const days = [];
    let studied = 0;
    let correct = 0;
    let total = 0;
    let activeDays = 0;
    let goalDays = 0;
    let bestDay = { date: '', studied: 0 };

    for (let offset = -6; offset <= 0; offset++) {
      const date = dateKeyFromOffset(todayDate, offset);
      const day = daily[date] || {};
      const dayStudied = day.studied || 0;
      const dayCorrect = day.correct || 0;
      const dayTotal = day.total || 0;
      studied += dayStudied;
      correct += dayCorrect;
      total += dayTotal;
      if (dayStudied > 0) activeDays++;
      if (dayStudied >= dailyGoal) goalDays++;
      if (dayStudied >= bestDay.studied) bestDay = { date, studied: dayStudied };
      days.push({ date, studied: dayStudied, correct: dayCorrect, total: dayTotal });
    }

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;
    let suggestion = '本周还没有学习记录，建议先完成一次短学习。';
    if (studied > 0 && goalDays >= 5) {
      suggestion = '本周节奏稳定，可以保持当前每日目标。';
    } else if (studied > 0 && activeDays >= 4) {
      suggestion = '本周有连续投入，建议优先清理到期复习。';
    } else if (studied > 0) {
      suggestion = '本周学习偏分散，建议固定一个每日学习时段。';
    }

    return {
      days,
      studied,
      correct,
      total,
      accuracy,
      activeDays,
      goalDays,
      dailyGoal,
      bestDay,
      averagePerActiveDay: activeDays > 0 ? Math.round(studied / activeDays) : 0,
      suggestion
    };
  }

  function buildAchievements(stats, progress, favorites, allWords) {
    const summary = calculateStatsSummary(stats || {}, 0);
    const daily = (stats && stats.daily) || {};
    let totalCorrect = 0;
    let totalAnswers = 0;
    Object.values(daily).forEach(day => {
      totalCorrect += day.correct || 0;
      totalAnswers += day.total || 0;
    });
    const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    const cards = Object.values(progress || {});
    const mastered = cards.filter(isMasteredCard).length;
    const learned = cards.filter(card => card && card.repetitions > 0).length;
    const favoriteCount = Array.isArray(favorites) ? favorites.length : 0;
    const testCount = Array.isArray(stats && stats.testHistory) ? stats.testHistory.length : 0;
    const categoriesWithProgress = new Set(
      Object.keys(progress || {})
        .map(key => String(key).split('_').pop())
        .filter(Boolean)
    ).size;
    const wordbankTotal = Object.values(allWords || {}).reduce((sum, words) => sum + (Array.isArray(words) ? words.length : 0), 0);

    return [
      { id: 'first-week', title: '三天连学', detail: '连续学习达到 3 天', unlocked: (stats && stats.streak || 0) >= 3 },
      { id: 'steady-week', title: '七天节奏', detail: '连续学习达到 7 天', unlocked: (stats && stats.streak || 0) >= 7 },
      { id: 'starter', title: '百词起步', detail: '累计学习 100 个单词', unlocked: summary.totalStudied >= 100 },
      { id: 'collector', title: '重点整理', detail: '收藏 5 个重点单词', unlocked: favoriteCount >= 5 },
      { id: 'mastery', title: '初步掌握', detail: '掌握 10 个复习卡片', unlocked: mastered >= 10 },
      { id: 'tester', title: '测试达人', detail: '完成 5 次测试记录', unlocked: testCount >= 5 },
      { id: 'accuracy', title: '稳定发挥', detail: '答题正确率达到 80%', unlocked: totalAnswers >= 10 && accuracy >= 80 },
      { id: 'explorer', title: '多词库探索', detail: '在 2 个词库留下学习记录', unlocked: categoriesWithProgress >= 2 },
      { id: 'archive', title: '档案完整', detail: '本地词库与学习档案可统计', unlocked: wordbankTotal > 0 && learned >= 1 }
    ];
  }

  function renderStatsSummary(doc, stats, mastered) {
    const summary = calculateStatsSummary(stats, mastered);
    doc.getElementById('stats-total-studied').textContent = summary.totalStudied;
    doc.getElementById('stats-accuracy-avg').textContent = summary.accuracyText;
    doc.getElementById('stats-streak-max').textContent = summary.streak;
    doc.getElementById('stats-mastered-total').textContent = summary.mastered;
    return summary;
  }

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = (canvas.ownerDocument && canvas.ownerDocument.defaultView && canvas.ownerDocument.defaultView.devicePixelRatio) || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height: rect.height };
  }

  function renderHeatmapCanvas(canvas, dailyData, localDateKey, todayDate = new Date()) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return;
    const { ctx, width: w, height: h } = prepared;
    ctx.clearRect(0, 0, w, h);

    const cellSize = 11, gap = 2, totalCell = cellSize + gap;
    const cols = 26;
    const rows = 7;
    const startX = w - cols * totalCell - 10;
    const startY = 10;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const dayOffset = (cols - 1 - col) * 7 + (6 - row);
        const d = new Date(todayDate);
        d.setDate(d.getDate() - dayOffset);
        const dayData = (dailyData || {})[localDateKey(d)];
        const count = dayData ? (dayData.studied || 0) : 0;
        ctx.fillStyle = getHeatmapCellColor(count);
        ctx.fillRect(startX + col * totalCell, startY + row * totalCell, cellSize, cellSize);
      }
    }

    const dayLabels = ['一', '', '三', '', '五', '', '日'];
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 7; i++) {
      ctx.fillText(dayLabels[i], 2, startY + i * totalCell + 9);
    }

    const legendX = startX;
    const legendY = startY + rows * totalCell + 6;
    ctx.fillText('少', legendX, legendY + 9);
    HEATMAP_COLORS.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(legendX + 20 + i * (cellSize + 2), legendY, cellSize, cellSize);
    });
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('多', legendX + 20 + 5 * (cellSize + 2) + 4, legendY + 9);
  }

  function renderAccuracyChartCanvas(canvas, dailyData) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return;
    const { ctx, width: w, height: h } = prepared;
    ctx.clearRect(0, 0, w, h);

    const dates = getRecentAccuracyDates(dailyData, 14);
    if (dates.length === 0) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据，开始学习后将显示正确率趋势', w / 2, h / 2);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 35 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const barWidth = Math.max(8, chartW / dates.length - 4);
    const barGap = 2;

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = padding.top + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(pct + '%', padding.left - 5, y + 4);
    }

    dates.forEach((dateStr, i) => {
      const dayData = dailyData[dateStr];
      const acc = dayData.total > 0 ? Math.round((dayData.correct / dayData.total) * 100) : 0;
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const barH = (acc / 100) * chartH;
      const y = padding.top + chartH - barH;
      const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      gradient.addColorStop(0, COLORS.ink);
      gradient.addColorStop(1, COLORS.inkSoft);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barH);

      if (i % 2 === 0) {
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr.slice(5), x + barWidth / 2, padding.top + chartH + 15);
      }
    });

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('近14天正确率趋势', w / 2, 14);
  }

  function canvasHasPaint(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return false;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  }

  function renderCategoryProgress(doc, container, allWords, progress, categoryColors) {
    const CATEGORIES = ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl'];
    const LABELS = {cet4:'CET-4', cet6:'CET-6', postgraduate:'考研', ielts:'雅思', toefl:'托福'};
    const CATEGORY_COLORS = categoryColors || {
      cet4: COLORS.ink,
      cet6: COLORS.success,
      postgraduate: COLORS.accent,
      ielts: COLORS.warning,
      toefl: COLORS.inkSoft
    };

    container.innerHTML = '';

    const grid = doc.createElement('div');
    grid.className = 'category-progress-grid';

    for (let ci = 0; ci < CATEGORIES.length; ci++) {
      const cat = CATEGORIES[ci];
      const words = allWords[cat] || [];
      const total = words.length;
      if (total === 0) continue;

      let learned = 0, mastered = 0, due = 0;
      const todayStr = localDateKey();
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        const key = w.word.toLowerCase() + '_' + cat;
        const card = progress[key];
        if (card && card.repetitions > 0) {
          learned++;
          if (isMasteredCard(card)) mastered++;
          if (card.nextReview && card.nextReview <= todayStr) due++;
        }
      }

      const pct = total > 0 ? Math.round((learned / total) * 100) : 0;

      const card = doc.createElement('div');
      card.className = 'cp-card';
      card.innerHTML =
        '<canvas class="cp-donut" width="90" height="90"></canvas>' +
        '<div class="cp-label">' + LABELS[cat] + '</div>' +
        '<div class="cp-stats">' +
          '<div class="cp-stat"><span class="cp-val">' + total + '</span><span class="cp-key">总词数</span></div>' +
          '<div class="cp-stat"><span class="cp-val">' + learned + '</span><span class="cp-key">已学习</span></div>' +
          '<div class="cp-stat"><span class="cp-val">' + mastered + '</span><span class="cp-key">已掌握</span></div>' +
          '<div class="cp-stat"><span class="cp-val">' + due + '</span><span class="cp-key">待复习</span></div>' +
        '</div>';
      grid.appendChild(card);

      const canvas = card.querySelector('.cp-donut');
      renderDonutChart(canvas, pct, CATEGORY_COLORS[cat]);
    }

    container.appendChild(grid);
  }

  function renderDonutChart(canvas, pct, color) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.width;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = size / 2 - 8, sw = 6;
    ctx.clearRect(0, 0, size, size);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = sw;
    ctx.stroke();

    // Foreground arc
    const angle = (pct / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = sw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center text
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', cx, cy);
  }

  function renderTestHistory(doc, container, testHistory) {
    if (!Array.isArray(testHistory) || testHistory.length === 0) {
      container.innerHTML = '<div class="backup-empty">暂无测试记录</div>';
      return;
    }

    const recent = testHistory.slice(-20).reverse();

    const table = doc.createElement('table');
    table.className = 'test-history-table';
    table.innerHTML = '<thead><tr><th>日期</th><th>词库</th><th>成绩</th><th>用时</th></tr></thead>';

    const tbody = doc.createElement('tbody');
    for (let i = 0; i < recent.length; i++) {
      const rec = recent[i];
      const pct = rec.total > 0 ? (rec.correct / rec.total * 100) : 0;
      const color = getAccuracyColor(pct);
      const mins = Math.floor((rec.duration || 0) / 60);
      const secs = (rec.duration || 0) % 60;
      const row = doc.createElement('tr');
      row.innerHTML =
        '<td>' + escapeHtml((rec.date || '').substring(0, 10)) + '</td>' +
        '<td>' + escapeHtml(rec.category || '') + '</td>' +
        '<td style="color:' + color + ';font-weight:700;">' + rec.correct + '/' + rec.total + '</td>' +
        '<td>' + mins + ':' + String(secs).padStart(2, '0') + '</td>';
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
  }

  function renderWeeklyReport(doc, container, report) {
    if (!container) return;
    const accuracyText = report.accuracy === null ? '-' : report.accuracy + '%';
    const bestDayText = report.bestDay && report.bestDay.studied > 0
      ? report.bestDay.date.slice(5) + ' · ' + report.bestDay.studied
      : '-';
    const escapedBestDayText = escapeHtml(bestDayText);
    container.innerHTML =
      '<div class="weekly-report-grid">' +
        '<div class="weekly-report-item"><strong>' + report.studied + '</strong><span>本周学习</span></div>' +
        '<div class="weekly-report-item"><strong>' + report.activeDays + '/7</strong><span>活跃天数</span></div>' +
        '<div class="weekly-report-item"><strong>' + report.goalDays + '</strong><span>达标天数</span></div>' +
        '<div class="weekly-report-item"><strong>' + accuracyText + '</strong><span>本周正确率</span></div>' +
        '<div class="weekly-report-item"><strong>' + report.averagePerActiveDay + '</strong><span>活跃日均</span></div>' +
        '<div class="weekly-report-item"><strong>' + escapedBestDayText + '</strong><span>最高学习日</span></div>' +
      '</div>' +
      '<div class="weekly-report-days">' +
        report.days.map(day => {
          const pct = Math.min(100, Math.round((day.studied / report.dailyGoal) * 100));
          return '<div class="weekly-day" title="' + escapeHtml(day.date) + '">' +
            '<span>' + escapeHtml(day.date.slice(5)) + '</span>' +
            '<div class="weekly-day-bar"><i style="height:' + pct + '%"></i></div>' +
            '<strong>' + day.studied + '</strong>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="weekly-suggestion">' + escapeHtml(report.suggestion) + '</div>';
  }

  function renderAchievements(doc, container, achievements) {
    if (!container) return;
    if (!Array.isArray(achievements) || achievements.length === 0) {
      container.innerHTML = '<div class="backup-empty">暂无成就</div>';
      return;
    }
    container.innerHTML = achievements.map(item =>
      '<div class="achievement-badge ' + (item.unlocked ? 'unlocked' : 'locked') + '" data-achievement-id="' + escapeHtml(item.id) + '">' +
        '<div class="achievement-mark">' + (item.unlocked ? '✓' : '·') + '</div>' +
        '<div><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.detail) + '</span></div>' +
      '</div>'
    ).join('');
  }

  function getAccuracyColor(pct) {
    if (pct >= 80) return COLORS.success;
    if (pct >= 60) return COLORS.warning;
    return COLORS.danger;
  }

  return {
    calculateStatsSummary,
    getRecentAccuracyDates,
    getHeatmapCellColor,
    isMasteredCard,
    buildWeeklyReport,
    buildAchievements,
    renderStatsSummary,
    renderHeatmapCanvas,
    renderAccuracyChartCanvas,
    canvasHasPaint,
    renderCategoryProgress,
    renderDonutChart,
    renderTestHistory,
    renderWeeklyReport,
    renderAchievements,
    getAccuracyColor
  };
});
