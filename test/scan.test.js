/* node test/scan.test.js — v5 开局扫牌：花色牌堆 / 逢人配随级 / 外剩 / 重发 / 排序 */
'use strict';
var assert = require('assert');
var L = require('../logic.js');

function card(rank, suit, id) {
  return { rank: rank, suit: suit, id: id };
}

// —— 108 张花色牌堆构成 ——
var deck = L.createSuitedDeck();
assert.strictEqual(deck.length, 108, '花色牌堆应为 108 张');
assert.deepStrictEqual(L.SUITS, ['♠', '♥', '♣', '♦']);

var ids = {};
var pairCount = {};
var nSmall = 0;
var nBig = 0;
deck.forEach(function (c) {
  assert.ok(c.id != null && c.id !== '', '每张牌应有 id');
  assert.strictEqual(ids[c.id], undefined, 'id 应唯一: ' + c.id);
  ids[c.id] = true;
  if (c.rank === L.SMALL_JOKER) {
    assert.strictEqual(c.suit, null, '小王 suit 应为 null');
    nSmall += 1;
  } else if (c.rank === L.BIG_JOKER) {
    assert.strictEqual(c.suit, null, '大王 suit 应为 null');
    nBig += 1;
  } else {
    assert.ok(L.RANKS.indexOf(c.rank) !== -1, '未知点数 ' + c.rank);
    assert.ok(L.SUITS.indexOf(c.suit) !== -1, '未知花色 ' + c.suit);
    var k = c.rank + c.suit;
    pairCount[k] = (pairCount[k] || 0) + 1;
  }
});
assert.strictEqual(Object.keys(ids).length, 108);
assert.strictEqual(nSmall, 2, '小王应为 2 张');
assert.strictEqual(nBig, 2, '大王应为 2 张');
assert.strictEqual(Object.keys(pairCount).length, 13 * 4, '13 点 × 4 花');
Object.keys(pairCount).forEach(function (k) {
  assert.strictEqual(pairCount[k], 2, k + ' 应为两副各 1 张');
});

// —— dealHand：27 张且 id 唯一 ——
var dealt = L.dealHand(function () { return 0.37; });
assert.strictEqual(dealt.length, 27, '默认发 27 张');
var dealtIds = {};
dealt.forEach(function (c) {
  assert.ok(c.id != null);
  assert.strictEqual(dealtIds[c.id], undefined, '手牌 id 应唯一: ' + c.id);
  dealtIds[c.id] = true;
});
assert.strictEqual(Object.keys(dealtIds).length, 27);
var dealtN = L.dealHand(function () { return 0.2; }, 10);
assert.strictEqual(dealtN.length, 10);

// —— outsideCounts：构造手牌验算 ——
var constructed = [];
constructed.push(card('5', '♥', 'l1'), card('5', '♠', 'l2'), card('5', '♣', 'l3'));
constructed.push(card(L.BIG_JOKER, null, 'b1'));
constructed.push(card(L.SMALL_JOKER, null, 's1'), card(L.SMALL_JOKER, null, 's2'));
for (var i = 0; i < 21; i++) constructed.push(card('A', '♠', 'f' + i));
assert.strictEqual(constructed.length, 27);
assert.deepStrictEqual(L.outsideCounts(constructed, '5'), { level: 5, big: 1, small: 0 });
assert.deepStrictEqual(L.outsideCounts([], 'K'), { level: 8, big: 2, small: 2 });

// —— 逢人配跟当前级走，勿写死 2 ——
var heart5 = card('5', '♥', 'h5');
var spade5 = card('5', '♠', 's5');
var heart2 = card('2', '♥', 'h2');
var clubA = card('A', '♣', 'cA');
assert.strictEqual(L.isWild(heart5, '5'), true, '打 5 时 ♥5 是逢人配');
assert.strictEqual(L.isWild(heart2, '5'), false, '打 5 时 ♥2 不是逢人配');
assert.strictEqual(L.isWild(spade5, '5'), false, '♠5 不是逢人配');
assert.strictEqual(L.isLevelCard(heart5, '5'), true);
assert.strictEqual(L.isLevelCard(spade5, '5'), true, '级牌含逢人配');
assert.strictEqual(L.isLevelCard(heart2, '5'), false);
assert.strictEqual(L.isWild(heart2, '2'), true, '打 2 时 ♥2 是逢人配');
assert.strictEqual(L.isWild(heart5, '2'), false, '打 2 时 ♥5 不是逢人配');
assert.strictEqual(L.isLevelCard(heart2, '2'), true);
assert.strictEqual(L.isWild(clubA, 'A'), false);
assert.strictEqual(L.isWild(card('A', '♥', 'hA'), 'A'), true);

