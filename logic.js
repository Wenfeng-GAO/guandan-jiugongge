/* 掼蛋九宫格记牌练习 - 纯逻辑层（浏览器与 Node 共用） */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.GuandanLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 固定布局：3×3 九宫格 2–10，另起一行 J Q K A，单独格子小王、大王
  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var SMALL_JOKER = '小王';
  var BIG_JOKER = '大王';
  var JOKERS = [SMALL_JOKER, BIG_JOKER];
  var ALL_KEYS = RANKS.concat(JOKERS);

  var COPIES_PER_RANK = 8;   // 两副牌：每种点数 2 副 × 4 花色 = 8 张
  var COPIES_PER_JOKER = 2;  // 小王 2、大王 2
  var TOTAL_CARDS = 108;     // 两副牌共 108 张

  // 练习范围（三档，默认不是全牌）
  var SCOPES = {
    LEVEL_AND_JOKERS: 'level', // 只练级牌&王
    NINE: 'nine',              // 九宫格 2–10
    ALL: 'all'                 // 全牌
  };
  var DEFAULT_SCOPE = SCOPES.LEVEL_AND_JOKERS;
  var DEFAULT_LEVEL_RANK = '2';

  function isValidRank(r) { return RANKS.indexOf(r) !== -1; }

  function isValidScope(scope) {
    return scope === SCOPES.LEVEL_AND_JOKERS ||
      scope === SCOPES.NINE ||
      scope === SCOPES.ALL;
  }

  // 当前练习范围内的点数列表
  function getScopeKeys(scope, levelRank) {
    scope = scope || DEFAULT_SCOPE;
    levelRank = levelRank || DEFAULT_LEVEL_RANK;
    if (!isValidScope(scope)) throw new Error('未知范围: ' + scope);
    if (scope === SCOPES.NINE) return RANKS.slice(0, 9);
    if (scope === SCOPES.ALL) return ALL_KEYS.slice();
    if (!isValidRank(levelRank)) throw new Error('未知级牌: ' + levelRank);
    return [levelRank, SMALL_JOKER, BIG_JOKER];
  }

  function createInitialCounts() {
    var counts = {};
    RANKS.forEach(function (r) { counts[r] = COPIES_PER_RANK; });
    counts[SMALL_JOKER] = COPIES_PER_JOKER;
    counts[BIG_JOKER] = COPIES_PER_JOKER;
    return counts;
  }

  // 范围版初始记数：范围内为初始张数，范围外固定 0（不参与统计与核对）
  function createInitialCountsForScope(scope, levelRank) {
    var keys = getScopeKeys(scope, levelRank);
    var init = createInitialCounts();
    var counts = {};
    ALL_KEYS.forEach(function (k) {
      counts[k] = keys.indexOf(k) === -1 ? 0 : init[k];
    });
    return counts;
  }

  // 范围内的初始总张数（如级牌 8 + 王 2+2 = 12）
  function scopeInitialTotal(scope, levelRank) {
    return totalRemaining(createInitialCountsForScope(scope, levelRank));
  }

  // keys 缺省为全牌；传 scopeKeys 时只统计范围内
  function totalRemaining(counts, keys) {
    keys = keys || ALL_KEYS;
    return keys.reduce(function (sum, k) { return sum + (counts[k] || 0); }, 0);
  }

  // 减 1，最低 0；成功返回 true，已为 0 返回 false
  function decrement(counts, key) {
    if (ALL_KEYS.indexOf(key) === -1) throw new Error('未知点数: ' + key);
    if (counts[key] <= 0) return false;
    counts[key] -= 1;
    return true;
  }

  // 洗一副完整的 108 张牌（用点数字符串表示）
  function createDeck() {
    var deck = [];
    for (var d = 0; d < 2; d++) {
      RANKS.forEach(function (r) {
        for (var i = 0; i < 4; i++) deck.push(r); // 每副牌 4 个花色
      });
      deck.push(SMALL_JOKER, BIG_JOKER);
    }
    return deck;
  }

  // 只保留范围内的牌（108 → 12 / 72 / 108）
  function filterDeckByScope(deck, scope, levelRank) {
    var keys = getScopeKeys(scope, levelRank);
    return deck.filter(function (c) { return keys.indexOf(c) !== -1; });
  }

  // 范围内的子牌堆
  function createDeckForScope(scope, levelRank) {
    return filterDeckByScope(createDeck(), scope, levelRank);
  }

  // Fisher-Yates 洗牌，返回新数组，不改动原数组
  function shuffle(deck, rng) {
    rng = rng || Math.random;
    var a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 统计已翻出的牌里每种点数的张数
  function countPlayed(playedCards) {
    var played = {};
    ALL_KEYS.forEach(function (k) { played[k] = 0; });
    playedCards.forEach(function (c) {
      if (ALL_KEYS.indexOf(c) === -1) throw new Error('未知牌: ' + c);
      played[c] += 1;
    });
    return played;
  }

  // 真实剩余 = 初始值 - 已翻出
  function trueRemaining(playedCards) {
    var init = createInitialCounts();
    var played = countPlayed(playedCards);
    var rem = {};
    ALL_KEYS.forEach(function (k) { rem[k] = init[k] - played[k]; });
    return rem;
  }

  // 核对：只比较 scopeKeys（缺省全牌），范围外不标红绿；
  // 返回不一致格子的列表 [{key, user, truth}]，空数组 = 全对
  function checkAnswer(userCounts, playedCards, scopeKeys) {
    var truth = trueRemaining(playedCards);
    var keys = scopeKeys || ALL_KEYS;
    var wrong = [];
    keys.forEach(function (k) {
      if (userCounts[k] !== truth[k]) {
        wrong.push({ key: k, user: userCounts[k], truth: truth[k] });
      }
    });
    return wrong;
  }

  return {
    RANKS: RANKS,
    JOKERS: JOKERS,
    ALL_KEYS: ALL_KEYS,
    SMALL_JOKER: SMALL_JOKER,
    BIG_JOKER: BIG_JOKER,
    COPIES_PER_RANK: COPIES_PER_RANK,
    COPIES_PER_JOKER: COPIES_PER_JOKER,
    TOTAL_CARDS: TOTAL_CARDS,
    SCOPES: SCOPES,
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    DEFAULT_LEVEL_RANK: DEFAULT_LEVEL_RANK,
    getScopeKeys: getScopeKeys,
    createInitialCounts: createInitialCounts,
    createInitialCountsForScope: createInitialCountsForScope,
    scopeInitialTotal: scopeInitialTotal,
    totalRemaining: totalRemaining,
    decrement: decrement,
    createDeck: createDeck,
    filterDeckByScope: filterDeckByScope,
    createDeckForScope: createDeckForScope,
    shuffle: shuffle,
    countPlayed: countPlayed,
    trueRemaining: trueRemaining,
    checkAnswer: checkAnswer
  };
});
