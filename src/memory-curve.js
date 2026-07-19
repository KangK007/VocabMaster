(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterMemoryCurve = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function learnedCards(progress) {
    return Object.values(progress || {})
      .filter(card => card && (card.repetitions || 0) > 0);
  }

  function estimateCardRetention(card, day) {
    const interval = Math.max(1, Number(card.interval) || 1);
    const ef = Math.max(1.3, Number(card.ef) || 2.5);
    const repetitions = Math.max(0, Number(card.repetitions) || 0);
    const lapses = Math.max(0, Number(card.lapses) || 0);
    const stability = Math.max(1, interval * ef * (1 + repetitions * 0.18));
    const lapsePenalty = Math.max(0.58, 1 - lapses * 0.08);
    return Math.max(0, Math.min(100, 100 * Math.exp(-day / stability) * lapsePenalty));
  }

  function aggregateRetention(progress, days = 30) {
    const totalDays = Math.max(7, Math.min(30, Number(days) || 30));
    const cards = learnedCards(progress);
    const result = [];
    for (let day = 0; day <= totalDays; day += 1) {
      const ideal = Math.round(100 * Math.exp(-day / 9));
      const personal = cards.length > 0
        ? Math.round(cards.reduce((sum, card) => sum + estimateCardRetention(card, day), 0) / cards.length)
        : null;
      result.push({
        day,
        label: day === 0 ? 'D0' : `D${day}`,
        ideal,
        personal
      });
    }
    return result;
  }

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const dpr = (canvas.ownerDocument && canvas.ownerDocument.defaultView && canvas.ownerDocument.defaultView.devicePixelRatio) || 1;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
    const width = rect.width || canvas.width || 620;
    const height = rect.height || canvas.height || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    return { ctx, width, height };
  }

  function drawLine(ctx, points, style) {
    if (!points.length) return;
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width || 2;
    if (style.dash) ctx.setLineDash(style.dash);
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function renderMemoryCurve(canvas, progress, options = {}) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return [];
    const { ctx, width, height } = prepared;
    const days = Math.max(7, Math.min(30, Number(options.days) || 14));
    const data = aggregateRetention(progress, days);
    const isDark = Boolean(options.darkMode);
    const colors = {
      axis: isDark ? '#2a2d35' : '#e5dfd3',
      text: isDark ? '#9a948a' : '#8b8794',
      title: isDark ? '#e8ddca' : '#1c1c28',
      personal: isDark ? '#8090cc' : '#2d3561',
      ideal: isDark ? 'rgba(212, 168, 50, 0.55)' : 'rgba(184, 134, 11, 0.38)',
      empty: isDark ? '#9a948a' : '#8b8794'
    };
    const padding = { top: 24, right: 24, bottom: 34, left: 42 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.title;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('个人记忆保持率 vs 理想参考曲线', width / 2, 14);

    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.text;
    ctx.font = '10px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'right';
    for (let pct = 0; pct <= 100; pct += 20) {
      const y = padding.top + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${pct}%`, padding.left - 6, y + 3);
    }

    const xFor = day => padding.left + (day / days) * chartW;
    const yFor = pct => padding.top + chartH - (pct / 100) * chartH;
    const idealPoints = data.map(point => ({ x: xFor(point.day), y: yFor(point.ideal) }));
    const personalPoints = data
      .filter(point => point.personal !== null)
      .map(point => ({ x: xFor(point.day), y: yFor(point.personal) }));

    drawLine(ctx, idealPoints, { color: colors.ideal, width: 2, dash: [5, 5] });
    drawLine(ctx, personalPoints, { color: colors.personal, width: 2.5 });

    const markers = [0, 1, 3, 7, 14, 30].filter(day => day <= days);
    ctx.fillStyle = colors.text;
    ctx.font = '10px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    markers.forEach(day => {
      const x = xFor(day);
      ctx.fillText(day === 0 ? 'D0' : `D${day}`, x, height - 12);
    });

    if (personalPoints.length === 0) {
      ctx.fillStyle = colors.empty;
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('开始学习后将显示你的个人记忆曲线', width / 2, padding.top + chartH / 2);
    } else {
      ctx.fillStyle = colors.personal;
      personalPoints.forEach((point, index) => {
        if (index % Math.max(1, Math.floor(personalPoints.length / 6)) !== 0 && index !== personalPoints.length - 1) return;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.textAlign = 'left';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.personal;
    ctx.fillText('个人', padding.left, padding.top + 10);
    ctx.fillStyle = colors.ideal;
    ctx.fillText('理想参考', padding.left + 44, padding.top + 10);
    return data;
  }

  return {
    aggregateRetention,
    estimateCardRetention,
    renderMemoryCurve
  };
});
