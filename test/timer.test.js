/* node test/timer.test.js — v7 整场 15 分钟会话计时器 */
'use strict';
var assert = require('assert');
var GuandanTimer = require('../timer.js');

var FIFTEEN = 15 * 60 * 1000;

function clockNow() {
  var t = 0;
  function now() { return t; }
  now.add = function (ms) { t += ms; return t; };
  now.value = function () { return t; };
  return now;
}

function fakeDoc() {
  var map = {};
  return {
    hidden: false,
    addEventListener: function (type, fn) {
      if (!map[type]) map[type] = [];
      map[type].push(fn);
    },
    removeEventListener: function (type, fn) {
      if (!map[type]) return;
      map[type] = map[type].filter(function (f) { return f !== fn; });
    },
    fire: function (type) {
      (map[type] || []).slice().forEach(function (fn) { fn(); });
    }
  };
}

function collect(timer) {
  var ev = [];
  ['change', 'pause', 'resume', 'timeup', 'summary'].forEach(function (name) {
    timer.on(name, function (reason) {
      ev.push({ type: name, reason: reason });
    });
  });
  return ev;
}

function types(ev) {
  return ev.map(function (e) { return e.type; });
}

// —— DEFAULT_LEVELS ——
assert.deepStrictEqual(GuandanTimer.DEFAULT_LEVELS, [
  { id: 'scan', name: '开局扫牌', suggestMin: 3 },
  { id: 'closed', name: '出牌闭卷', suggestMin: 5 },
  { id: 'sim', name: '实战模拟', suggestMin: 7 }
]);

// —— 仅第一盘开始计时；开始前空转不算 ——
var clock = clockNow();
var t = GuandanTimer.create({ now: clock });
var s = t.getState();
assert.strictEqual(s.status, 'idle');
assert.strictEqual(s.elapsedMs, 0);
assert.strictEqual(s.remainingMs, FIFTEEN);
assert.strictEqual(s.progress, 0);
assert.strictEqual(s.label, '15:00');
assert.strictEqual(s.roundInProgress, false);

clock.add(8000);
t.tick();
s = t.getState();
assert.strictEqual(s.status, 'idle', '未开第一盘不应起表');
assert.strictEqual(s.elapsedMs, 0);
assert.strictEqual(s.label, '15:00');

t.pause('manual');
t.togglePause();
assert.strictEqual(t.getState().status, 'idle', 'idle 时暂停无意义');
assert.strictEqual(t.isPaused(), false);

t.roundStarted('scan');
s = t.getState();
assert.strictEqual(s.status, 'running');
assert.strictEqual(s.roundInProgress, true);
assert.strictEqual(s.elapsedMs, 0);
assert.strictEqual(s.label, '15:00');

clock.add(1000);
t.tick();
s = t.getState();
assert.strictEqual(s.elapsedMs, 1000);
assert.strictEqual(s.remainingMs, FIFTEEN - 1000);
assert.strictEqual(s.label, '14:59');
assert.ok(Math.abs(s.progress - 1000 / FIFTEEN) < 1e-12);

// —— 换关 / 回首页不重置、不暂停 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock });
var ev = collect(t);
t.roundStarted('scan');
clock.add(2000);
t.roundStarted('closed');
t.tick();
s = t.getState();
assert.strictEqual(s.status, 'running', '换关不应暂停');
assert.strictEqual(s.elapsedMs, 2000, '换关不应重置');
assert.strictEqual(s.roundInProgress, true);
assert.ok(types(ev).indexOf('pause') === -1, '换关不应发出 pause');

clock.add(3000);
t.tick();
s = t.getState();
assert.strictEqual(s.status, 'running', '回首页（无 API）不应暂停');
assert.strictEqual(s.elapsedMs, 5000, '回首页不应重置');
assert.ok(types(ev).indexOf('pause') === -1);

t.roundFinished('closed', true);
s = t.getState();
assert.strictEqual(s.roundInProgress, false);
assert.strictEqual(s.status, 'running');
assert.strictEqual(t.getSummary().rows[0].text, '—', '扫牌未打完不计盘');
assert.strictEqual(t.getSummary().rows[1].text, '1 盘 · 对 1');

// —— 手动暂停 / 恢复：暂停时段不计时 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock });
ev = collect(t);
t.roundStarted('sim');
clock.add(4000);
t.pause('manual');
assert.strictEqual(t.isPaused(), true);
s = t.getState();
assert.strictEqual(s.status, 'paused');
assert.strictEqual(s.elapsedMs, 4000);
assert.strictEqual(s.label, '14:56');
assert.deepStrictEqual(types(ev).filter(function (x) { return x === 'pause' || x === 'resume'; }), ['pause']);
assert.strictEqual(ev.filter(function (e) { return e.type === 'pause'; })[0].reason, 'manual');

clock.add(12000);
t.tick();
assert.strictEqual(t.getState().elapsedMs, 4000, '暂停期间 elapsed 冻结');
assert.strictEqual(t.getState().remainingMs, FIFTEEN - 4000);

t.resume();
assert.strictEqual(t.isPaused(), false);
assert.strictEqual(t.getState().status, 'running');
assert.strictEqual(t.getState().elapsedMs, 4000);
clock.add(1000);
t.tick();
assert.strictEqual(t.getState().elapsedMs, 5000, '恢复后只计运行时间');

t.togglePause();
assert.strictEqual(t.isPaused(), true);
t.togglePause();
assert.strictEqual(t.isPaused(), false);
assert.strictEqual(t.getState().elapsedMs, 5000);

