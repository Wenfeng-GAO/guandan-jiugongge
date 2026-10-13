/* 掼蛋九宫格记牌练习 - 开局扫牌（v6：8 秒闪牌 → 盖牌 → 统一九宫格填外剩 → 只重练错格） */
/* global GuandanLogic, GuandanGrid */
(function () {
  'use strict';
  var L = GuandanLogic;
  var G = GuandanGrid;

  var FLASH_MS = 8000;
  var SCAN_KEYS = ['level', 'big', 'small'];

  // phase: off | flash | answer | feedback
  var state = {
    phase: 'off',
    levelRank: L.DEFAULT_LEVEL_RANK,
    hand: [],
    outside: null,
    askedKeys: SCAN_KEYS.slice(),
    grid: null,
    results: null,
    wrongKeys: [],
    timerId: null,
    deadline: 0
  };

  var els = {};

  // —— v7 整场会话钩子（session.js 提供；防御式调用） ——
  function S() { return window.GuandanSession || null; }

  // —— 视图切换（grid.js → scan.js → app.js / sim.js 共用；scan.js 先于 app.js 加载） ——
  window.GuandanNav = {
    show: function (name) {
      ['home', 'scan', 'closed', 'sim', 'summary'].forEach(function (v) {
        var node = document.getElementById('view-' + v);
        if (node) node.classList.toggle('hidden', v !== name);
      });
      window.scrollTo(0, 0);
    }
  };

  function div(cls, text) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function makeBackButton(onBack) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-back';
    b.setAttribute('data-testid', 'btn-back');
    b.textContent = '← 返回';
    b.addEventListener('click', onBack);
    return b;
  }

  function fmtTime(ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    state.deadline = Date.now() + FLASH_MS;
    state.timerId = setInterval(tick, 100);
    tick();
  }

  function tick() {
    var remain = state.deadline - Date.now();
    if (remain <= 0) {
      stopTimer();
      state.phase = 'answer';
      var s0 = S();
      if (s0) s0.setAnswering(true);
      render();
      return;
    }
    var cd = document.querySelector('[data-testid="scan-countdown"]');
    if (cd) cd.textContent = fmtTime(remain);
    var fill = document.getElementById('scan-progress-fill');
    if (fill) fill.style.width = (remain / FLASH_MS * 100) + '%';
  }

  // —— 闪牌 ——
  function makeScanCard(card) {
    var c = div('scan-card');
    var isJoker = card.rank === L.BIG_JOKER || card.rank === L.SMALL_JOKER;
    var isLevel = L.isLevelCard(card, state.levelRank);
    var isWild = L.isWild(card, state.levelRank);
    if (isJoker) {
      c.textContent = card.rank;
      c.classList.add('red', 'tight');
    } else if (isWild) {
      c.textContent = '♥' + card.rank;
      c.classList.add('red');
    } else {
      c.textContent = card.rank;
      if (card.suit === '♥' || card.suit === '♦') c.classList.add('red');
      if (card.rank === '10') c.classList.add('tight');
    }
    if (isLevel) {
      c.classList.add('lvl');
      c.setAttribute('data-level', '1');
    }
    if (isWild) c.setAttribute('data-wild', '1');
    c.setAttribute('data-testid', 'scan-card');
    return c;
  }

  function renderFlash(root) {
    var panel = div('scan-panel');

    panel.appendChild(div('scan-title', '看手牌'));
    panel.appendChild(div('scan-sub', '已按点数排好 · 只盯 级 / 大王 / 小王'));

    var timer = div('scan-timer');
    timer.appendChild(div('scan-timer-label', '剩余'));
    var cd = div('scan-countdown', fmtTime(FLASH_MS));
    cd.setAttribute('data-testid', 'scan-countdown');
    timer.appendChild(cd);
    panel.appendChild(timer);

    var progress = div('scan-progress');
    var fill = document.createElement('i');
    fill.id = 'scan-progress-fill';
    progress.appendChild(fill);
    panel.appendChild(progress);

    var hand = div('scan-hand');
    hand.setAttribute('data-testid', 'scan-hand');
    state.hand.forEach(function (card) {
      hand.appendChild(makeScanCard(card));
    });
    panel.appendChild(hand);

    panel.appendChild(div('scan-note',
      '级牌金框（含 ♥' + state.levelRank + ' 逢人配，也算「级」）· 8 秒后自动盖牌，不能回看'));
    root.appendChild(panel);
  }

  // —— 盖牌填外剩 / 反馈（统一九宫格作答） ——
  function destroyGrid() {
    if (state.grid) {
      state.grid.destroy();
      state.grid = null;
    }
  }

  function truthSlot(slot) {
    return state.outside[slot];
  }

  function renderAnswer(root, isFeedback) {
    var panel = div('scan-panel');

    if (!isFeedback) {
      panel.appendChild(div('scan-title', '外面还剩几？'));
      panel.appendChild(div('scan-sub', '外剩 = 总张 − 你手里的 · 点格子选中，用下方数字键'));
      panel.appendChild(div('scan-cover', '▢ 手牌已盖 · 闭卷'));
    } else {
      var wrongN = state.wrongKeys.length;
      panel.appendChild(div('scan-title', wrongN > 0 ? wrongN + ' 格错' : '全对'));
      panel.appendChild(div('scan-sub',
        '你手里：级 ' + (L.COPIES_PER_RANK - state.outside.level) +
        ' · 大王 ' + (L.COPIES_PER_JOKER - state.outside.big) +
        ' · 小王 ' + (L.COPIES_PER_JOKER - state.outside.small)));
    }

    var gridSlot = div('ans-grid-slot');
    panel.appendChild(gridSlot);
    state.grid = G.createAnswerGrid({
      container: gridSlot,
      levelRank: state.levelRank,
      askedKeys: state.askedKeys,
      label: '外剩',
      onChange: function () { renderAnswerActions(panel, isFeedback); }
    });
    if (isFeedback) {
      if (state.gridGuesses) state.grid.setGuesses(state.gridGuesses);
      var truth = { level: truthSlot('level'), big: truthSlot('big'), small: truthSlot('small') };
      state.grid.showFeedback(truth);
    }

    renderAnswerActions(panel, isFeedback);
    root.appendChild(panel);
  }

  function renderAnswerActions(panel, isFeedback) {
    var old = panel.querySelector('.scan-actions');
    if (old) panel.removeChild(old);

    var actions = div('scan-actions');
    if (!isFeedback) {
      var checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'btn btn-primary';
      checkBtn.setAttribute('data-testid', 'btn-check');
      checkBtn.textContent = '核对';
      checkBtn.disabled = !(state.grid && state.grid.allChosen());
      checkBtn.addEventListener('click', check);
      actions.appendChild(checkBtn);
    } else {
      var hasWrong = state.wrongKeys.length > 0;
      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-primary';
      next.setAttribute('data-testid', 'btn-next');
      next.textContent = hasWrong ? '再闪一盘' : '下一盘';
      next.addEventListener('click', function () { startRound(SCAN_KEYS.slice()); });
      actions.appendChild(next);
      if (hasWrong) {
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-secondary';
        retry.setAttribute('data-testid', 'btn-retry-wrong');
        retry.textContent = '只重练错的格';
        retry.addEventListener('click', function () { startRound(state.wrongKeys.slice()); });
        actions.appendChild(retry);
      }
    }
    panel.appendChild(actions);
  }

  function render() {
    var root = els.root;
    if (!root) return;
    destroyGrid();
    root.innerHTML = '';
    if (state.phase === 'flash') renderFlash(root);
    else if (state.phase === 'answer') renderAnswer(root, false);
    else if (state.phase === 'feedback') renderAnswer(root, true);
  }

  function check() {
    if (state.phase !== 'answer' || !state.grid || !state.grid.allChosen()) return;
    state.gridGuesses = state.grid.getGuesses();
    state.results = L.checkScan(state.gridGuesses, state.outside, state.askedKeys);
    state.wrongKeys = state.results
      .filter(function (r) { return !r.ok; })
      .map(function (r) { return r.key; });
    state.phase = 'feedback';
    var s = S();
    if (s) {
      s.setAnswering(false);
      s.roundFinished('scan', state.wrongKeys.length === 0);
    }
    render();
  }

  // v7：闪牌期间暂停 → 停表；恢复 → 重新完整闪 8 秒
  function restartFlash() {
    if (state.phase !== 'flash') return;
    state.deadline = Date.now() + FLASH_MS;
    render();
    startTimer();
  }

  function onSessionPause() {
    if (state.phase === 'flash') stopTimer();
  }

  function onSessionResume() {
    restartFlash();
  }

  function startRound(askedKeys) {
    stopTimer();
    var levelSelect = document.getElementById('level-select');
    var level = (levelSelect && levelSelect.value) || L.DEFAULT_LEVEL_RANK;
    var deal = L.dealScanHand(level);
    state.levelRank = level;
    state.hand = deal.hand;
    state.outside = deal.outside;
    state.askedKeys = askedKeys.slice();
    state.results = null;
    state.wrongKeys = [];
    state.gridGuesses = null;
    state.phase = 'flash';
    var s = S();
    if (s) {
      s.setAnswering(false);
      s.roundStarted('scan');
    }
    render();
    startTimer();
  }

  function goHome() {
    stopTimer();
    destroyGrid();
    state.phase = 'off';
    render();
    document.getElementById('scan-back-slot').innerHTML = '';
    window.GuandanNav.show('home');
  }

  function enterScan() {
    window.GuandanNav.show('scan');
    var slot = document.getElementById('scan-back-slot');
    slot.innerHTML = '';
    slot.appendChild(makeBackButton(goHome));
    startRound(SCAN_KEYS.slice());
  }

  window.__scanDebug = {
    getOutside: function () { return state.outside; },
    state: state
  };

  function init() {
    els.root = document.getElementById('scan-root');
    var entry = document.querySelector('[data-testid="entry-scan"]');
    if (entry) entry.addEventListener('click', enterScan);
    var s = S();
    if (s) {
      s.onPause(onSessionPause);
      s.onResume(onSessionResume);
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
