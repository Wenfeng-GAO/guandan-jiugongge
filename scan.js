/* 掼蛋九宫格记牌练习 - 开局扫牌（v5：8 秒闪牌 → 盖牌 → 填外剩 → 只重练错格） */
/* global GuandanLogic */
(function () {
  'use strict';
  var L = GuandanLogic;

  var FLASH_MS = 8000;
  var SCAN_KEYS = ['level', 'big', 'small'];

  var KEY_META = {
    level: { testid: 'cell-level', badge: true, name: function (s) { return s.levelRank; } },
    big: { testid: 'cell-big', badge: false, name: function () { return L.BIG_JOKER; } },
    small: { testid: 'cell-small', badge: false, name: function () { return L.SMALL_JOKER; } }
  };

  // phase: off | flash | answer | feedback
  var state = {
    phase: 'off',
    levelRank: L.DEFAULT_LEVEL_RANK,
    hand: [],
    outside: null,
    askedKeys: SCAN_KEYS.slice(),
    guesses: {},
    results: null,
    wrongKeys: [],
    timerId: null,
    deadline: 0
  };

  var els = {};

  // —— 视图切换（app.js 共用；scan.js 先于 app.js 加载） ——
  window.GuandanNav = {
    show: function (name) {
      ['home', 'scan', 'closed'].forEach(function (v) {
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

  // —— 盖牌填外剩 / 反馈 ——
  // 考键 → numberOptions 用的点数键：级 → 当前级牌，王 → 大小王
  function optionsKey(scanKey) {
    if (scanKey === 'level') return state.levelRank;
    if (scanKey === 'big') return L.BIG_JOKER;
    return L.SMALL_JOKER;
  }

  function findResult(key) {
    if (!state.results) return null;
    for (var i = 0; i < state.results.length; i++) {
      if (state.results[i].key === key) return state.results[i];
    }
    return null;
  }

  function allChosen() {
    return state.askedKeys.every(function (k) { return state.guesses[k] != null; });
  }

  function makeNumButton(scanKey, n, dense) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'num-btn' + (dense ? ' dense' : '');
    b.textContent = String(n);
    b.setAttribute('data-testid', 'num-' + scanKey + '-' + n);
    if (state.phase === 'answer') {
      if (state.guesses[scanKey] === n) b.classList.add('selected');
      b.addEventListener('click', function () { pickNumber(scanKey, n); });
    } else {
      var res = findResult(scanKey);
      if (res && state.guesses[scanKey] === n) b.classList.add(res.ok ? 'ok' : 'bad');
      b.disabled = true;
    }
    return b;
  }

  function makeScanCell(scanKey) {
    var meta = KEY_META[scanKey];
    var wrap = div('scan-cell');
    wrap.setAttribute('data-testid', meta.testid);

    var head = div('scan-cell-head');
    if (meta.badge) head.appendChild(div('scan-badge', '级'));
    head.appendChild(div('scan-cell-name', meta.name(state)));
    head.appendChild(div('scan-cell-sub', '外剩'));
    var res = findResult(scanKey);
    if (res) {
      var verdict = div('scan-verdict');
      if (res.ok) {
        wrap.classList.add('ok');
        verdict.textContent = '✓ 正确';
      } else {
        wrap.classList.add('bad');
        verdict.textContent = '✕ 应为 ' + res.truth;
      }
      head.appendChild(verdict);
    }
    wrap.appendChild(head);

    var row = div('num-row');
    var opts = L.numberOptions(optionsKey(scanKey));
    var dense = opts.length > 4;
    opts.forEach(function (n) {
      row.appendChild(makeNumButton(scanKey, n, dense));
    });
    wrap.appendChild(row);
    return wrap;
  }

  function renderAnswer(root, isFeedback) {
    var panel = div('scan-panel');

    if (!isFeedback) {
      panel.appendChild(div('scan-title', '外面还剩几？'));
      panel.appendChild(div('scan-sub', '外剩 = 总张 − 你手里的 · 直接点数字'));
      panel.appendChild(div('scan-cover', '▢ 手牌已盖 · 闭卷'));
    } else {
      var wrongN = state.wrongKeys.length;
      panel.appendChild(div('scan-title', wrongN > 0 ? wrongN + ' 格错' : '全对'));
      panel.appendChild(div('scan-sub',
        '你手里：级 ' + (L.COPIES_PER_RANK - state.outside.level) +
        ' · 大王 ' + (L.COPIES_PER_JOKER - state.outside.big) +
        ' · 小王 ' + (L.COPIES_PER_JOKER - state.outside.small)));
    }

    state.askedKeys.forEach(function (k) {
      panel.appendChild(makeScanCell(k));
    });

    var actions = div('scan-actions');
    if (!isFeedback) {
      var checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'btn btn-primary';
      checkBtn.setAttribute('data-testid', 'btn-check');
      checkBtn.textContent = '核对';
      checkBtn.disabled = !allChosen();
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
    root.appendChild(panel);
  }

  function render() {
    var root = els.root;
    if (!root) return;
    root.innerHTML = '';
    if (state.phase === 'flash') renderFlash(root);
    else if (state.phase === 'answer') renderAnswer(root, false);
    else if (state.phase === 'feedback') renderAnswer(root, true);
  }

  function pickNumber(scanKey, n) {
    if (state.phase !== 'answer') return;
    state.guesses[scanKey] = n;
    render();
  }

  function check() {
    if (state.phase !== 'answer' || !allChosen()) return;
    state.results = L.checkScan(state.guesses, state.outside, state.askedKeys);
    state.wrongKeys = state.results
      .filter(function (r) { return !r.ok; })
      .map(function (r) { return r.key; });
    state.phase = 'feedback';
    render();
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
    state.guesses = {};
    state.askedKeys.forEach(function (k) { state.guesses[k] = undefined; });
    state.results = null;
    state.wrongKeys = [];
    state.phase = 'flash';
    render();
    startTimer();
  }

  function goHome() {
    stopTimer();
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
    getOutside: function () { return state.outside; }
  };

  function init() {
    els.root = document.getElementById('scan-root');
    var entry = document.querySelector('[data-testid="entry-scan"]');
    if (entry) entry.addEventListener('click', enterScan);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
