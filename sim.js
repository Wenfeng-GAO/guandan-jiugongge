/* 掼蛋九宫格记牌练习 - 实战模拟（v6：闪手牌 → 自动翻牌 → 随机停 → 闭卷作答 → 三段反馈）
 * 节奏与停点全由游戏控制：8 秒闪牌、每张翻 1.5 秒、翻过 N 张（连对升档 10–30 → 20–50）喊停。
 */
/* global GuandanLogic, GuandanGrid, GuandanNav */
(function () {
  'use strict';
  var L = GuandanLogic;
  var G = GuandanGrid;

  var FLASH_MS = 8000;
  var SIM_KEYS = ['level', 'big', 'small'];

  // phase: off | flash | flip | stop | feedback
  var state = {
    phase: 'off',
    levelRank: L.DEFAULT_LEVEL_RANK,
    round: null,        // dealSimRound 结果
    streakState: { streak: 0, upgraded: false },
    flipIndex: 0,       // 已翻张数
    flipMs: L.SIM_FLIP_MS,
    timerId: null,
    flipTimeout: null,
    deadline: 0,
    grid: null,
    results: null,
    wrongKeys: [],
    reviewing: false,
    prevPhase: null
  };

  var els = {};

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

  function stopTimers() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.flipTimeout) {
      clearTimeout(state.flipTimeout);
      state.flipTimeout = null;
    }
  }

  // —— 手牌/翻牌共用的单张牌面 ——
  function cardText(card) {
    var isJoker = card.rank === L.BIG_JOKER || card.rank === L.SMALL_JOKER;
    var isWild = !isJoker && L.isWild(card, state.levelRank);
    if (isJoker) return card.rank;
    if (isWild) return '♥' + card.rank;
    return card.suit + card.rank;
  }

  function decorateCard(el, card) {
    var isJoker = card.rank === L.BIG_JOKER || card.rank === L.SMALL_JOKER;
    if (isJoker) {
      el.textContent = card.rank;
      el.classList.add('red', 'tight');
    } else {
      el.textContent = card.suit + card.rank;
      if (card.suit === '♥' || card.suit === '♦') el.classList.add('red');
      if (card.rank === '10') el.classList.add('tight');
    }
    if (L.isLevelCard(card, state.levelRank)) el.classList.add('lvl');
    return el;
  }

  // —— 状态 01 闪手牌 ——
  function renderFlash(root) {
    var panel = div('scan-panel');

    panel.appendChild(div('scan-title', '看手牌'));
    panel.appendChild(div('scan-sub', '已按点数排好 · 先在心里算好外剩'));

    var timer = div('scan-timer');
    timer.appendChild(div('scan-timer-label', '剩余'));
    var cd = div('scan-countdown', fmtTime(FLASH_MS));
    cd.setAttribute('data-testid', 'sim-countdown');
    timer.appendChild(cd);
    panel.appendChild(timer);

    var progress = div('scan-progress');
    var fill = document.createElement('i');
    fill.id = 'sim-progress-fill';
    progress.appendChild(fill);
    panel.appendChild(progress);

    var hand = div('scan-hand');
    hand.setAttribute('data-testid', 'sim-hand');
    state.round.hand.forEach(function (card) {
      var c = decorateCard(div('scan-card'), card);
      if (L.isWild(card, state.levelRank)) c.setAttribute('data-wild', '1');
      c.setAttribute('data-testid', 'sim-card');
      hand.appendChild(c);
    });
    panel.appendChild(hand);

    panel.appendChild(div('scan-note',
      '级牌金框（含 ♥' + state.levelRank + ' 逢人配，也算「级」）· 8 秒后自动盖牌，不能回看'));
    root.appendChild(panel);
  }

  function startFlashTimer() {
    state.deadline = Date.now() + FLASH_MS;
    state.timerId = setInterval(function () {
      var remain = state.deadline - Date.now();
      if (remain <= 0) {
        stopTimers();
        state.phase = 'flip';
        state.flipIndex = 0;
        scheduleNextFlip();
        return;
      }
      var cd = document.querySelector('[data-testid="sim-countdown"]');
      if (cd) cd.textContent = fmtTime(remain);
      var fill = document.getElementById('sim-progress-fill');
      if (fill) fill.style.width = (remain / FLASH_MS * 100) + '%';
    }, 100);
  }

  // —— 状态 02 自动翻牌 ——
  function renderFlipStage(root) {
    var panel = div('scan-panel');

    panel.appendChild(div('scan-title', '别人在出牌'));
    panel.appendChild(div('scan-sub', '每张 ' + (state.flipMs / 1000) + ' 秒 · 不显示张数和进度 · 边看边减'));

    panel.appendChild(div('scan-cover', '▢ 手牌已盖'));

    var stage = div('sim-stage');
    stage.setAttribute('data-testid', 'sim-stage');
    var card = state.round.flips[state.flipIndex - 1];
    var big = decorateCard(div('sim-flip-card'), card);
    big.setAttribute('data-testid', 'sim-flip-card');
    stage.appendChild(big);
    stage.appendChild(div('sim-stage-label', '上家出'));
    panel.appendChild(stage);

    // 只表示这一张的细进度条
    var beat = div('sim-beat');
    var fill = document.createElement('i');
    beat.appendChild(fill);
    panel.appendChild(beat);
    requestAnimationFrame(function () {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      requestAnimationFrame(function () {
        fill.style.transition = 'width ' + state.flipMs + 'ms linear';
        fill.style.width = '100%';
      });
    });

    panel.appendChild(div('scan-note', '细条只表示这一张的 ' + (state.flipMs / 1000) + ' 秒 · 没有「下一张」「结束」按钮'));
    root.appendChild(panel);
  }

  function enterStop() {
    state.phase = 'stop';
    var s = window.GuandanSession;
    if (s) s.setAnswering(true);
    render();
  }

  function armFlipTimeout() {
    if (state.phase !== 'flip') return;
    state.flipTimeout = setTimeout(function () {
      state.flipTimeout = null;
      if (state.flipIndex >= state.round.n) {
        enterStop();
      } else {
        scheduleNextFlip();
      }
    }, state.flipMs);
  }

  function scheduleNextFlip() {
    if (state.phase !== 'flip') return;
    if (state.flipIndex >= state.round.n) {
      enterStop();
      return;
    }
    // 先翻一张再渲染：舞台始终展示 flips[flipIndex-1]（当前亮着的牌）
    state.flipIndex += 1;
    render();
    armFlipTimeout();
  }

  // —— 状态 03 随机停牌 · 闭卷作答 ——
  function destroyGrid() {
    if (state.grid) {
      state.grid.destroy();
      state.grid = null;
    }
  }

  function renderStop(root) {
    var panel = div('scan-panel');

    var stopBox = div('sim-stop');
    stopBox.setAttribute('data-testid', 'sim-stop');
    stopBox.appendChild(div('sim-stop-title', '停！闭卷作答'));
    stopBox.appendChild(div('sim-stop-sub', '外剩 = 总张 − 手牌 − 翻过的'));
    panel.appendChild(stopBox);

    var gridSlot = div('ans-grid-slot');
    panel.appendChild(gridSlot);
    state.grid = G.createAnswerGrid({
      container: gridSlot,
      levelRank: state.levelRank,
      askedKeys: SIM_KEYS,
      label: '外剩',
      onChange: function () { renderAnswerActions(panel); }
    });

    renderAnswerActions(panel);
    root.appendChild(panel);
  }

  function renderAnswerActions(panel) {
    var old = panel.querySelector('.scan-actions');
    if (old) panel.removeChild(old);
    var actions = div('scan-actions');
    var checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'btn btn-primary';
    checkBtn.setAttribute('data-testid', 'btn-check');
    checkBtn.textContent = '核对';
    checkBtn.disabled = !(state.grid && state.grid.allChosen());
    checkBtn.addEventListener('click', check);
    actions.appendChild(checkBtn);
    panel.appendChild(actions);
  }

  // —— 状态 04 三段反馈 ——
  function keyLabel(key) {
    if (key === 'level') return '级';
    return key;
  }

  function renderFeedback(root) {
    var panel = div('scan-panel');
    var n = state.round.n;
    var wrongN = state.wrongKeys.length;

    panel.appendChild(div('scan-title', '翻了 ' + n + ' 张 · ' + (wrongN > 0 ? wrongN + ' 格错 ✕' : '全对 ✓')));

    var breakdown = div('sim-breakdown');
    breakdown.setAttribute('data-testid', 'sim-breakdown');
    var ho = state.round.handOutside;
    var hLevel = L.COPIES_PER_RANK - ho.level;
    var hBig = L.COPIES_PER_JOKER - ho.big;
    var hSmall = L.COPIES_PER_JOKER - ho.small;
    breakdown.appendChild(div('sim-bd-line',
      '开局外剩 级 8−' + hLevel + '=' + ho.level +
      ' · 大王 2−' + hBig + '=' + ho.big +
      ' · 小王 2−' + hSmall + '=' + ho.small));
    var fd = state.round.flipDelta;
    breakdown.appendChild(div('sim-bd-line',
      '翻牌减 级 −' + fd.level + ' · 大王 −' + fd.big + ' · 小王 −' + fd.small));
    var fo = state.round.finalOutside;
    breakdown.appendChild(div('sim-bd-line',
      '最终 级 ' + fo.level + ' · 大王 ' + fo.big + ' · 小王 ' + fo.small));
    panel.appendChild(breakdown);

    var gridSlot = div('ans-grid-slot');
    panel.appendChild(gridSlot);
    state.grid = G.createAnswerGrid({
      container: gridSlot,
      levelRank: state.levelRank,
      askedKeys: SIM_KEYS,
      label: '外剩',
      onChange: function () {}
    });
    state.grid.setGuesses(state.gridGuesses);
    state.grid.showFeedback({ level: fo.level, big: fo.big, small: fo.small });

    // 升档线：刚升档 / 已升档保持 / 连对进度
    var st = state.streakState;
    var upNote = div('sim-streak-note');
    if (st.justUpgraded) {
      upNote.textContent = '连对 3 盘 → N 从 10–30 放大到 20–50（已升档）';
    } else if (st.upgraded) {
      upNote.textContent = '已升档：N 从 10–30 放大到 20–50 · 连对 ' + st.streak + '/3';
    } else {
      upNote.textContent = '连对 ' + st.streak + '/3 → 升档后 N 从 10–30 放大到 20–50';
    }
    panel.appendChild(upNote);

    if (state.reviewing) panel.appendChild(renderReviewList());

    var actions = div('scan-actions');
    var s = window.GuandanSession;
    if (s && s.isSummaryReady()) {
      // v7.1：小结就绪 → 「下一盘」成空操作，换成「看小结」（回看翻过的牌保留）
      var vs = document.createElement('button');
      vs.type = 'button';
      vs.className = 'btn btn-primary';
      vs.setAttribute('data-testid', 'btn-view-summary');
      vs.textContent = '看小结';
      vs.addEventListener('click', function () { s.showSummary(); });
      actions.appendChild(vs);
    } else {
      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-primary';
      next.setAttribute('data-testid', 'btn-next');
      next.textContent = '下一盘';
      next.addEventListener('click', function () { startRound(); });
      actions.appendChild(next);
    }
    var review = document.createElement('button');
    review.type = 'button';
    review.className = 'btn btn-secondary';
    review.setAttribute('data-testid', 'btn-review');
    review.textContent = state.reviewing ? '收起翻过的牌' : '回看翻过的牌';
    review.addEventListener('click', function () {
      state.reviewing = !state.reviewing;
      render();
    });
    actions.appendChild(review);
    panel.appendChild(actions);

    root.appendChild(panel);
  }

  function renderReviewList() {
    var box = div('sim-review');
    box.setAttribute('data-testid', 'sim-review');
    var flips = state.round.flips;
    flips.forEach(function (card, i) {
      var chip = div('sim-review-chip', cardText(card));
      if (i === state.flipIndex - 1) chip.classList.add('latest');
      if (L.isLevelCard(card, state.levelRank)) chip.classList.add('lvl');
      box.appendChild(chip);
    });
    return box;
  }

  function render() {
    var root = els.root;
    var streakInfo = document.getElementById('sim-streak-info');
    if (streakInfo) {
      streakInfo.textContent = state.streakState.upgraded
        ? '已升档 20–50 · 连对 ' + state.streakState.streak + '/3'
        : '连对 ' + state.streakState.streak + '/3 · N 10–30';
    }
    if (!root) return;
    destroyGrid();
    root.innerHTML = '';
    if (state.phase === 'flash') {
      renderFlash(root);
      startFlashTimer();
    } else if (state.phase === 'flip') {
      renderFlipStage(root);
    } else if (state.phase === 'stop') {
      renderStop(root);
    } else if (state.phase === 'feedback') {
      renderFeedback(root);
    }
  }

  function check() {
    if (state.phase !== 'stop' || !state.grid || !state.grid.allChosen()) return;
    state.gridGuesses = state.grid.getGuesses();
    state.results = L.checkScan(state.gridGuesses, state.round.finalOutside, SIM_KEYS);
    state.wrongKeys = state.results
      .filter(function (r) { return !r.ok; })
      .map(function (r) { return r.key; });
    state.streakState = L.applySimStreak(state.streakState, state.wrongKeys.length === 0);
    state.reviewing = false;
    state.phase = 'feedback';
    var s = window.GuandanSession;
    if (s) {
      s.setAnswering(false);
      s.roundFinished('sim', state.wrongKeys.length === 0);
    }
    render();
  }

  function startRound() {
    stopTimers();
    var levelSelect = document.getElementById('level-select');
    var level = (levelSelect && levelSelect.value) || L.DEFAULT_LEVEL_RANK;
    state.levelRank = level;
    state.round = L.dealSimRound(level, null, state.streakState.nRange);
    state.flipIndex = 0;
    state.results = null;
    state.wrongKeys = [];
    state.gridGuesses = null;
    state.reviewing = false;
    state.phase = 'flash';
    var s = window.GuandanSession;
    if (s) {
      s.setAnswering(false);
      s.roundStarted('sim');
    }
    render();
  }

  // v7：闪牌 / 自动翻牌期间暂停 → 停表盖住；恢复 → 闪牌重闪完整 8 秒，
  // 翻牌从停下的那张（flipIndex 不变）继续，不重开这盘
  function onSessionPause() {
    if (state.phase === 'flash' || state.phase === 'flip') stopTimers();
  }

  function onSessionResume() {
    if (state.phase === 'flash') {
      render(); // render 会重开完整 8 秒闪牌计时
      return;
    }
    if (state.phase === 'flip') {
      render();          // 重亮当前这张，细进度条从头走
      armFlipTimeout();
    }
  }

  function goHome() {
    stopTimers();
    destroyGrid();
    state.phase = 'off';
    state.round = null;
    state.flipIndex = 0;
    render();
    document.getElementById('sim-back-slot').innerHTML = '';
    window.GuandanNav.show('home');
  }

  function enterSim() {
    window.GuandanNav.show('sim');
    var slot = document.getElementById('sim-back-slot');
    slot.innerHTML = '';
    slot.appendChild(makeBackButton(goHome));
    startRound();
  }

  window.__simDebug = {
    round: function () { return state.round; },
    state: state,
    setFastFlip: function (ms) {
      state.flipMs = (ms == null || ms <= 0) ? L.SIM_FLIP_MS : ms;
      return state.flipMs;
    }
  };

  function init() {
    els.root = document.getElementById('sim-root');
    var entry = document.querySelector('[data-testid="entry-sim"]');
    if (entry) entry.addEventListener('click', enterSim);
    var s = window.GuandanSession;
    if (s) {
      s.onPause(onSessionPause);
      s.onResume(onSessionResume);
      s.onSummaryReady(function () { if (state.phase === 'feedback') render(); });
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
