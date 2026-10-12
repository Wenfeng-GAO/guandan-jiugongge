/* 掼蛋九宫格记牌练习 - 界面交互 */
/* global GuandanLogic */
(function () {
  'use strict';
  var L = GuandanLogic;

  var state = {
    mode: 'practice',
    counts: L.createInitialCounts(),
    history: [],
    deck: [],
    flipIndex: 0,
    checked: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function grabElements() {
    ['tab-practice', 'tab-sim',
      'practice-controls', 'sim-controls', 'sim-status',
      'btn-undo', 'btn-reset-practice', 'total-practice',
      'btn-new-deal', 'btn-flip', 'btn-check', 'btn-reset-sim', 'total-sim',
      'current-card', 'flip-count', 'last-cards',
      'main-grid', 'face-grid', 'joker-grid', 'message'
    ].forEach(function (id) { els[id] = $(id); });
  }

  function makeCell(key) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell' + (key === L.SMALL_JOKER ? ' joker small' : key === L.BIG_JOKER ? ' joker big' : '');
    btn.dataset.key = key;
    btn.setAttribute('aria-label', key + '，剩余张数');
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
      cell.querySelector('.count').textContent = state.counts[key];
      cell.classList.toggle('empty', state.counts[key] === 0);
    });
    els['total-practice'].textContent = L.totalRemaining(state.counts);
    els['total-sim'].textContent = L.totalRemaining(state.counts);
    els['btn-undo'].disabled = state.history.length === 0;
    els['flip-count'].textContent = state.flipIndex;
    els['btn-flip'].disabled = state.flipIndex >= L.TOTAL_CARDS || state.deck.length === 0;
    els['btn-check'].disabled = state.flipIndex === 0 || state.deck.length === 0;
    els['btn-reset-sim'].disabled = state.deck.length === 0;
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
    state.counts = L.createInitialCounts();
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
    state.counts = L.createInitialCounts();
    state.history = [];
    clearCheck();
    render();
  }

  function newDeal() {
    state.deck = L.shuffle(L.createDeck());
    state.flipIndex = 0;
    state.counts = L.createInitialCounts();
    state.history = [];
    clearCheck();
    showMessage('新牌已洗好，共 108 张。点「翻开下一张」开始。', 'info');
    render();
  }

  function resetSim() {
    if (state.deck.length === 0) {
      showMessage('还没有牌，请先点「新洗牌」', 'warn');
      return;
    }
    state.flipIndex = 0;
    state.counts = L.createInitialCounts();
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
    if (state.flipIndex >= L.TOTAL_CARDS) {
      showMessage('108 张已全部翻完，可以点「核对答案」。', 'info');
      return;
    }
    state.flipIndex += 1;
    if (state.flipIndex === L.TOTAL_CARDS) {
      showMessage('108 张全部翻完，可以点「核对答案」了。', 'info');
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
    var wrong = L.checkAnswer(state.counts, played);
    clearCheck();
    state.checked = true;

    var truth = L.trueRemaining(played);
    document.querySelectorAll('.cell').forEach(function (cell) {
      var key = cell.dataset.key;
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
    els['tab-practice'].addEventListener('click', function () { switchMode('practice'); });
    els['tab-sim'].addEventListener('click', function () { switchMode('sim'); });
    els['btn-undo'].addEventListener('click', undo);
    els['btn-reset-practice'].addEventListener('click', function () {
      resetCounts();
      showMessage('已重置，从初始张数重新开始。', 'info');
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
