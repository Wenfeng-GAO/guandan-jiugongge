/* node check.js — 自检：牌堆(108张) / 减数 / 洗牌 / 核对 */
'use strict';
var assert = require('assert');
var L = require('./logic.js');

var deck = L.createDeck();
assert.strictEqual(deck.length, 108, '牌堆应为 108 张');
assert.strictEqual(L.TOTAL_CARDS, 108);
var inDeck = {};
deck.forEach(function (c) { inDeck[c] = (inDeck[c] || 0) + 1; });
L.RANKS.forEach(function (r) {
  assert.strictEqual(inDeck[r], 8, r + ' 应为 8 张');
});
assert.strictEqual(inDeck[L.SMALL_JOKER], 2, '小王应为 2 张');
assert.strictEqual(inDeck[L.BIG_JOKER], 2, '大王应为 2 张');
assert.strictEqual(Object.keys(inDeck).length, 15, '应有 15 种点数（13+大小王）');

var counts = L.createInitialCounts();
assert.strictEqual(L.totalRemaining(counts), 108, '初始剩余总数应为 108');
L.RANKS.forEach(function (r) { assert.strictEqual(counts[r], 8); });
assert.strictEqual(counts[L.SMALL_JOKER], 2);
assert.strictEqual(counts[L.BIG_JOKER], 2);

assert.strictEqual(L.decrement(counts, '5'), true);
assert.strictEqual(counts['5'], 7);
counts['5'] = 0;
assert.strictEqual(L.decrement(counts, '5'), false, '减到 0 后不能再减');
assert.strictEqual(counts['5'], 0, '不能减成负数');
assert.throws(function () { L.decrement(counts, 'X'); }, /未知点数/, '未知点数应抛错');

var c2 = L.createInitialCounts();
assert.strictEqual(L.decrement(c2, L.BIG_JOKER), true);
assert.strictEqual(L.decrement(c2, L.BIG_JOKER), true);
assert.strictEqual(L.decrement(c2, L.BIG_JOKER), false);
assert.strictEqual(c2[L.BIG_JOKER], 0);

var before = deck.slice();
var shuffled = L.shuffle(deck);
assert.deepStrictEqual(deck, before, 'shuffle 不应改动原数组');
assert.strictEqual(shuffled.length, 108, '洗牌后仍应为 108 张');
assert.deepStrictEqual(
  shuffled.slice().sort(),
  deck.slice().sort(),
  '洗牌后每种牌张数不变'
);
var det = L.shuffle(['a', 'b', 'c', 'd'], function () { return 0.42; });
assert.strictEqual(det.length, 4);

var emptyTruth = L.trueRemaining([]);
assert.deepStrictEqual(emptyTruth, L.createInitialCounts());
assert.deepStrictEqual(L.checkAnswer(L.createInitialCounts(), []), [], '未翻牌时初始记数应对');

var played = ['2', '2', '小王', 'A', '10', '10', '10', '10', '10', '10', '10', '10'];
var truth = L.trueRemaining(played);
assert.strictEqual(truth['10'], 0, '8 张 10 全出后应为 0');
assert.strictEqual(truth['2'], 6);
assert.strictEqual(truth[L.SMALL_JOKER], 1);
assert.strictEqual(truth['5'], 8, '没出的点数仍是 8');

var user = L.createInitialCounts();
user['2'] = 6;
user['A'] = 7;
user[L.SMALL_JOKER] = 1;
user['10'] = 0;
assert.deepStrictEqual(L.checkAnswer(user, played), [], '全对应返回空数组');

user['A'] = 3;
user['2'] = 5;
var wrong = L.checkAnswer(user, played);
assert.strictEqual(wrong.length, 2);
var keys = wrong.map(function (w) { return w.key; }).sort();
assert.deepStrictEqual(keys, ['2', 'A']);

var full = L.shuffle(L.createDeck());
var afterAll = L.trueRemaining(full);
var allZero = L.createInitialCounts();
L.ALL_KEYS.forEach(function (k) {
  assert.strictEqual(afterAll[k], 0, k + ' 抽完应为 0');
  allZero[k] = 0;
});
assert.deepStrictEqual(L.checkAnswer(allZero, full), []);

assert.deepStrictEqual(L.RANKS.slice(0, 9), ['2', '3', '4', '5', '6', '7', '8', '9', '10']);
assert.deepStrictEqual(L.RANKS.slice(9), ['J', 'Q', 'K', 'A']);
assert.deepStrictEqual(L.JOKERS, ['小王', '大王']);

console.log('OK：全部自检通过（108 张牌堆 / 减数 / 洗牌 / 真实剩余 / 核对 / 布局常量）');
