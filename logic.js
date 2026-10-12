/* 掼蛋九宫格记牌练习 - 纯逻辑层（浏览器与 Node 共用）
 * v4：闭卷填剩余 + 三行渐进解锁（级/王 → A/K/Q → J/10/9）
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.GuandanLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var SMALL_JOKER = '小王';
  var BIG_JOKER = '大王';
  var JOKERS = [SMALL_JOKER, BIG_JOKER];
  var ALL_KEYS = RANKS.concat(JOKERS);

  var COPIES_PER_RANK = 8;
  var COPIES_PER_JOKER = 2;
  var TOTAL_CARDS = 108;

  var DEFAULT_LEVEL_RANK = '2';
  var UNLOCK_STREAK_NEED = 3;
  var MAX_UNLOCKED_ROWS = 3;

  function getRowKeys(rowIndex, levelRank) {
    levelRank = levelRank || DEFAULT_LEVEL_RANK;
    if (!isValidRank(levelRank)) throw new Error('未知级牌: ' + levelRank);
    if (rowIndex === 1) return [levelRank, BIG_JOKER, SMALL_JOKER];
    if (rowIndex === 2) return ['A', 'K', 'Q'];
    if (rowIndex === 3) return ['J', '10', '9'];
    throw new Error('未知行: ' + rowIndex);
  }

  function getUnlockedKeys(unlockedRows, levelRank) {
    unlockedRows = clampRows(unlockedRows);
    var seen = {};
    var keys = [];
    for (var r = 1; r <= unlockedRows; r++) {
      getRowKeys(r, levelRank).forEach(function (k) {
        if (!seen[k]) {
          seen[k] = true;
          keys.push(k);
        }
      });
    }
    return keys;
  }

  function clampRows(n) {
    n = n | 0;
    if (n < 1) return 1;
    if (n > MAX_UNLOCKED_ROWS) return MAX_UNLOCKED_ROWS;
    return n;
  }

  function isValidRank(r) { return RANKS.indexOf(r) !== -1; }

  function maxCopies(key) {
    if (key === SMALL_JOKER || key === BIG_JOKER) return COPIES_PER_JOKER;
    if (RANKS.indexOf(key) !== -1) return COPIES_PER_RANK;
    throw new Error('未知点数: ' + key);
  }

  function cycleGuess(current, key) {
    var max = maxCopies(key);
    var n = (current | 0) + 1;
    if (n > max) n = 0;
    return n;
  }

  function createInitialCounts() {
    var counts = {};
    RANKS.forEach(function (r) { counts[r] = COPIES_PER_RANK; });
    counts[SMALL_JOKER] = COPIES_PER_JOKER;
    counts[BIG_JOKER] = COPIES_PER_JOKER;
    return counts;
  }

  function createInitialCountsForKeys(keys) {
    var init = createInitialCounts();
    var counts = {};
    ALL_KEYS.forEach(function (k) {
      counts[k] = keys.indexOf(k) === -1 ? 0 : init[k];
    });
    return counts;
  }

  function createZeroGuesses(keys) {
    var g = {};
    ALL_KEYS.forEach(function (k) { g[k] = 0; });
    keys.forEach(function (k) { g[k] = 0; });
    return g;
  }

  function scopeInitialTotalForKeys(keys) {
    return totalRemaining(createInitialCountsForKeys(keys), keys);
  }

  function totalRemaining(counts, keys) {
    keys = keys || ALL_KEYS;
    return keys.reduce(function (sum, k) { return sum + (counts[k] || 0); }, 0);
  }

  function createDeck() {
    var deck = [];
    for (var d = 0; d < 2; d++) {
      RANKS.forEach(function (r) {
        for (var i = 0; i < 4; i++) deck.push(r);
      });
      deck.push(SMALL_JOKER, BIG_JOKER);
    }
    return deck;
  }

  function filterDeckByKeys(deck, keys) {
    return deck.filter(function (c) { return keys.indexOf(c) !== -1; });
  }

  function createDeckForKeys(keys) {
    return filterDeckByKeys(createDeck(), keys);
  }

  function shuffle(deck, rng) {
    rng = rng || Math.random;
    var a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function countPlayed(playedCards) {
    var played = {};
    ALL_KEYS.forEach(function (k) { played[k] = 0; });
    playedCards.forEach(function (c) {
      if (ALL_KEYS.indexOf(c) === -1) throw new Error('未知牌: ' + c);
      played[c] += 1;
    });
    return played;
  }

  function trueRemaining(playedCards) {
    var init = createInitialCounts();
    var played = countPlayed(playedCards);
    var rem = {};
    ALL_KEYS.forEach(function (k) { rem[k] = init[k] - played[k]; });
    return rem;
  }

  function checkAnswer(userCounts, playedCards, keys) {
    var truth = trueRemaining(playedCards);
    keys = keys || ALL_KEYS;
    var wrong = [];
    keys.forEach(function (k) {
      if (userCounts[k] !== truth[k]) {
        wrong.push({ key: k, user: userCounts[k], truth: truth[k] });
      }
    });
    return wrong;
  }

  function applyStreakAfterCheck(unlockedRows, streak, allCorrect) {
    unlockedRows = clampRows(unlockedRows);
    streak = streak | 0;
    if (!allCorrect) {
      return { unlockedRows: unlockedRows, streak: 0, justUnlocked: false };
    }
    var next = streak + 1;
    if (next >= UNLOCK_STREAK_NEED && unlockedRows < MAX_UNLOCKED_ROWS) {
      return { unlockedRows: unlockedRows + 1, streak: 0, justUnlocked: true };
    }
    return { unlockedRows: unlockedRows, streak: next, justUnlocked: false };
  }

  function rowLabel(unlockedRows) {
    unlockedRows = clampRows(unlockedRows);
    if (unlockedRows === 1) return '档 · 级牌&王 · 灰行升档预告';
    if (unlockedRows === 2) return '档 · 级牌&王 + A/K/Q · 灰行升档预告';
    return '档 · 级牌&王 + A/K/Q + J/10/9';
  }

  var SCOPES = {
    LEVEL_AND_JOKERS: 'level',
    NINE: 'nine',
    ALL: 'all'
  };
  var DEFAULT_SCOPE = SCOPES.LEVEL_AND_JOKERS;

  function getScopeKeys(scope, levelRank) {
    scope = scope || DEFAULT_SCOPE;
    levelRank = levelRank || DEFAULT_LEVEL_RANK;
    if (scope === SCOPES.NINE) return RANKS.slice(0, 9);
    if (scope === SCOPES.ALL) return ALL_KEYS.slice();
    if (scope === SCOPES.LEVEL_AND_JOKERS) return getRowKeys(1, levelRank);
    throw new Error('未知范围: ' + scope);
  }

  function createInitialCountsForScope(scope, levelRank) {
    return createInitialCountsForKeys(getScopeKeys(scope, levelRank));
  }

  function scopeInitialTotal(scope, levelRank) {
    return scopeInitialTotalForKeys(getScopeKeys(scope, levelRank));
  }

  function filterDeckByScope(deck, scope, levelRank) {
    return filterDeckByKeys(deck, getScopeKeys(scope, levelRank));
  }

  function createDeckForScope(scope, levelRank) {
    return createDeckForKeys(getScopeKeys(scope, levelRank));
  }

  function decrement(counts, key) {
    if (ALL_KEYS.indexOf(key) === -1) throw new Error('未知点数: ' + key);
    if (counts[key] <= 0) return false;
    counts[key] -= 1;
    return true;
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
    DEFAULT_LEVEL_RANK: DEFAULT_LEVEL_RANK,
    UNLOCK_STREAK_NEED: UNLOCK_STREAK_NEED,
    MAX_UNLOCKED_ROWS: MAX_UNLOCKED_ROWS,
    SCOPES: SCOPES,
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    getRowKeys: getRowKeys,
    getUnlockedKeys: getUnlockedKeys,
    clampRows: clampRows,
    maxCopies: maxCopies,
    cycleGuess: cycleGuess,
    createInitialCounts: createInitialCounts,
    createInitialCountsForKeys: createInitialCountsForKeys,
    createZeroGuesses: createZeroGuesses,
    scopeInitialTotal: scopeInitialTotal,
    scopeInitialTotalForKeys: scopeInitialTotalForKeys,
    totalRemaining: totalRemaining,
    decrement: decrement,
    createDeck: createDeck,
    filterDeckByKeys: filterDeckByKeys,
    createDeckForKeys: createDeckForKeys,
    filterDeckByScope: filterDeckByScope,
    createDeckForScope: createDeckForScope,
    getScopeKeys: getScopeKeys,
    createInitialCountsForScope: createInitialCountsForScope,
    shuffle: shuffle,
    countPlayed: countPlayed,
    trueRemaining: trueRemaining,
    checkAnswer: checkAnswer,
    applyStreakAfterCheck: applyStreakAfterCheck,
    rowLabel: rowLabel
  };
});
