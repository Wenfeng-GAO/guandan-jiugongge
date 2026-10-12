/* node check.js — 自检：牌堆(108张) / 减数 / 洗牌 / 核对 / 级牌与三档范围 */
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
assert.deepStrictEqual(L.JOKERS, ['小王', '大王']);  // ALL_KEYS 后缀顺序不变

// —— 级牌与三档范围 ——
assert.strictEqual(L.DEFAULT_SCOPE, L.SCOPES.LEVEL_AND_JOKERS, '默认范围必须是「只练级牌&王」');
assert.strictEqual(L.DEFAULT_LEVEL_RANK, '2', '默认级牌为 2');

assert.deepStrictEqual(L.getScopeKeys('level', '2'), ['2', '大王', '小王']);
assert.deepStrictEqual(L.getScopeKeys('level', 'A'), ['A', '大王', '小王']);
assert.deepStrictEqual(L.getScopeKeys('nine', '2'), L.RANKS.slice(0, 9));
assert.deepStrictEqual(L.getScopeKeys('all', 'K'), L.ALL_KEYS);
assert.throws(function () { L.getScopeKeys('xxx'); }, /未知范围/);
assert.throws(function () { L.getScopeKeys('level', 'X'); }, /未知级牌/);
assert.throws(function () { L.getScopeKeys('level', '小王'); }, /未知级牌/);

var lc = L.createInitialCountsForScope('level', '2');
assert.strictEqual(lc['2'], 8, '级牌在范围内，应为 8');
assert.strictEqual(lc['小王'], 2);
assert.strictEqual(lc['大王'], 2);
assert.strictEqual(lc['3'], 0, '范围外点数应为 0');
assert.strictEqual(lc['J'], 0, '范围外点数应为 0');
assert.strictEqual(L.totalRemaining(lc, L.getScopeKeys('level', '2')), 12);
assert.strictEqual(L.totalRemaining(lc), 12, '范围外为 0，全量求和也只算范围内');

assert.strictEqual(L.scopeInitialTotal('level', '2'), 12, '级牌 8 + 王 2+2 = 12');
assert.strictEqual(L.scopeInitialTotal('level', 'A'), 12);
assert.strictEqual(L.scopeInitialTotal('nine', '5'), 72);
assert.strictEqual(L.scopeInitialTotal('all', '2'), 108);

var scopeDeck = L.createDeckForScope('level', '2');
assert.strictEqual(scopeDeck.length, 12, '级牌档子牌堆应为 12 张');
var sd = {};
scopeDeck.forEach(function (c) { sd[c] = (sd[c] || 0) + 1; });
assert.deepStrictEqual(sd, { '2': 8, '大王': 2, '小王': 2 }, '级牌档牌堆构成');
assert.strictEqual(L.createDeckForScope('level', 'Q').length, 12);
assert.strictEqual(L.createDeckForScope('nine', '2').length, 72);
assert.strictEqual(L.createDeckForScope('all', '2').length, 108);

var levelA = L.createDeckForScope('level', 'A');
assert.strictEqual(levelA.length, 12, '级牌 A 的子牌堆应为 12 张');
var la = {};
levelA.forEach(function (c) { la[c] = (la[c] || 0) + 1; });
assert.deepStrictEqual(la, { 'A': 8, '大王': 2, '小王': 2 }, '级牌 A 应有 8 张 A');

// 九宫格档不因级牌是 A 就把 A 或王算进去
var nineA = L.createDeckForScope('nine', 'A');
assert.strictEqual(nineA.length, 72);
assert.strictEqual(nineA.indexOf('A'), -1, '九宫格范围不含 A');
assert.strictEqual(nineA.indexOf(L.SMALL_JOKER), -1);
assert.strictEqual(nineA.indexOf(L.BIG_JOKER), -1);
assert.strictEqual(nineA.filter(function (c) { return c === '10'; }).length, 8);

var filtered = L.filterDeckByScope(deck, 'level', 'A');
assert.strictEqual(filtered.length, 12, '过滤后应为 12 张');
assert.strictEqual(deck.length, 108, 'filter 不应改动原牌堆');
var fd = {};
filtered.forEach(function (c) { fd[c] = (fd[c] || 0) + 1; });
assert.deepStrictEqual(fd, { 'A': 8, '大王': 2, '小王': 2 });

// 核对只比范围内：范围外记错不应报
var playedScope = ['2', '2', '小王'];
var userScope = L.createInitialCountsForScope('level', '2');
userScope['2'] = 6;
userScope['小王'] = 1;
userScope['3'] = 7; // 范围外，必须被忽略
userScope['A'] = 0; // 范围外，必须被忽略
assert.deepStrictEqual(
  L.checkAnswer(userScope, playedScope, L.getScopeKeys('level', '2')),
  [],
  '范围外记错不应影响核对结果'
);

userScope['2'] = 5;
var wrongScope = L.checkAnswer(userScope, playedScope, L.getScopeKeys('level', '2'));
assert.deepStrictEqual(wrongScope.map(function (w) { return w.key; }), ['2']);
assert.strictEqual(wrongScope[0].user, 5);
assert.strictEqual(wrongScope[0].truth, 6);

// 默认参数行为不变：不传 scopeKeys 仍核对全牌
var userAll = L.createInitialCounts();
userAll['2'] = 6;
userAll['小王'] = 1;
userAll['3'] = 7;
var wrongAll = L.checkAnswer(userAll, playedScope);
assert.deepStrictEqual(wrongAll.map(function (w) { return w.key; }), ['3']);

