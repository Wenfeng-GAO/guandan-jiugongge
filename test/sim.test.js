/* node test/sim.test.js — v6 实战模拟：发牌翻 N / 外剩 / 逢人配随级 / 连对升档 */
'use strict';
var assert = require('node:assert');
var L = require('../logic.js');

function countRank(cards, rank) {
  var n = 0;
  cards.forEach(function (c) {
    if (c.rank === rank) n += 1;
  });
  return n;
}

function lcg(seed) {
  var s = seed >>> 0;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function idsOf(cards) {
  return cards.map(function (c) { return c.id; });
}

assert.deepStrictEqual(L.SIM_N_BASE, [10, 30]);
assert.deepStrictEqual(L.SIM_N_UP, [20, 50]);
assert.strictEqual(L.SIM_FLIP_MS, 1500);

// —— 档位下标 / 状态 → N 区间 ——
assert.deepStrictEqual(L.simNRange(0), [10, 30]);
assert.deepStrictEqual(L.simNRange(1), [20, 50]);
assert.deepStrictEqual(L.simNRange(2), [20, 50]);
assert.deepStrictEqual(L.simNRange(false), [10, 30]);
assert.deepStrictEqual(L.simNRange(true), [20, 50]);
assert.deepStrictEqual(L.simNRange({ streak: 0, upgraded: false }), [10, 30]);
assert.deepStrictEqual(L.simNRange({ streak: 9, upgraded: false }), [10, 30]);
assert.deepStrictEqual(L.simNRange({ streak: 0, upgraded: true }), [20, 50]);

function assertRound(round, levelRank, min, max) {
  assert.strictEqual(round.hand.length, 27, '手牌应为 27 张');
  assert.ok(round.n >= min && round.n <= max, 'N 应落在 [' + min + ',' + max + ']，实际 ' + round.n);
  assert.strictEqual(round.flips.length, round.n, 'flips 张数应等于 N');
  assert.deepStrictEqual(
    idsOf(round.hand),
    idsOf(L.sortHand(round.hand, levelRank)),
    'hand 应已按级排序'
  );

  var seen = {};
  round.hand.concat(round.flips).forEach(function (c) {
    assert.ok(c.id != null && c.id !== '', '每张牌应有 id');
    assert.strictEqual(seen[c.id], undefined, '手牌与翻牌 id 不应重复: ' + c.id);
    seen[c.id] = true;
  });

  var handLevel = countRank(round.hand, levelRank);
  var flipLevel = countRank(round.flips, levelRank);
  var handBig = countRank(round.hand, L.BIG_JOKER);
  var flipBig = countRank(round.flips, L.BIG_JOKER);
  var handSmall = countRank(round.hand, L.SMALL_JOKER);
  var flipSmall = countRank(round.flips, L.SMALL_JOKER);

  assert.deepStrictEqual(round.handOutside, {
    level: 8 - handLevel,
    big: 2 - handBig,
    small: 2 - handSmall
  });
  assert.deepStrictEqual(round.flipDelta, {
    level: flipLevel,
    big: flipBig,
    small: flipSmall
  });
  assert.deepStrictEqual(round.finalOutside, {
    level: round.handOutside.level - round.flipDelta.level,
    big: round.handOutside.big - round.flipDelta.big,
    small: round.handOutside.small - round.flipDelta.small
  });
  assert.strictEqual(round.finalOutside.level, 8 - handLevel - flipLevel);
  assert.strictEqual(round.finalOutside.big, 2 - handBig - flipBig);
  assert.strictEqual(round.finalOutside.small, 2 - handSmall - flipSmall);
  assert.ok(round.finalOutside.level >= 0 && round.finalOutside.level <= 8);
  assert.ok(round.finalOutside.big >= 0 && round.finalOutside.big <= 2);
  assert.ok(round.finalOutside.small >= 0 && round.finalOutside.small <= 2);
  assert.strictEqual(L.shouldRedeal(round.handOutside), false, '重发后开局外剩不应全满');
}

// —— 闭区间端点：rng≈0 取 min，rng≈1 取 max（级=2，恒等洗牌不会全满重发） ——
var atMin = L.dealSimRound('2', function () { return 0; }, [10, 30]);
assert.strictEqual(atMin.n, 10);
assertRound(atMin, '2', 10, 30);
var atMax = L.dealSimRound('2', function () { return 0.999999; }, [10, 30]);
assert.strictEqual(atMax.n, 30);
assertRound(atMax, '2', 10, 30);
var upMin = L.dealSimRound('2', function () { return 0; }, L.SIM_N_UP);
assert.strictEqual(upMin.n, 20);
var upMax = L.dealSimRound('2', function () { return 0.999999; }, [20, 50]);
assert.strictEqual(upMax.n, 50);
assertRound(upMax, '2', 20, 50);

// 默认区间 [10,30]
var omitted = L.dealSimRound('5', lcg(7));
assertRound(omitted, '5', 10, 30);

// —— 多种子：N 落在给定区间，手牌+翻牌无重复 id ——
var seed;
for (seed = 1; seed <= 40; seed++) {
  assertRound(L.dealSimRound('2', lcg(seed)), '2', 10, 30);
  assertRound(L.dealSimRound('5', lcg(seed + 100), [20, 50]), '5', 20, 50);
  assertRound(L.dealSimRound('A', lcg(seed + 200), [10, 10]), 'A', 10, 10);
}

// —— 与 dealScanHand 同一重发规则、同一洗牌：级=A 恒等第一手全满则重发 ——
var SHUFFLE_CALLS = 107;
function scriptedRng() {
  var nCalls = 0;
  return function () {
    nCalls += 1;
    var pos = ((nCalls - 1) % SHUFFLE_CALLS) + 1;
    var pass = Math.floor((nCalls - 1) / SHUFFLE_CALLS);
    if (pass === 0) return 0.999;
    if (pos === 1) return 0;
    return 0.999;
  };
}
var scanned = L.dealScanHand('A', scriptedRng());
var simRedeal = L.dealSimRound('A', scriptedRng(), [10, 30]);
assert.ok(scanned.redeals >= 1, '对照：扫牌第一手应重发');
assert.deepStrictEqual(idsOf(simRedeal.hand), idsOf(scanned.hand), '重发后的手牌应与 dealScanHand 一致');
assert.deepStrictEqual(simRedeal.handOutside, scanned.outside);
assertRound(simRedeal, 'A', 10, 30);

// —— 翻完全部余牌：108 张无重复；逢人配跟当前级走（打 5 是 ♥5，打 2 是 ♥2） ——
function assertWildFollows(levelRank, seed) {
  var round = L.dealSimRound(levelRank, lcg(seed), [81, 81]);
  assert.strictEqual(round.n, 81);
  assert.strictEqual(round.hand.length + round.flips.length, 108);
  assertRound(round, levelRank, 81, 81);

  var other = levelRank === '5' ? '2' : '5';
  var wilds = [];
  var otherHearts = [];
  round.hand.concat(round.flips).forEach(function (c) {
    var wildHere = c.suit === '♥' && c.rank === levelRank;
    assert.strictEqual(L.isWild(c, levelRank), wildHere, '逢人配应是 ♥' + levelRank);
    assert.strictEqual(L.isLevelCard(c, levelRank), c.rank === levelRank);
    if (wildHere) wilds.push(c);
    if (c.suit === '♥' && c.rank === other) {
      assert.strictEqual(L.isWild(c, levelRank), false, '♥' + other + ' 在打 ' + levelRank + ' 时不是逢人配');
      otherHearts.push(c);
    }
  });
  assert.strictEqual(wilds.length, 2, '两副应有 2 张 ♥' + levelRank);
  assert.strictEqual(otherHearts.length, 2, '两副应有 2 张 ♥' + other);

  var wildInFlips = round.flips.filter(function (c) { return L.isWild(c, levelRank); }).length;
  assert.ok(round.flipDelta.level >= wildInFlips, '翻出的逢人配应计入级牌');
  assert.strictEqual(
    round.flipDelta.level,
    countRank(round.flips, levelRank),
    'flipDelta.level 含 ♥级，跟当前级走'
  );
  return round;
}

var as5 = assertWildFollows('5', 11);
var as2 = assertWildFollows('2', 11);
as5.flips.forEach(function (c) {
  if (c.suit === '♥' && c.rank === '5') assert.strictEqual(L.isWild(c, '2'), false);
  if (c.suit === '♥' && c.rank === '2') assert.strictEqual(L.isWild(c, '5'), false);
});
as2.flips.forEach(function (c) {
  if (c.suit === '♥' && c.rank === '2') assert.strictEqual(L.isWild(c, '5'), false);
});

// —— 连对 3 盘升档到 [20,50]；答错 streak 归零，升档保持 ——
var state = { streak: 0, upgraded: false };
state = L.applySimStreak(state, true);
assert.deepStrictEqual(state, {
  streak: 1, upgraded: false, nRange: [10, 30], justUpgraded: false
});
state = L.applySimStreak(state, true);
assert.strictEqual(state.streak, 2);
assert.strictEqual(state.upgraded, false);
assert.deepStrictEqual(state.nRange, [10, 30]);
assert.strictEqual(state.justUpgraded, false);

var broken = L.applySimStreak(state, false);
assert.deepStrictEqual(broken, {
  streak: 0, upgraded: false, nRange: [10, 30], justUpgraded: false
});

state = { streak: 0, upgraded: false };
state = L.applySimStreak(state, true);
state = L.applySimStreak(state, true);
state = L.applySimStreak(state, true);
assert.deepStrictEqual(state, {
  streak: 3, upgraded: true, nRange: [20, 50], justUpgraded: true
});
assert.deepStrictEqual(state.nRange, L.SIM_N_UP);
assert.deepStrictEqual(L.simNRange(state), [20, 50]);

var kept = L.applySimStreak(state, false);
assert.deepStrictEqual(kept, {
  streak: 0, upgraded: true, nRange: [20, 50], justUpgraded: false
});
var still = L.applySimStreak(kept, true);
assert.deepStrictEqual(still, {
  streak: 1, upgraded: true, nRange: [20, 50], justUpgraded: false
});
still = L.applySimStreak(still, true);
still = L.applySimStreak(still, true);
assert.strictEqual(still.streak, 3);
assert.strictEqual(still.upgraded, true);
assert.strictEqual(still.justUpgraded, false);
assert.deepStrictEqual(still.nRange, [20, 50]);

// 纯数字 streak：连对已有 2，再对一盘即升档
var fromNumber = L.applySimStreak(2, true);
assert.deepStrictEqual(fromNumber, {
  streak: 3, upgraded: true, nRange: [20, 50], justUpgraded: true
});

// 升档后的区间用于发牌
var upgradedRound = L.dealSimRound('K', lcg(99), kept.nRange);
assertRound(upgradedRound, 'K', 20, 50);

console.log('OK：sim.test.js 全部通过');
