/* 掼蛋九宫格记牌练习 - v7 整场会话（timer.js 之后加载）
 * 职责：建一个 GuandanTimer（默认 15 分钟，URL ?t=秒 可改）、页面切后台自动暂停、
 * 250ms tick；顶栏计时小组件（mm:ss + 暂停钮 + 2px 进度线）；暂停盖屏；小结视图。
 * 关卡只调 window.GuandanSession 的通用钩子，不直接接触计时器细节。
 */
/* global GuandanTimer */
(function () {
  'use strict';

  var DEFAULT_DURATION_MS = 15 * 60 * 1000;

  function queryDurationMs() {
    try {
      var q = new URLSearchParams(window.location.search).get('t');
      var sec = q == null ? NaN : parseInt(q, 10);
      if (isFinite(sec) && sec > 0) return sec * 1000;
    } catch (e) { /* 忽略，用默认 */ }
    return DEFAULT_DURATION_MS;
  }

  var durationMs = queryDurationMs();
  var timer = GuandanTimer.create({ durationMs: durationMs, levels: GuandanTimer.DEFAULT_LEVELS });
  var answering = false;   // 闭卷作答阶段：组件淡化到 35% 但照走
  var pauseFns = [];
  var resumeFns = [];
  var summaryReadyFns = []; // v7.1：时间到 + 最后一盘核对完 → 通知关卡换「看小结」按钮
  var widgets = [];        // 每个关卡顶栏一份小组件
  var tickId = null;
  var els = {};

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtMs(ms) {
    if (ms < 0) ms = 0;
    var t = Math.floor(ms / 1000);
    return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
  }

  function dispatch(list) {
    list.slice().forEach(function (fn) { fn(); });
  }

  // —— 顶栏小组件 + 暂停盖屏 渲染 ——
  function updateWidget() {
    var s = timer.getState();
    var paused = s.status === 'paused';
    var timeup = s.status === 'timeup';
    var dim = answering && !paused;
    var label = paused ? '已暂停 ' + fmtMs(s.remainingMs) : s.label;
    widgets.forEach(function (w) {
      w.label.textContent = label;
      w.btn.textContent = paused ? '▶' : 'Ⅱ';
      w.btn.disabled = s.status === 'idle' || timeup;
      w.wrap.classList.toggle('pause', paused);
      w.wrap.classList.toggle('dim', dim);
      w.line.classList.toggle('dim', dim);
      w.fill.style.width = (s.progress * 100) + '%';
    });
    // v7.1：只有关卡视图（扫牌/闭卷/实战顶栏）可见时才盖屏；首页/小结不盖
    var levelVisible = !!document.querySelector('.view:not(.hidden) .mode-topbar');
    if (els.cover) els.cover.classList.toggle('hidden', !(paused && levelVisible));
    if (els.cover && paused && levelVisible) {
      // 只盖当前这盘：顶栏（灰数字 + ▶）和进度线留在外面
      var bar = null;
      document.querySelectorAll('.view:not(.hidden) .mode-topbar').forEach(function (b) { bar = b; });
      var line = bar && bar.parentNode.querySelector('[data-testid="timer-line"]');
      var edge = line || bar;
      els.cover.style.top = edge ? Math.ceil(edge.getBoundingClientRect().bottom + 4) + 'px' : '0px';
    }
  }

  function wire(t) {
    t.on('change', updateWidget);
    t.on('pause', function () { dispatch(pauseFns); updateWidget(); });
    t.on('resume', function () { dispatch(resumeFns); updateWidget(); });
    t.on('summary', function () { dispatch(summaryReadyFns); updateWidget(); });
  }

  function startTicker() {
    if (tickId) clearInterval(tickId);
    tickId = setInterval(function () { timer.tick(); }, 250);
  }

  // —— 小结 ——
  function showSummary() {
    if (timer.getState().status !== 'summary') return;
    var sum = timer.getSummary();
    var mins = Math.max(1, Math.round(durationMs / 60000));
    els.sumTitle.textContent = '这一场 ' + mins + ' 分钟';
    els.sumAgain.textContent = '再来 ' + mins + ' 分钟';
    els.sumTotal.textContent = sum.total + ' 盘';
    els.sumCorrect.textContent = '全对 ' + sum.totalCorrect + ' 盘';
    sum.rows.forEach(function (row) {
      var cell = document.querySelector('[data-testid="summary-row-' + row.id + '"] .sum-row-val');
      if (cell) cell.textContent = row.text;
    });
    window.GuandanNav.show('summary');
  }

  function endSessionGoHome() {
    timer.reset();
    window.GuandanNav.show('home');
  }

  // —— 顶栏小组件（每个 .mode-topbar 一份，状态同源） ——
  function buildWidget(topbar) {
    var streak = topbar.querySelector('.streak-info');
    if (streak) streak.style.marginLeft = '0'; // 计时器占最右，连对信息紧跟其左

    var wrap = document.createElement('span');
    wrap.className = 'tm';
    wrap.setAttribute('data-testid', 'timer');
    var label = document.createElement('span');
    label.className = 'tm-label';
    label.setAttribute('data-testid', 'timer-label');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-btn';
    btn.setAttribute('data-testid', 'timer-btn');
    btn.textContent = 'Ⅱ';
    btn.addEventListener('click', function () { timer.togglePause(); });
    wrap.appendChild(label);
    wrap.appendChild(btn);
    topbar.appendChild(wrap);

    var line = document.createElement('div');
    line.className = 'tm-line';
    line.setAttribute('data-testid', 'timer-line');
    var fill = document.createElement('i');
    line.appendChild(fill);
    topbar.parentNode.insertBefore(line, topbar.nextSibling);

    widgets.push({ wrap: wrap, label: label, btn: btn, line: line, fill: fill });
  }

  function buildCover() {
    var cover = document.createElement('div');
    cover.className = 'pause-cover hidden';
    cover.setAttribute('data-testid', 'pause-cover');
    var title = document.createElement('div');
    title.className = 'pause-cover-title';
    title.textContent = '已暂停';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.setAttribute('data-testid', 'pause-resume');
    btn.textContent = '▶ 继续';
    btn.addEventListener('click', function () { timer.resume(); });
    cover.appendChild(title);
    cover.appendChild(btn);
    document.body.appendChild(cover);
    return cover;
  }

  // —— 对关卡暴露的通用钩子 ——
  window.GuandanSession = {
    roundStarted: function (id) { timer.roundStarted(id); },
    roundFinished: function (id, allCorrect) { timer.roundFinished(id, allCorrect); },
    setAnswering: function (b) { answering = !!b; updateWidget(); },
    // v7.2：关卡开盘/起表前查询——已暂停（含回首页保持暂停、切后台）时不得起闪牌/翻牌计时
    isPaused: function () { return timer.isPaused(); },
    onPause: function (fn) { if (typeof fn === 'function') pauseFns.push(fn); },
    onResume: function (fn) { if (typeof fn === 'function') resumeFns.push(fn); },
    // v7.1：时间到且最后一盘已核对 → 小结就绪；反馈保留，点「看小结」才进小结
    isSummaryReady: function () { return timer.getState().status === 'summary'; },
    onSummaryReady: function (fn) { if (typeof fn === 'function') summaryReadyFns.push(fn); },
    showSummary: showSummary
  };
  Object.defineProperty(window.GuandanSession, 'timer', {
    get: function () { return timer; }
  });

  // 调试钩子：?t=秒 之外，还能运行时改时长（重建计时器并重挂）
  window.__timerDebug = {
    setDuration: function (sec) {
      sec = parseInt(sec, 10);
      if (!isFinite(sec) || sec <= 0) return timer;
      durationMs = sec * 1000;
      timer = GuandanTimer.create({ durationMs: durationMs, levels: GuandanTimer.DEFAULT_LEVELS });
      answering = false;
      wire(timer);
      timer.attachVisibility(document);
      startTicker();
      updateWidget();
      return timer;
    }
  };
  Object.defineProperty(window.__timerDebug, 'timer', {
    get: function () { return timer; }
  });

  function init() {
    var topbars = document.querySelectorAll('.mode-topbar');
    for (var i = 0; i < topbars.length; i++) buildWidget(topbars[i]);
    els.cover = buildCover();
    els.sumTitle = document.getElementById('summary-title');
    els.sumTotal = document.getElementById('summary-total');
    els.sumCorrect = document.getElementById('summary-correct');
    els.sumAgain = document.querySelector('[data-testid="summary-again"]');
    els.sumHome = document.querySelector('[data-testid="summary-home"]');
    if (els.sumAgain) els.sumAgain.addEventListener('click', endSessionGoHome);
    if (els.sumHome) els.sumHome.addEventListener('click', endSessionGoHome);
    wire(timer);
    timer.attachVisibility(document);
    startTicker();
    updateWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