// —— 切后台：hidden 自动暂停，visible 不自动恢复 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock });
ev = collect(t);
var doc = fakeDoc();
var detach = t.attachVisibility(doc);
t.roundStarted('scan');
clock.add(1500);
doc.hidden = true;
doc.fire('visibilitychange');
assert.strictEqual(t.isPaused(), true, 'hidden 应自动暂停');
assert.strictEqual(t.getState().status, 'paused');
assert.strictEqual(t.getState().elapsedMs, 1500);
var hiddenPause = ev.filter(function (e) { return e.type === 'pause'; });
assert.strictEqual(hiddenPause.length, 1);
assert.strictEqual(hiddenPause[0].reason, 'hidden');

clock.add(9000);
doc.hidden = false;
doc.fire('visibilitychange');
assert.strictEqual(t.isPaused(), true, 'visible 不应自动恢复');
assert.strictEqual(t.getState().elapsedMs, 1500);
assert.ok(types(ev).indexOf('resume') === -1);

t.resume();
assert.strictEqual(t.isPaused(), false);
clock.add(500);
t.tick();
assert.strictEqual(t.getState().elapsedMs, 2000);

detach();
doc.hidden = true;
doc.fire('visibilitychange');
assert.strictEqual(t.isPaused(), false, 'detach 后不应再自动暂停');

// —— 时间到时正在打：等 roundFinished 才出小结，文案「时间到 · 打完这盘」 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock, durationMs: 10 * 1000 });
ev = collect(t);
t.roundStarted('scan');
clock.add(10 * 1000);
t.tick();
s = t.getState();
assert.strictEqual(s.status, 'timeup');
assert.strictEqual(s.roundInProgress, true);
assert.strictEqual(s.label, '时间到 · 打完这盘');
assert.strictEqual(s.remainingMs, 0);
assert.strictEqual(s.elapsedMs, 10 * 1000);
assert.strictEqual(s.progress, 1);
assert.strictEqual(types(ev).filter(function (x) { return x === 'timeup'; }).length, 1);
assert.ok(types(ev).indexOf('summary') === -1, '盘未结束不应出小结');

t.tick();
assert.strictEqual(types(ev).filter(function (x) { return x === 'timeup'; }).length, 1, 'timeup 只发一次');
assert.strictEqual(t.getState().status, 'timeup');
assert.strictEqual(t.getState().label, '时间到 · 打完这盘');

t.roundFinished('scan', true);
s = t.getState();
assert.strictEqual(s.status, 'summary');
assert.strictEqual(s.roundInProgress, false);
assert.strictEqual(s.label, '00:00');
assert.strictEqual(types(ev).filter(function (x) { return x === 'summary'; }).length, 1);

t.roundStarted('closed');
assert.strictEqual(t.getState().status, 'summary', '小结后须 reset 才能再开盘');

// —— 时间到时没有进行中的盘：立刻出小结 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock, durationMs: 5000 });
ev = collect(t);
t.roundStarted('closed');
t.roundFinished('closed', false);
assert.strictEqual(t.getState().roundInProgress, false);
clock.add(5000);
t.tick();
s = t.getState();
assert.strictEqual(s.status, 'summary');
assert.strictEqual(s.label, '00:00');
assert.ok(types(ev).indexOf('timeup') !== -1);
assert.ok(types(ev).indexOf('summary') !== -1);
assert.ok(types(ev).indexOf('timeup') < types(ev).indexOf('summary'), '先 timeup 再 summary');

t.tick();
assert.strictEqual(types(ev).filter(function (x) { return x === 'summary'; }).length, 1, 'summary 只发一次');

// —— 各关盘数；没玩显示「—」 ——
clock = clockNow();
t = GuandanTimer.create({ now: clock });
t.roundStarted('scan');
t.roundFinished('scan', true);
t.roundStarted('scan');
t.roundFinished('scan', false);
t.roundStarted('closed');
t.roundFinished('closed', true);
var sum = t.getSummary();
assert.strictEqual(sum.total, 3);
assert.strictEqual(sum.totalCorrect, 2);
assert.strictEqual(sum.rows.length, 3);
assert.deepStrictEqual(sum.rows[0], {
  id: 'scan',
  name: '开局扫牌',
  suggestMin: 3,
  played: 2,
  correct: 1,
  text: '2 盘 · 对 1'
});
assert.deepStrictEqual(sum.rows[1], {
  id: 'closed',
  name: '出牌闭卷',
  suggestMin: 5,
  played: 1,
  correct: 1,
  text: '1 盘 · 对 1'
});
assert.deepStrictEqual(sum.rows[2], {
  id: 'sim',
  name: '实战模拟',
  suggestMin: 7,
  played: 0,
  correct: 0,
  text: '—'
});

// —— reset：回到 idle，15:00，盘数清零（再来 15 分钟） ——
clock.add(3000);
t.reset();
s = t.getState();
assert.strictEqual(s.status, 'idle');
assert.strictEqual(s.elapsedMs, 0);
assert.strictEqual(s.remainingMs, FIFTEEN);
assert.strictEqual(s.progress, 0);
assert.strictEqual(s.label, '15:00');
assert.strictEqual(s.roundInProgress, false);
assert.strictEqual(t.isPaused(), false);
sum = t.getSummary();
assert.strictEqual(sum.total, 0);
assert.strictEqual(sum.totalCorrect, 0);
sum.rows.forEach(function (row) {
  assert.strictEqual(row.played, 0);
  assert.strictEqual(row.correct, 0);
  assert.strictEqual(row.text, '—');
});

clock.add(4000);
t.tick();
assert.strictEqual(t.getState().status, 'idle');
assert.strictEqual(t.getState().elapsedMs, 0);
t.roundStarted('sim');
clock.add(2000);
t.tick();
assert.strictEqual(t.getState().status, 'running');
assert.strictEqual(t.getState().elapsedMs, 2000);

console.log('OK：timer.test.js 全部通过');
