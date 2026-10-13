/* 掼蛋九宫格记牌练习 - 统一作答九宫格（v6.1 设计师修订稿，三关共用）
 * 固定 3×3 点位：第1行 级/大王/小王，第2行 A/K/Q，第3行 J/10/9。
 * 被考的格点亮可点，未考的格原位灰显锁定（虚线灰框 + ▢）；点格 → 九宫格下方弹出该格数字键。
 * 反馈：✓(绿)/✕(红) 标在格名旁；错格数字区显示 用户值 → 正确值。
 */
/* global GuandanLogic */
(function () {
  'use strict';
  var L = GuandanLogic;

  // slot → 中文名 / 数字键取值范围 / data-testid 后缀
  var SLOTS = [
    { slot: 'level', name: null, badge: true }, // name 跟随 levelRank
    { slot: 'big', name: L.BIG_JOKER },
    { slot: 'small', name: L.SMALL_JOKER },
    { slot: 'A', name: 'A' },
    { slot: 'K', name: 'K' },
    { slot: 'Q', name: 'Q' },
    { slot: 'J', name: 'J' },
    { slot: '10', name: '10' },
    { slot: '9', name: '9' }
  ];

  var CANON = ['level', 'big', 'small', 'A', 'K', 'Q', 'J', '10', '9'];

  function isJokerSlot(slot) { return slot === 'big' || slot === 'small'; }

  // 面板显示名 / numberOptions 用的点数键：级=当前级牌，王=大小王，其余即点数
  function slotName(slot, levelRank) {
    if (slot === 'level') return levelRank;
    if (slot === 'big') return L.BIG_JOKER;
    if (slot === 'small') return L.SMALL_JOKER;
    return slot;
  }

  function createAnswerGrid(opts) {
    var container = opts.container;
    var levelRank = opts.levelRank || L.DEFAULT_LEVEL_RANK;
    var asked = (opts.askedKeys || []).slice();
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var label = opts.label || '外剩';

    var guesses = {};
    var selected = null; // 当前选中格 slot
    var feedback = null; // { truth: {slot: n}, ok: {slot: bool} }

    // —— 骨架（建一次） ——
    var root = document.createElement('div');
    root.className = 'ans-grid-wrap';

    var grid = document.createElement('div');
    grid.className = 'ans-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '作答九宫格');

    var picker = document.createElement('div');
    picker.className = 'ans-picker';
    picker.setAttribute('data-testid', 'grid-picker');
    picker.style.display = 'none';

    var pickerLabel = document.createElement('p');
    pickerLabel.className = 'ans-picker-label';
    var pickerRow = document.createElement('div');
    pickerRow.className = 'num-row ans-picker-row';
    picker.appendChild(pickerLabel);
    picker.appendChild(pickerRow);

    root.appendChild(grid);
    root.appendChild(picker);

    var cells = {}; // slot → { btn, nameEl, countEl, fixEl, verdictEl }

    SLOTS.forEach(function (def) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.setAttribute('data-testid', 'grid-cell-' + def.slot);

      var head = document.createElement('div');
      head.className = 'ans-cell-head';
      if (def.badge) {
        var badge = document.createElement('span');
        badge.className = 'scan-badge';
        badge.textContent = '级';
        head.appendChild(badge);
      }
      var name = document.createElement('span');
      name.className = 'ans-cell-name';
      head.appendChild(name);

      var verdict = document.createElement('span');
      verdict.className = 'ans-verdict';
      head.appendChild(verdict);

      var val = document.createElement('div');
      val.className = 'ans-cell-val';
      var count = document.createElement('span');
      count.className = 'count';
      var fix = document.createElement('span');
      fix.className = 'ans-fix';
      val.appendChild(count);
      val.appendChild(fix);

      btn.appendChild(head);
      btn.appendChild(val);

      (function (slot) {
        btn.addEventListener('click', function () { select(slot); });
      })(def.slot);

      cells[def.slot] = {
        btn: btn, nameEl: name, countEl: count, fixEl: fix, verdictEl: verdict
      };
      grid.appendChild(btn);
    });

    if (container) container.appendChild(root);

    // —— 行为 ——
    function isAsked(slot) { return asked.indexOf(slot) !== -1; }

    function pick(slot, n) {
      if (feedback) return; // 反馈后锁定
      guesses[slot] = n;
      renderPicker();
      onChange(slot, n, api);
    }

    function select(slot) {
      if (feedback || !isAsked(slot)) return;
      selected = slot;
      renderCells();
      renderPicker();
    }

    function buildPicker(slot) {
      pickerRow.innerHTML = '';
      pickerLabel.textContent =
        (slot === 'level' ? '级 ' + levelRank : slotName(slot, levelRank)) + ' ' + label;
      var optsArr = L.numberOptions(slotName(slot, levelRank));
      var dense = optsArr.length > 4;
      optsArr.forEach(function (n) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'num-btn' + (dense ? ' dense' : '');
        btn.textContent = String(n);
        btn.setAttribute('data-testid', 'grid-num-' + n);
        if (guesses[slot] === n) btn.classList.add('selected');
        (function (value) {
          btn.addEventListener('click', function () { pick(slot, value); });
        })(n);
        pickerRow.appendChild(btn);
      });
    }

    function renderCells() {
      SLOTS.forEach(function (def) {
        var slot = def.slot;
        var c = cells[slot];
        var askedHere = isAsked(slot);
        c.nameEl.textContent = slotName(slot, levelRank);
        c.btn.className = 'cell' + (def.badge ? ' is-level' : '');
        c.fixEl.textContent = '';
        c.verdictEl.textContent = '';
        c.countEl.classList.remove('empty');
        if (!askedHere) {
          // 未考的格原位锁定：虚线灰框 + ▢（含反馈阶段）
          c.btn.classList.add('locked');
          c.btn.setAttribute('data-locked', '1');
          c.countEl.textContent = '▢';
          if (feedback) c.btn.classList.add('done');
          return;
        }
        if (feedback) {
          c.btn.classList.add('done');
          c.btn.setAttribute('data-locked', '1');
          var okHere = feedback.ok[slot];
          c.btn.classList.add(okHere ? 'ok' : 'wrong');
          c.verdictEl.textContent = okHere ? '✓' : '✕';
          // 错格：用户值 → 正确值；对格：显示该数
          c.countEl.textContent = String(okHere ? feedback.truth[slot] : guesses[slot]);
          if (!okHere) c.fixEl.textContent = ' → ' + feedback.truth[slot];
          return;
        }
        c.btn.removeAttribute('data-locked');
        c.countEl.classList.toggle('empty', guesses[slot] == null);
        c.countEl.textContent = guesses[slot] != null ? String(guesses[slot]) : '–';
        if (selected === slot) c.btn.classList.add('picked');
      });
    }

    function renderPicker() {
      if (feedback || !selected || !isAsked(selected)) {
        picker.style.display = 'none';
        return;
      }
      picker.style.display = '';
      buildPicker(selected);
    }

    function render() {
      renderCells();
      renderPicker();
    }

    var api = {
      getGuesses: function () {
        var out = {};
        asked.forEach(function (slot) { out[slot] = guesses[slot]; });
        return out;
      },
      allChosen: function () {
        return asked.every(function (slot) { return guesses[slot] != null; });
      },
      showFeedback: function (truthMap) {
        var truth = {};
        var ok = {};
        SLOTS.forEach(function (def) {
          truth[def.slot] = truthMap[def.slot] != null ? truthMap[def.slot] : 0;
        });
        asked.forEach(function (slot) {
          ok[slot] = guesses[slot] === truth[slot];
        });
        feedback = { truth: truth, ok: ok };
        selected = null;
        render();
      },
      clearFeedback: function () {
        feedback = null;
        render();
      },
      setGuesses: function (map) {
        if (feedback) return;
        Object.keys(map || {}).forEach(function (slot) {
          if (isAsked(slot)) guesses[slot] = map[slot];
        });
        render();
      },
      select: select,
      setAskedKeys: function (slots) {
        asked = (slots || []).slice();
        selected = null;
        feedback = null;
        render();
      },
      get askedKeys() { return asked.slice(); },
      get selected() { return selected; },
      render: render,
      destroy: function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        selected = null;
        feedback = null;
      }
    };

    if (asked.length) selected = asked[0];
    render();
    return api;
  }

  window.GuandanGrid = { createAnswerGrid: createAnswerGrid, CANON: CANON };
})();
