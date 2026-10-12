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

  function createInitialCounts() {
    var counts = {};
    RANKS.forEach(function (r) { counts[r] = COPIES_PER_RANK; });
    counts[SMALL_JOKER] = COPIES_PER_JOKER;
    counts[BIG_JOKER] = COPIES_PER_JOKER;
    return counts;
  }

  function totalRemaining(counts) {
    return ALL_KEYS.reduce(function (sum, k) { return sum + (counts[k] || 0); }, 0);
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

  // 核对：返回不一致格子的列表 [{key, user, truth}]，空数组 = 全对
  function checkAnswer(userCounts, playedCards) {
    var truth = trueRemaining(playedCards);
    var wrong = [];
    ALL_KEYS.forEach(function (k) {
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
    createInitialCounts: createInitialCounts,
    totalRemaining: totalRemaining,
    decrement: decrement,
    createDeck: createDeck,
    shuffle: shuffle,
    countPlayed: countPlayed,
    trueRemaining: trueRemaining,
    checkAnswer: checkAnswer
  };
});