// —— shouldRedeal 仅 8/2/2 ——
assert.strictEqual(L.shouldRedeal({ level: 8, big: 2, small: 2 }), true);
assert.strictEqual(L.shouldRedeal({ level: 8, big: 2, small: 1 }), false);
assert.strictEqual(L.shouldRedeal({ level: 7, big: 2, small: 2 }), false);
assert.strictEqual(L.shouldRedeal({ level: 8, big: 1, small: 2 }), false);
assert.strictEqual(L.shouldRedeal({ level: 0, big: 0, small: 0 }), false);

// —— dealScanHand：第一手全满则重发 ——
// 花色牌堆顺序为两副「2–A × 花色 + 小王 + 大王」。Fisher–Yates 在 rng≈1 时恒等，
// 前 27 张只有低点，级=A 时外剩 8/2/2。第二手第一次交换把末张大王换到 [0]。
var SHUFFLE_CALLS = 107;
var nCalls = 0;
function scriptedRng() {
  nCalls += 1;
  var pos = ((nCalls - 1) % SHUFFLE_CALLS) + 1;
  var pass = Math.floor((nCalls - 1) / SHUFFLE_CALLS);
  if (pass === 0) return 0.999;
  if (pos === 1) return 0;
  return 0.999;
}
var identityHand = L.dealHand(function () { return 0.999; });
assert.ok(
  L.shouldRedeal(L.outsideCounts(identityHand, 'A')),
  '恒等洗牌 + 级 A 的第一手应全满、需重发'
);
var scanned = L.dealScanHand('A', scriptedRng);
assert.ok(scanned.redeals >= 1, '第一手全满时应至少重发 1 次');
assert.strictEqual(L.shouldRedeal(scanned.outside), false, '最终外剩不应全满');
assert.strictEqual(scanned.hand.length, 27);
assert.deepStrictEqual(
  scanned.hand.map(function (c) { return c.id; }),
  L.sortHand(scanned.hand, 'A').map(function (c) { return c.id; }),
  'dealScanHand 应返回已排序手牌'
);

// —— sortHand：大王 > 小王 > 级牌（♥ 逢人配在前）> A … 2，同点 ♠♥♣♦ ——
var unsorted = [
  card('2', '♠', '2s'),
  card('A', '♦', 'Ad'),
  card('A', '♠', 'As'),
  card('5', '♣', '5c'),
  card('5', '♥', '5h'),
  card('5', '♠', '5s'),
  card('5', '♦', '5d'),
  card(L.SMALL_JOKER, null, 'xj'),
  card(L.BIG_JOKER, null, 'dj'),
  card('K', '♥', 'Kh'),
  card('3', '♦', '3d')
];
var sorted = L.sortHand(unsorted, '5');
assert.deepStrictEqual(sorted.map(function (c) { return c.id; }), [
  'dj', 'xj', '5h', '5s', '5c', '5d', 'As', 'Ad', 'Kh', '3d', '2s'
]);
assert.deepStrictEqual(
  unsorted.map(function (c) { return c.id; }),
  ['2s', 'Ad', 'As', '5c', '5h', '5s', '5d', 'xj', 'dj', 'Kh', '3d'],
  'sortHand 不应改动原数组'
);
var sortedA = L.sortHand([
  card('A', '♣', 'Ac'),
  card('A', '♥', 'Ah'),
  card('K', '♠', 'Ks'),
  card(L.BIG_JOKER, null, 'dj2')
], 'A');
assert.deepStrictEqual(sortedA.map(function (c) { return c.id; }), ['dj2', 'Ah', 'Ac', 'Ks']);

// —— numberOptions：点数 0–8（长度 9），王 0–2（长度 3） ——
assert.strictEqual(L.numberOptions('A').length, 9);
assert.strictEqual(L.numberOptions('5').length, 9);
assert.deepStrictEqual(L.numberOptions('K'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
assert.strictEqual(L.numberOptions(L.BIG_JOKER).length, 3);
assert.strictEqual(L.numberOptions(L.SMALL_JOKER).length, 3);
assert.deepStrictEqual(L.numberOptions(L.SMALL_JOKER), [0, 1, 2]);

// —— checkScan ——
var scanKeys = ['level', 'big', 'small'];
var chk = L.checkScan({ level: 5, big: 1, small: 2 }, { level: 5, big: 2, small: 2 }, scanKeys);
assert.strictEqual(chk.length, 3);
assert.deepStrictEqual(chk[0], { key: 'level', user: 5, truth: 5, ok: true });
assert.deepStrictEqual(chk[1], { key: 'big', user: 1, truth: 2, ok: false });
assert.deepStrictEqual(chk[2], { key: 'small', user: 2, truth: 2, ok: true });

console.log('OK：scan.test.js 全部通过');
