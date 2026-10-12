/* 掼蛋九宫格记牌练习 - 界面交互（v4 闭卷填剩余） */
/* global GuandanLogic */
(function () {
  'use strict';
  var L = GuandanLogic;

  // phase: idle | flipping | filling | done
  var state = {
    phase: 'idle',
    levelRank: L.DEFAULT_LEVEL_RANK,
    unlockedRows: 1,
    roundRows: 1, // 本盘锁定的行数（升档下一盘才生效）
    streak: 0,
    activeKeys: [],
    guesses: {},
    deck: [],
    flipIndex: 0,
    lastWrong: [],
    lastTruth: null,
    justUnlocked: false
  };
  state.activeKeys = L.getUnlockedKeys(state.roundRows, state.levelRank);
  state.guesses = L.createZeroGuesses(state.activeKeys);

  // 固定 3×3 展示格：每格 { row, keyOrNull, label }
  // 行1 col0 的 key 跟随级牌
  var CELL_DEFS = [
    { row: 1, kind: 'level' },
    { row: 1, kind: 'fixed', key: L.BIG_JOKER },
    { row: 1, kind: 'fixed', key: L.SMALL_JOKER },
    { row: 2, kind: 'fixed', key: 'A' },
    { row: 2, kind: 'fixed', key: 'K' },
    { row: 2, kind: 'fixed', key: 'Q' },
    { row: 3, kind: 'fixed', key: 'J' },
    { row: 3, kind: 'fixed', key: '10' },
    { row: 3, kind: 'fixed', key: '9' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function grabElements() {
    [
      'level-select', 'streak-info', 'stat-remain', 'stat-result', 'row-label',
      'flip-panel', 'current-card', 'flip-count', 'flip-total', 'last-cards', 'phase-hint',
      'map-grid', 'btn-primary', 'btn-secondary', 'message'
    ].forEach(function (id) { els[id] = $(id); });
  }

  function cellKey(def) {
    return def.kind === 'level' ? state.levelRank : def.key;
  }

  function cellLabel(def) {
    if (def.kind === 'level') return state.levelRank;
    return def.key;
  }

  function isRowUnlocked(row) {
    // 本盘内用 roundRows；升档后的新行下一盘才可填
    return row <= state.roundRows;
  }

  function makeCell(def, index) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.index = String(index);
    btn.dataset.row = String(def.row);

    var markRow = document.createElement('div');
    markRow.className = 'mark-row';
    var lv = document.createElement('span');
    lv.className = 'lv';
    lv.textContent = '级';
    var mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = '▢';
    markRow.appendChild(lv);
    markRow.appendChild(mark);

    var rank = document.createElement('span');
    rank.className = 'rank';
    var count = document.createElement('span');
    count.className = 'count';
    var hint = document.createElement('span');
    hint.className = 'hint';

    btn.appendChild(markRow);
    btn.appendChild(rank);
    btn.appendChild(count);
    btn.appendChild(hint);
    btn.addEventListener('click', function () { onCellTap(index); });
    return btn;
  }

  function buildGrid() {
    els['map-grid'].innerHTML = '';
    CELL_DEFS.forEach(function (def, i) {
      els['map-grid'].appendChild(makeCell(def, i));
    });
  }

  function showMessage(text, type) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (type ? ' ' + type : '');
  }

  function refreshActiveKeys() {
    state.activeKeys = L.getUnlockedKeys(state.roundRows, state.levelRank);
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
        els['phase-hint'].textContent = '牌面已收 · 点格子改剩余 · 满意后核对';
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

  function renderCells() {
    var cells = els['map-grid'].querySelectorAll('.cell');
    cells.forEach(function (cell, index) {
      var def = CELL_DEFS[index];
      var key = cellKey(def);
      var unlocked = isRowUnlocked(def.row);
      var rankEl = cell.querySelector('.rank');
      var countEl = cell.querySelector('.count');
      var hintEl = cell.querySelector('.hint');

      cell.className = 'cell';
      if (def.kind === 'level') cell.classList.add('is-level');
      rankEl.textContent = cellLabel(def);

      // 灰行预览：始终锁定样式，点击无效
      if (!unlocked) {
        cell.classList.add('locked');
        countEl.textContent = '—';
        hintEl.textContent = (index === 3 || index === 6) ? '升档' : '';
        return;
      }

      if (state.phase === 'idle' || state.phase === 'flipping') {
        // 已解锁但尚未闭卷：显示待填，不可点改
        countEl.textContent = '—';
        hintEl.textContent = '待填';
        return;
      }

      if (state.phase === 'filling') {
        countEl.textContent = String(state.guesses[key] || 0);
        hintEl.textContent = '点改';
        return;
      }

      // done：大字显示真实剩余；绿正确 / 红错误
      var truth = state.lastTruth ? state.lastTruth[key] : 0;
      var user = state.guesses[key] || 0;
      var ok = user === truth;
      countEl.textContent = String(truth);
      cell.classList.add('done');
      if (ok) {
        cell.classList.add('ok');
        hintEl.textContent = '正确';
      } else {
        cell.classList.add('wrong');
        var miss = truth - user;
        if (miss > 0) {
          hintEl.textContent = '漏' + miss + '·填' + user;
        } else {
          hintEl.textContent = '多' + (-miss) + '·填' + user;
        }
      }
    });
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
      primary.disabled = false;
      secondary.textContent = '再练一盘';
      secondary.disabled = false;
      return;
    }

    // done
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
    renderCells();
    renderButtons();
  }

  function onCellTap(index) {
    if (state.phase !== 'filling') return;
    var def = CELL_DEFS[index];
    if (!isRowUnlocked(def.row)) return;
    var key = cellKey(def);
    state.guesses[key] = L.cycleGuess(state.guesses[key] || 0, key);
    showMessage('');
    render();
  }

  function newRound() {
    state.roundRows = state.unlockedRows;
    refreshActiveKeys();
    state.deck = L.shuffle(L.createDeckForKeys(state.activeKeys));
    state.flipIndex = 0;
    state.guesses = L.createZeroGuesses(state.activeKeys);
    state.lastWrong = [];
    state.lastTruth = null;
    state.justUnlocked = false;
    state.phase = 'flipping';
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
    state.guesses = L.createZeroGuesses(state.activeKeys);
    state.phase = 'filling';
    showMessage('牌面已收。点格子改最终剩余，满意后点「核对」。', 'info');
    render();
  }

  function check() {
    if (state.phase !== 'filling') return;
    var played = state.deck.slice(0, state.flipIndex);
    var wrong = L.checkAnswer(state.guesses, played, state.activeKeys);
    var truth = L.trueRemaining(played);
    state.lastWrong = wrong;
    state.lastTruth = truth;
    state.phase = 'done';

    var allCorrect = wrong.length === 0;
    var prog = L.applyStreakAfterCheck(state.unlockedRows, state.streak, allCorrect);
    state.unlockedRows = prog.unlockedRows;
    state.streak = prog.streak;
    state.justUnlocked = prog.justUnlocked;
    // 不在本盘刷新 activeKeys / roundRows：新行下一盘才进地图计分

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
    // done → 再练一盘
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
    state.levelRank = rank;
    state.roundRows = state.unlockedRows;
    refreshActiveKeys();
    state.deck = [];
    state.flipIndex = 0;
    state.guesses = L.createZeroGuesses(state.activeKeys);
    state.lastWrong = [];
    state.lastTruth = null;
    state.phase = 'idle';
    showMessage('级牌已设为「' + rank + '」，请重新「新开一盘」。', 'info');
    render();
  }

  function init() {
    grabElements();
    buildGrid();
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
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
