/* 掼蛋九宫格记牌练习 - 界面交互 */
/* global GuandanLogic */
(function () {
  'use strict';
  var L = GuandanLogic;

  var SCOPE_NAMES = {};
  SCOPE_NAMES[L.SCOPES.LEVEL_AND_JOKERS] = '只练级牌&王';
  SCOPE_NAMES[L.SCOPES.NINE] = '九宫格 2–10';
  SCOPE_NAMES[L.SCOPES.ALL] = '全牌';

  var state = {
    mode: 'practice',
    levelRank: L.DEFAULT_LEVEL_RANK,
    scope: L.DEFAULT_SCOPE,
    scopeKeys: [],
    counts: {},
    history: [],
    deck: [],
    flipIndex: 0,
    checked: false
  };
  state.scopeKeys = L.getScopeKeys(state.scope, state.levelRank);
  state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function grabElements() {
    ['level-select', 'scope-info',
      'tab-practice', 'tab-sim',
      'practice-controls', 'sim-controls', 'sim-status',
      'btn-undo', 'btn-reset-practice', 'total-practice',
      'btn-new-deal', 'btn-flip', 'btn-check', 'btn-reset-sim', 'total-sim',
      'current-card', 'flip-count', 'flip-total', 'last-cards',
      'main-grid', 'face-grid', 'joker-grid', 'message'
    ].forEach(function (id) { els[id] = $(id); });
  }

  function makeCell(key) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell' + (key === L.SMALL_JOKER ? ' joker small' : key === L.BIG_JOKER ? ' joker big' : '');
    btn.dataset.key = key;
    btn.setAttribute('aria-label', key + '，剩余张数');
    var lv = document.createElement('span');
    lv.className = 'lv';
    lv.textContent = '级';
    btn.appendChild(lv);
    var rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = key;
    var count = document.createElement('span');
    count.className = 'count';
    var truth = document.createElement('span');
    truth.className = 'truth';
    btn.appendChild(rank);
    btn.appendChild(count);
    btn.appendChild(truth);
    btn.addEventListener('click', function () { onCellTap(key); });
    return btn;
  }

  function buildGrids() {
    L.RANKS.slice(0, 9).forEach(function (r) {
      els['main-grid'].appendChild(makeCell(r));
    });
    L.RANKS.slice(9).forEach(function (r) {
      els['face-grid'].appendChild(makeCell(r));
    });
    L.JOKERS.forEach(function (j) {
      els['joker-grid'].appendChild(makeCell(j));
    });
  }

  function isInScope(key) { return state.scopeKeys.indexOf(key) !== -1; }

  function renderScopeInfo() {
    var total = L.scopeInitialTotal(state.scope, state.levelRank);
    var text;
    if (state.scope === L.SCOPES.NINE) {
      text = '当前范围：九宫格 2–10 · 每格 8 张 · 共 ' + total + ' 张';
    } else if (state.scope === L.SCOPES.ALL) {
      text = '当前范围：全牌 2–A + 大小王 · 共 ' + total + ' 张';
    } else {
      text = '当前范围：级牌「' + state.levelRank + '」8 张 + 小王 2 + 大王 2 · 共 ' + total + ' 张';
    }
    if (state.scope !== L.SCOPES.ALL) text += ' · 灰色格子本轮不用记';
    els['scope-info'].textContent = text;
  }

  function renderSimCard() {
    if (state.deck.length === 0) {
      els['current-card'].textContent = '洗';
      els['current-card'].className = 'card-back';
      els['last-cards'].textContent = '先点「新洗牌」开始发牌';
      return;
    }
    if (state.flipIndex === 0) {
      els['current-card'].textContent = '？';
      els['current-card'].className = 'card-back';
      els['last-cards'].textContent = '点「翻开下一张」开始';
      return;
    }
    var card = state.deck[state.flipIndex - 1];
    els['current-card'].textContent = card;
    els['current-card'].className = 'card-face' +
      (card === L.SMALL_JOKER ? ' small' : card === L.BIG_JOKER ? ' big' : '');

    var recent = state.deck.slice(Math.max(0, state.flipIndex - 5), state.flipIndex);
    els['last-cards'].innerHTML = '';
    recent.forEach(function (c, i) {
      var chip = document.createElement('span');
      chip.className = 'chip' + (c === L.SMALL_JOKER ? ' small' : c === L.BIG_JOKER ? ' big' : '');
      chip.textContent = c;
      if (i === recent.length - 1) chip.classList.add('latest');
      els['last-cards'].appendChild(chip);
    });
  }

  function render() {
    document.querySelectorAll('.cell').forEach(function (cell) {
      var key = cell.dataset.key;
      var inScope = isInScope(key);
      cell.classList.toggle('off', !inScope);
      cell.classList.toggle('level', key === state.levelRank); // 级牌始终高亮，即使当前范围不含它
      var countEl = cell.querySelector('.count');
      if (inScope) {
        countEl.textContent = state.counts[key];
        cell.classList.toggle('empty', state.counts[key] === 0);
      } else {
        countEl.textContent = '—';
        cell.classList.remove('empty');
      }
    });
    var total = L.totalRemaining(state.counts, state.scopeKeys);
    els['total-practice'].textContent = total;
    els['total-sim'].textContent = total;
    els['btn-undo'].disabled = state.history.length === 0;
    els['flip-count'].textContent = state.flipIndex;
    els['flip-total'].textContent =
      state.deck.length || L.scopeInitialTotal(state.scope, state.levelRank);
    els['btn-flip'].disabled = state.deck.length === 0 || state.flipIndex >= state.deck.length;
    els['btn-check'].disabled = state.flipIndex === 0 || state.deck.length === 0;
    els['btn-reset-sim'].disabled = state.deck.length === 0;
    renderScopeInfo();
    renderSimCard();
  }

  function showMessage(text, type) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (type ? ' ' + type : '');
  }

  function clearCheck() {
    state.checked = false;
    document.querySelectorAll('.cell').forEach(function (cell) {
      cell.classList.remove('ok', 'wrong');
      cell.querySelector('.truth').textContent = '';
    });
  }

  function onCellTap(key) {
    if (!isInScope(key)) return;
    clearCheck();
    if (state.mode === 'practice') {
      if (L.decrement(state.counts, key)) {
        state.history.push(key);
        showMessage('');
      } else {
        flashCell(key, 'bump');
        showMessage(key + ' 已经出完了（剩余 0 张）', 'warn');
      }
    } else {
      if (state.deck.length === 0) {
        showMessage('请先点「新洗牌」再记牌', 'warn');
        return;
      }
      if (!L.decrement(state.counts, key)) {
        flashCell(key, 'bump');
        showMessage(key + ' 已经减到 0 了，注意核对', 'warn');
      } else {
        showMessage('');
      }
    }
    render();
  }

  function flashCell(key, cls) {
    var cell = document.querySelector('.cell[data-key="' + key + '"]');
    if (!cell) return;
    cell.classList.add(cls);
    setTimeout(function () { cell.classList.remove(cls); }, 300);
  }

  function switchMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    clearCheck();
    showMessage('');
    state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);
    state.history = [];
    if (mode === 'sim') {
      state.flipIndex = 0;
    }
    els['tab-practice'].classList.toggle('active', mode === 'practice');
    els['tab-sim'].classList.toggle('active', mode === 'sim');
    els['practice-controls'].classList.toggle('hidden', mode !== 'practice');
    els['sim-controls'].classList.toggle('hidden', mode !== 'sim');
    els['sim-status'].classList.toggle('hidden', mode !== 'sim');
    render();
  }

  // 切换级牌或范围：记数与翻牌进度清零；单人模拟需重新洗牌
  function applySettingsChange(msg) {
    state.scopeKeys = L.getScopeKeys(state.scope, state.levelRank);
    state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);
    state.history = [];
    // 无论当前在哪个模式，都丢掉旧子牌堆，避免切回单人模拟时用到过期范围的牌
    state.deck = [];
    state.flipIndex = 0;
    clearCheck();
    if (state.mode === 'sim') {
      showMessage(msg + '，记数与翻牌已清零，请点「新洗牌」重新开始。', 'info');
    } else {
      showMessage(msg + '，记数已重置（单人模拟需重新洗牌）。', 'info');
    }
    render();
  }

  function changeScope(scope) {
    if (scope === state.scope) return;
    state.scope = scope;
    applySettingsChange('练习范围已切换为「' + SCOPE_NAMES[scope] + '」');
  }

  function changeLevel(rank) {
    if (rank === state.levelRank) return;
    state.levelRank = rank;
    applySettingsChange('级牌已设为「' + rank + '」');
  }

  function undo() {
    clearCheck();
    var key = state.history.pop();
    if (key !== undefined) {
      state.counts[key] += 1;
      showMessage('已撤销上一次点击（' + key + '）');
    }
    render();
  }

  function resetCounts() {
    state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);
    state.history = [];
    clearCheck();
    render();
  }

  function newDeal() {
    state.deck = L.shuffle(L.filterDeckByScope(L.createDeck(), state.scope, state.levelRank));
    state.flipIndex = 0;
    state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);
    state.history = [];
    clearCheck();
    showMessage('新牌已洗好：只发范围内的牌，共 ' + state.deck.length + ' 张。点「翻开下一张」开始。', 'info');
    render();
  }

  function resetSim() {
    if (state.deck.length === 0) {
      showMessage('还没有牌，请先点「新洗牌」', 'warn');
      return;
    }
    state.flipIndex = 0;
    state.counts = L.createInitialCountsForScope(state.scope, state.levelRank);
    state.history = [];
    clearCheck();
    showMessage('已重置（牌序不变，重新从头翻）。', 'info');
    render();
  }

  function flipNext() {
    clearCheck();
    if (state.deck.length === 0) {
      showMessage('请先点「新洗牌」', 'warn');
      return;
    }
    if (state.flipIndex >= state.deck.length) {
      showMessage('范围内的 ' + state.deck.length + ' 张已全部翻完，可以点「核对答案」。', 'info');
      return;
    }
    state.flipIndex += 1;
    if (state.flipIndex === state.deck.length) {
      showMessage('范围内 ' + state.deck.length + ' 张全部翻完，可以点「核对答案」了。', 'info');
    } else {
      showMessage('');
    }
    render();
  }

  function check() {
    if (state.deck.length === 0 || state.flipIndex === 0) {
      showMessage('请先洗牌并翻开至少一张', 'warn');
      return;
    }
    var played = state.deck.slice(0, state.flipIndex);
    var wrong = L.checkAnswer(state.counts, played, state.scopeKeys);
    clearCheck();
    state.checked = true;

    var truth = L.trueRemaining(played);
    document.querySelectorAll('.cell').forEach(function (cell) {
      var key = cell.dataset.key;
      if (!isInScope(key)) return;
      var t = cell.querySelector('.truth');
      if (state.counts[key] === truth[key]) {
        cell.classList.add('ok');
      } else {
        cell.classList.add('wrong');
        t.textContent = '真 ' + truth[key];
      }
    });

    if (wrong.length === 0) {
      showMessage('全部正确！已翻 ' + state.flipIndex + ' 张，记得一点不差。', 'good');
    } else {
      showMessage('有 ' + wrong.length + ' 格不一致（红色已标出，角标是正确张数）：' +
        wrong.slice(0, 5).map(function (w) {
          return w.key + '（你记 ' + w.user + ' / 实际 ' + w.truth + '）';
        }).join('、') + (wrong.length > 5 ? ' 等' : ''), 'warn');
    }
  }

  function init() {
    grabElements();
    buildGrids();
    L.RANKS.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      els['level-select'].appendChild(opt);
    });
    els['level-select'].value = state.levelRank;
    els['level-select'].addEventListener('change', function () { changeLevel(this.value); });
    document.querySelectorAll('input[name="scope"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) changeScope(radio.value);
      });
    });
    els['tab-practice'].addEventListener('click', function () { switchMode('practice'); });
    els['tab-sim'].addEventListener('click', function () { switchMode('sim'); });
    els['btn-undo'].addEventListener('click', undo);
    els['btn-reset-practice'].addEventListener('click', function () {
      resetCounts();
      showMessage('已重置为本范围初始张数。', 'info');
    });
    els['btn-new-deal'].addEventListener('click', newDeal);
    els['btn-flip'].addEventListener('click', flipNext);
    els['btn-check'].addEventListener('click', check);
    els['btn-reset-sim'].addEventListener('click', resetSim);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
