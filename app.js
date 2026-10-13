/* 掼蛋九宫格记牌练习 - 出牌闭卷（v6：闭卷填剩余 + 三行渐进解锁，统一九宫格作答） */
/* global GuandanLogic, GuandanGrid */
(function () {
  'use strict';
  var L = GuandanLogic;
  var G = GuandanGrid;

  // phase: idle | flipping | filling | done
  var state = {
    phase: 'idle',
    levelRank: L.DEFAULT_LEVEL_RANK,
    unlockedRows: 1,
    roundRows: 1, // 本盘锁定的行数（升档下一盘才生效）
    streak: 0,
    activeKeys: [],
    grid: null,
    deck: [],
    flipIndex: 0,
    lastWrong: [],
    lastTruth: null,
    justUnlocked: false
  };
  state.activeKeys = L.getUnlockedKeys(state.roundRows, state.levelRank);

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function grabElements() {
    [
      'level-select', 'streak-info', 'stat-remain', 'stat-result', 'row-label',
      'flip-panel', 'current-card', 'flip-count', 'flip-total', 'last-cards', 'phase-hint',
      'closed-grid-slot', 'btn-primary', 'btn-secondary', 'message', 'closed-back-slot'
    ].forEach(function (id) { els[id] = $(id); });
  }

  // 九宫格点位 → 逻辑点数键：级格=当前级牌，王格=大小王，其余=本身
  function keyOfSlot(slot) {
    if (slot === 'level') return state.levelRank;
    if (slot === 'big') return L.BIG_JOKER;
    if (slot === 'small') return L.SMALL_JOKER;
    return slot;
  }

  // 本盘被考的格（= 已解锁行）
  function askedSlots() {
    var rows = state.roundRows;
    var slots = [];
    G.CANON.forEach(function (slot) {
      var row = slot === 'level' || slot === 'big' || slot === 'small' ? 1
        : (slot === 'A' || slot === 'K' || slot === 'Q' ? 2 : 3);
      if (row <= rows) slots.push(slot);
    });
    return slots;
  }

  function destroyGrid() {
    if (state.grid) {
      state.grid.destroy();
      state.grid = null;
    }
  }

  function showMessage(text, type) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (type ? ' ' + type : '');
  }

  function renderStats() {
    if (state.phase === 'done' && state.lastTruth) {
      var rem = L.totalRemaining(state.lastTruth, state.activeKeys);
      els['stat-remain'].textContent = String(rem);
      els['stat-remain'].className = 'stat-value';
      var wrongN = state.lastWrong.length;
      if (wrongN === 0) {
        els['stat-result'].textContent = '全对 ✓';
        els['stat-result'].className = 'stat-value ok';
      } else {
        els['stat-result'].textContent = wrongN + ' 错 ✕';
        els['stat-result'].className = 'stat-value bad';
      }
    } else {
      els['stat-remain'].textContent = '—';
      els['stat-remain'].className = 'stat-value';
      els['stat-result'].textContent = '—';
      els['stat-result'].className = 'stat-value';
    }
  }

  function renderFlip() {
    var closed = state.phase === 'filling' || state.phase === 'done';
    els['flip-panel'].classList.toggle('closed', closed);

    els['flip-total'].textContent =
      state.deck.length || L.scopeInitialTotalForKeys(state.activeKeys);
    els['flip-count'].textContent = state.flipIndex;

    if (state.phase === 'idle' || state.deck.length === 0) {
      els['current-card'].textContent = '洗';
      els['current-card'].className = 'card-back';
      els['last-cards'].textContent = '';
      els['phase-hint'].textContent = '先点「新开一盘」，再翻牌记牌';
      return;
    }

    if (closed) {
      els['current-card'].textContent = '收';
      els['current-card'].className = 'card-back';
      els['last-cards'].textContent = '';
      if (state.phase === 'filling') {
        els['phase-hint'].textContent = '牌面已收 · 点格子选中 · 下方数字键选剩余';
      } else {
        els['phase-hint'].textContent = '本盘结束 · 灰行不计分';
      }
      return;
    }

    // flipping
    if (state.flipIndex === 0) {
      els['current-card'].textContent = '？';
      els['current-card'].className = 'card-back';
      els['last-cards'].textContent = '';
      els['phase-hint'].textContent = '点「翻开下一张」开始记牌（禁止边翻边减）';
      return;
    }

    var card = state.deck[state.flipIndex - 1];
    els['current-card'].textContent = card;
    els['current-card'].className = 'card-face' +
      (card === L.BIG_JOKER ? ' big' : '');

    var recent = state.deck.slice(Math.max(0, state.flipIndex - 5), state.flipIndex);
    els['last-cards'].innerHTML = '';
    recent.forEach(function (c, i) {
      var chip = document.createElement('span');
      chip.className = 'chip' + (i === recent.length - 1 ? ' latest' : '');
      chip.textContent = c;
      els['last-cards'].appendChild(chip);
    });

    if (state.flipIndex >= state.deck.length) {
      els['phase-hint'].textContent = '范围内已翻完 · 可点「闭卷填剩余」';
    } else {
      els['phase-hint'].textContent = '继续翻牌记牌 · 记够后点「闭卷填剩余」';
    }
  }

  // 作答/反馈阶段渲染统一九宫格；翻牌阶段不挂（被考点集随本盘行数变化）
  function renderGrid() {
    if (state.phase !== 'filling' && state.phase !== 'done') {
      destroyGrid();
      return;
    }
    var slots = askedSlots();
    if (!state.grid) {
      state.grid = G.createAnswerGrid({
        container: els['closed-grid-slot'],
        levelRank: state.levelRank,
        askedKeys: slots,
        label: '剩余',
        onChange: function () { showMessage(''); renderButtons(); }
      });
    } else {
      state.grid.setAskedKeys(slots);
    }
    if (state.phase === 'done' && state.lastTruth) {
      var truth = {};
      slots.forEach(function (slot) { truth[slot] = state.lastTruth[keyOfSlot(slot)] || 0; });
      state.grid.showFeedback(truth);
    } else {
      state.grid.clearFeedback();
    }
  }

  function renderButtons() {
    var primary = els['btn-primary'];
    var secondary = els['btn-secondary'];

    if (state.phase === 'idle') {
      primary.textContent = '新开一盘';
      primary.disabled = false;
      secondary.textContent = '闭卷填剩余';
      secondary.disabled = true;
      return;
    }

    if (state.phase === 'flipping') {
      primary.textContent = '翻开下一张';
      primary.disabled = state.flipIndex >= state.deck.length;
      secondary.textContent = '闭卷填剩余';
      secondary.disabled = state.flipIndex === 0;
      return;
    }

    if (state.phase === 'filling') {
      primary.textContent = '核对';
      primary.disabled = !(state.grid && state.grid.allChosen());
      secondary.textContent = '再练一盘';
      secondary.disabled = false;
      return;
    }

    // done
    var s = window.GuandanSession;
    if (s && s.isSummaryReady()) {
      // v7.1：小结就绪 → 「再练一盘」成空操作，主按钮换成「看小结」
      primary.textContent = '看小结';
      primary.disabled = false;
      secondary.disabled = true;
      return;
    }
    primary.textContent = '再练一盘';
    primary.disabled = false;
    if (state.justUnlocked) {
      secondary.textContent = '已解锁第' + state.unlockedRows + '行（下盘生效）';
      secondary.disabled = true;
    } else if (state.unlockedRows >= L.MAX_UNLOCKED_ROWS) {
      secondary.textContent = '已满档';
      secondary.disabled = true;
    } else {
      secondary.textContent = '升档（连对 ' + state.streak + '/' + L.UNLOCK_STREAK_NEED + '）';
      secondary.disabled = true;
    }
  }

  function render() {
    els['row-label'].textContent = L.rowLabel(state.roundRows);
    els['streak-info'].textContent = '连对 ' + state.streak + '/' + L.UNLOCK_STREAK_NEED +
      ' · 第' + state.unlockedRows + '行';
    renderStats();
    renderFlip();
    renderGrid();
    renderButtons();
  }

  function newRound() {
    destroyGrid();
    state.roundRows = state.unlockedRows;
    state.activeKeys = L.getUnlockedKeys(state.roundRows, state.levelRank);
    state.deck = L.shuffle(L.createDeckForKeys(state.activeKeys));
    state.flipIndex = 0;
    state.lastWrong = [];
    state.lastTruth = null;
    state.justUnlocked = false;
    state.phase = 'flipping';
    var s = window.GuandanSession;
    if (s) {
      s.setAnswering(false);
      s.roundStarted('closed');
    }
    showMessage('新牌已洗好：范围内共 ' + state.deck.length + ' 张。翻牌记牌，不要边看边减。', 'info');
    render();
  }

  function flipNext() {
    if (state.phase !== 'flipping') return;
    if (state.deck.length === 0) {
      showMessage('请先点「新开一盘」', 'warn');
      return;
    }
    if (state.flipIndex >= state.deck.length) {
      showMessage('已翻完，请点「闭卷填剩余」', 'info');
      return;
    }
    state.flipIndex += 1;
    showMessage('');
    render();
  }

  function closeBook() {
    if (state.phase !== 'flipping') return;
    if (state.flipIndex === 0) {
      showMessage('请先翻开至少一张再闭卷', 'warn');
      return;
    }
    state.phase = 'filling';
    var s = window.GuandanSession;
    if (s) s.setAnswering(true);
    showMessage('牌面已收。点格子选中，用下方数字键直接选剩余，满意后点「核对」。', 'info');
    render();
  }

  function check() {
    if (state.phase !== 'filling' || !state.grid || !state.grid.allChosen()) return;
    var played = state.deck.slice(0, state.flipIndex);
    var guesses = {};
    state.activeKeys.forEach(function (k) { guesses[k] = 0; });
    var slotGuesses = state.grid.getGuesses();
    Object.keys(slotGuesses).forEach(function (slot) {
      guesses[keyOfSlot(slot)] = slotGuesses[slot];
    });
    var wrong = L.checkAnswer(guesses, played, state.activeKeys);
    var truth = L.trueRemaining(played);
    state.lastWrong = wrong;
    state.lastTruth = truth;
    state.phase = 'done';

    var allCorrect = wrong.length === 0;
    var s = window.GuandanSession;
    if (s) {
      s.setAnswering(false);
      s.roundFinished('closed', allCorrect);
    }
    var prog = L.applyStreakAfterCheck(state.unlockedRows, state.streak, allCorrect);
    state.unlockedRows = prog.unlockedRows;
    state.streak = prog.streak;
    state.justUnlocked = prog.justUnlocked;
    // 不在本盘刷新 roundRows：新行下一盘才进作答计分

    if (allCorrect) {
      var msg = '全部正确！';
      if (prog.justUnlocked) {
        msg += ' 连对达标，已解锁第 ' + state.unlockedRows + ' 行。';
      } else if (state.unlockedRows < L.MAX_UNLOCKED_ROWS) {
        msg += ' 连对 ' + state.streak + '/' + L.UNLOCK_STREAK_NEED + '，再对几盘可升档。';
      }
      showMessage(msg, 'good');
    } else {
      showMessage('有 ' + wrong.length + ' 格不一致。红格为错，绿格正确。连对已清零。', 'warn');
    }
    render();
  }

  function onPrimary() {
    if (state.phase === 'idle') {
      newRound();
      return;
    }
    if (state.phase === 'flipping') {
      flipNext();
      return;
    }
    if (state.phase === 'filling') {
      check();
      return;
    }
    // done → 看小结 / 再练一盘
    var s = window.GuandanSession;
    if (s && s.isSummaryReady()) {
      s.showSummary();
      return;
    }
    newRound();
  }

  function onSecondary() {
    if (state.phase === 'flipping') {
      closeBook();
      return;
    }
    if (state.phase === 'filling' || state.phase === 'done') {
      newRound();
    }
  }

  function changeLevel(rank) {
    if (rank === state.levelRank) return;
    destroyGrid();
    state.levelRank = rank;
    state.roundRows = state.unlockedRows;
    state.activeKeys = L.getUnlockedKeys(state.roundRows, state.levelRank);
    state.deck = [];
    state.flipIndex = 0;
    state.lastWrong = [];
    state.lastTruth = null;
    state.phase = 'idle';
    showMessage('级牌已设为「' + rank + '」，请重新「新开一盘」。', 'info');
    render();
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

  function enterClosed() {
    var slot = els['closed-back-slot'];
    slot.innerHTML = '';
    slot.appendChild(makeBackButton(goHome));
    window.GuandanNav.show('closed');
    render();
  }

  function goHome() {
    destroyGrid();
    els['closed-back-slot'].innerHTML = '';
    state.phase = 'idle';
    state.deck = [];
    state.flipIndex = 0;
    render();
    window.GuandanNav.show('home');
  }

  window.__closedDebug = {
    truth: function () {
      var played = state.deck.slice(0, state.flipIndex);
      var t = L.trueRemaining(played);
      var out = {};
      state.activeKeys.forEach(function (k) { out[k] = t[k]; });
      return out;
    },
    state: state
  };

  function init() {
    grabElements();
    L.RANKS.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      els['level-select'].appendChild(opt);
    });
    els['level-select'].value = state.levelRank;
    els['level-select'].addEventListener('change', function () { changeLevel(this.value); });
    els['btn-primary'].addEventListener('click', onPrimary);
    els['btn-secondary'].addEventListener('click', onSecondary);
    var entry = document.querySelector('[data-testid="entry-closed"]');
    if (entry) entry.addEventListener('click', enterClosed);
    var s = window.GuandanSession;
    if (s) s.onSummaryReady(function () { if (state.phase === 'done') render(); });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