// 子牌堆抽完：范围内真实剩余全 0
var smallDeck = L.shuffle(L.createDeckForScope('level', '2'));
var truthScope = L.trueRemaining(smallDeck);
assert.strictEqual(truthScope['2'], 0);
assert.strictEqual(truthScope['小王'], 0);
assert.strictEqual(truthScope['大王'], 0);
var zeroScope = L.createInitialCountsForScope('level', '2');
L.getScopeKeys('level', '2').forEach(function (k) { zeroScope[k] = 0; });
assert.deepStrictEqual(L.checkAnswer(zeroScope, smallDeck, L.getScopeKeys('level', '2')), []);


// 10. 级牌为 A 时「只练级牌&王」：子牌堆 12 张，其中 A 8 张、大小王各 2
var deckA = L.createDeckForScope(L.SCOPES.LEVEL_AND_JOKERS, 'A');
assert.strictEqual(deckA.length, 12, '级牌 A 时子牌堆应为 12');
var aCount = deckA.filter(function (c) { return c === 'A'; }).length;
assert.strictEqual(aCount, 8, '级牌 A 时应有 8 张 A');
assert.strictEqual(deckA.filter(function (c) { return c === L.SMALL_JOKER; }).length, 2);
assert.strictEqual(deckA.filter(function (c) { return c === L.BIG_JOKER; }).length, 2);
assert.deepStrictEqual(L.getScopeKeys('level', 'A'), ['A', L.BIG_JOKER, L.SMALL_JOKER]);
// 九宫格范围不含级牌 A，但级牌设置仍合法（UI 仍可高亮 A）
assert.strictEqual(L.getScopeKeys('nine', 'A').indexOf('A'), -1);
assert.strictEqual(L.createInitialCountsForScope('nine', 'A')['A'], 0);

// legacy checks passed


// —— v4：三行地图 / 点改 / 连对升档 / 闭卷核对 ——
assert.deepStrictEqual(L.getRowKeys(1, '2'), ['2', '大王', '小王']);
assert.deepStrictEqual(L.getRowKeys(1, 'A'), ['A', '大王', '小王']);
assert.deepStrictEqual(L.getRowKeys(2, '2'), ['A', 'K', 'Q']);
assert.deepStrictEqual(L.getRowKeys(3, '2'), ['J', '10', '9']);
assert.throws(function () { L.getRowKeys(4, '2'); }, /未知行/);

assert.deepStrictEqual(L.getUnlockedKeys(1, '2'), ['2', '大王', '小王']);
assert.deepStrictEqual(L.getUnlockedKeys(2, '2'), ['2', '大王', '小王', 'A', 'K', 'Q']);
assert.deepStrictEqual(L.getUnlockedKeys(3, '2'), ['2', '大王', '小王', 'A', 'K', 'Q', 'J', '10', '9']);
// 级牌与行2重叠时去重
assert.deepStrictEqual(L.getUnlockedKeys(2, 'A'), ['A', '大王', '小王', 'K', 'Q']);
assert.strictEqual(L.getUnlockedKeys(2, 'A').filter(function (k) { return k === 'A'; }).length, 1);

assert.strictEqual(L.maxCopies('2'), 8);
assert.strictEqual(L.maxCopies('小王'), 2);
assert.strictEqual(L.cycleGuess(0, '小王'), 1);
assert.strictEqual(L.cycleGuess(1, '小王'), 2);
assert.strictEqual(L.cycleGuess(2, '小王'), 0);
assert.strictEqual(L.cycleGuess(8, '2'), 0);
assert.strictEqual(L.cycleGuess(7, '2'), 8);

var keys1 = L.getUnlockedKeys(1, '2');
assert.strictEqual(L.scopeInitialTotalForKeys(keys1), 12);
var deck1 = L.createDeckForKeys(keys1);
assert.strictEqual(deck1.length, 12);

var keys2 = L.getUnlockedKeys(2, '2');
assert.strictEqual(L.scopeInitialTotalForKeys(keys2), 12 + 24);
assert.strictEqual(L.createDeckForKeys(keys2).length, 36);

var keys3 = L.getUnlockedKeys(3, '2');
assert.strictEqual(L.createDeckForKeys(keys3).length, 60);

// 闭卷填剩余核对：只比解锁格
var playedV4 = ['2', '2', '大王'];
var guesses = L.createZeroGuesses(keys1);
guesses['2'] = 6;
guesses['大王'] = 1;
guesses['小王'] = 2;
assert.deepStrictEqual(L.checkAnswer(guesses, playedV4, keys1), []);
guesses['小王'] = 0;
var wrongV4 = L.checkAnswer(guesses, playedV4, keys1);
assert.strictEqual(wrongV4.length, 1);
assert.strictEqual(wrongV4[0].key, '小王');
assert.strictEqual(wrongV4[0].user, 0);
assert.strictEqual(wrongV4[0].truth, 2);

// 连对升档
var s0 = L.applyStreakAfterCheck(1, 0, true);
assert.deepStrictEqual(s0, { unlockedRows: 1, streak: 1, justUnlocked: false });
var s1 = L.applyStreakAfterCheck(1, 2, true);
assert.deepStrictEqual(s1, { unlockedRows: 2, streak: 0, justUnlocked: true });
var sFail = L.applyStreakAfterCheck(1, 2, false);
assert.deepStrictEqual(sFail, { unlockedRows: 1, streak: 0, justUnlocked: false });
var sMax = L.applyStreakAfterCheck(3, 2, true);
assert.deepStrictEqual(sMax, { unlockedRows: 3, streak: 3, justUnlocked: false });

assert.strictEqual(L.UNLOCK_STREAK_NEED, 3);
assert.ok(L.rowLabel(1).indexOf('级牌') !== -1);

console.log('OK：全部自检通过（含 v4 三行解锁 / 点改 / 连对升档 / 闭卷核对）');

