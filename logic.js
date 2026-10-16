/* 掼蛋九宫格记牌练习 - 纯逻辑层（浏览器与 Node 共用）
 * v4：闭卷填剩余 + 三行渐进解锁（级/王 → A/K/Q → J/10/9）
 * v5：开局扫牌 — 花色牌堆 / 逢人配随级 / 外剩三格
 * v6：实战模拟 — 27 张手牌 + 其余牌翻 N 张 / 连对 3 盘放大 N
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
  var SUITS = ['♠', '♥', '♣', '♦'];
  var SMALL_JOKER = '小王';
  var BIG_JOKER = '大王';
  var JOKERS = [SMALL_JOKER, BIG_JOKER];
  var ALL_KEYS = RANKS.concat(JOKERS);
  var SCAN_KEYS = ['level', 'big', 'small'];
  var DEFAULT_HAND_SIZE = 27;

  var COPIES_PER_RANK = 8;
  var COPIES_PER_JOKER = 2;
  var TOTAL_CARDS = 108;

  var DEFAULT_LEVEL_RANK = '2';
  var UNLOCK_STREAK_NEED = 3;
  var MAX_UNLOCKED_ROWS = 3;

  var SIM_N_BASE = [10, 30];
  var SIM_N_UP = [20, 50];
  var SIM_FLIP_MS = 1500;

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

  function createSuitedDeck() {
    var deck = [];
    for (var d = 0; d < 2; d++) {
      RANKS.forEach(function (r) {
        SUITS.forEach(function (s) {
          deck.push({ rank: r, suit: s, id: d + '-' + s + '-' + r });
        });
      });
      deck.push({ rank: SMALL_JOKER, suit: null, id: d + '-' + SMALL_JOKER });
      deck.push({ rank: BIG_JOKER, suit: null, id: d + '-' + BIG_JOKER });
    }
    return deck;
  }

  function isWild(card, levelRank) {
    return card.suit === '♥' && card.rank === levelRank;
  }

  function isLevelCard(card, levelRank) {
    return card.rank === levelRank;
  }

  function dealHand(rng, n) {
    if (n == null) n = DEFAULT_HAND_SIZE;
    return shuffle(createSuitedDeck(), rng).slice(0, n);
  }

  function bucketCounts(cards, levelRank) {
    var nLevel = 0;
    var nBig = 0;
    var nSmall = 0;
    cards.forEach(function (c) {
      if (c.rank === levelRank) nLevel += 1;
      else if (c.rank === BIG_JOKER) nBig += 1;
      else if (c.rank === SMALL_JOKER) nSmall += 1;
    });
    return { level: nLevel, big: nBig, small: nSmall };
  }

  function outsideCounts(hand, levelRank) {
    var n = bucketCounts(hand, levelRank);
    return {
      level: COPIES_PER_RANK - n.level,
      big: COPIES_PER_JOKER - n.big,
      small: COPIES_PER_JOKER - n.small
    };
  }

  function shouldRedeal(outside) {
    return outside.level === COPIES_PER_RANK &&
      outside.big === COPIES_PER_JOKER &&
      outside.small === COPIES_PER_JOKER;
  }

  function dealScanHand(levelRank, rng) {
    var redeals = 0;
    var hand;
    var outside;
    do {
      if (hand) redeals += 1;
      hand = dealHand(rng);
      outside = outsideCounts(hand, levelRank);
    } while (shouldRedeal(outside));
    return {
      hand: sortHand(hand, levelRank),
      outside: outside,
      redeals: redeals
    };
  }

  function normalizeSimRange(nRange) {
    if (!nRange || nRange.length < 2) return [SIM_N_BASE[0], SIM_N_BASE[1]];
    var min = nRange[0] | 0;
    var max = nRange[1] | 0;
    if (max < min) return [max, min];
    return [min, max];
  }

  function randomIntInclusive(min, max, rng) {
    var span = max - min + 1;
    var r = rng();
    if (!(r >= 0)) r = 0;
    var n = min + Math.floor(r * span);
    if (n > max) n = max;
    if (n < min) n = min;
    return n;
  }

  // 档位下标：0 基础 [10,30]，≥1 已升档 [20,50]。
  // 对象则看 upgraded（升档后 streak 可归零，不能用连对数判断区间）。
  function simNRange(streakOrIndex) {
    var upgraded = false;
    if (typeof streakOrIndex === 'boolean') {
      upgraded = streakOrIndex;
    } else if (streakOrIndex && typeof streakOrIndex === 'object') {
      upgraded = !!streakOrIndex.upgraded;
    } else {
      upgraded = (streakOrIndex | 0) >= 1;
    }
    var src = upgraded ? SIM_N_UP : SIM_N_BASE;
    return [src[0], src[1]];
  }

  function capStreak(streak) {
    streak = streak | 0;
    if (streak < 0) return 0;
    if (streak > UNLOCK_STREAK_NEED) return UNLOCK_STREAK_NEED;
    return streak;
  }

  function simStreakState(streak, upgraded, justUpgraded, wrongStreak, justDemoted) {
    return {
      streak: capStreak(streak),
      upgraded: !!upgraded,
      nRange: simNRange(upgraded ? 1 : 0),
      justUpgraded: !!justUpgraded,
      wrongStreak: wrongStreak > 0 ? (wrongStreak | 0) : 0,
      justDemoted: !!justDemoted
    };
  }

  function readSimStreak(state) {
    if (typeof state === 'number') {
      return { streak: capStreak(state), upgraded: false, justUpgraded: false, wrongStreak: 0, justDemoted: false };
    }
    state = state || {};
    return {
      streak: capStreak(state.streak),
      upgraded: !!state.upgraded,
      justUpgraded: !!state.justUpgraded,
      wrongStreak: state.wrongStreak > 0 ? (state.wrongStreak | 0) : 0,
      justDemoted: !!state.justDemoted
    };
  }

  // state: {streak, upgraded, wrongStreak}。也接受纯数字 streak（尚未升档）。
  // 未升档：连对满 3 升到 20–50，答错只清连对。
  // 已升档：顶栏不再计连对，连对不再往上加；错一盘保持档位并记连错 1；
  // 连着错两盘退回 10–30。中间答对则连错清零。
  function applySimStreak(state, allCorrect) {
    var cur = readSimStreak(state);
    if (!allCorrect) {
      if (cur.upgraded) {
        var misses = cur.wrongStreak + 1;
        if (misses >= 2) return simStreakState(0, false, false, 0, true);
        return simStreakState(0, true, false, misses, false);
      }
      return simStreakState(0, false, false, 0, false);
    }
    if (cur.upgraded) {
      // 满档后答对只清连错，连对停在当前值（至多 3），不再出现 4/3
      return simStreakState(cur.streak, true, false, 0, false);
    }
    var next = cur.streak + 1;
    if (next >= UNLOCK_STREAK_NEED) return simStreakState(UNLOCK_STREAK_NEED, true, true, 0, false);
    return simStreakState(next, false, false, 0, false);
  }

  // 顶栏文案。满档与出牌闭卷共用「已满档」写法，不再带连对 n/3。
  function simTopbar(state) {
    var cur = readSimStreak(state);
    if (cur.upgraded) return { full: true, text: '已满档 20–50' };
    return { full: false, text: '连对 ' + cur.streak + '/' + UNLOCK_STREAK_NEED + ' · N 10–30' };
  }

  // 反馈底部文案。升档那一盘保持原句；满档后的答对不再写连对计数。
  function simFeedbackNotes(state) {
    var cur = readSimStreak(state);
    if (cur.justDemoted) {
      return [{ role: 'demote', text: '连错 2 盘 → N 退回 10–30' }];
    }
    if (cur.justUpgraded) {
      return [{ role: 'upgrade', text: '连对 3 盘 → N 从 10–30 放大到 20–50（已升档）' }];
    }
    if (cur.upgraded) {
      if (cur.wrongStreak >= 1) return [{ role: 'hold', text: '再错一盘退回 10–30' }];
      return [];
    }
    return [{
      role: 'progress',
      text: '连对 ' + cur.streak + '/' + UNLOCK_STREAK_NEED + ' → 升档后 N 从 10–30 放大到 20–50'
    }];
  }

  function closedTopbar(unlockedRows, streak) {
    unlockedRows = clampRows(unlockedRows);
    if (unlockedRows >= MAX_UNLOCKED_ROWS) return { full: true, text: '已满档' };
    return {
      full: false,
      text: '连对 ' + capStreak(streak) + '/' + UNLOCK_STREAK_NEED + ' · 第' + unlockedRows + '行'
    };
  }

  function dealSimRound(levelRank, rng, nRange) {
    levelRank = levelRank || DEFAULT_LEVEL_RANK;
    rng = rng || Math.random;
    var range = normalizeSimRange(nRange);
    var deck;
    var hand;
    var outside;
    do {
      deck = shuffle(createSuitedDeck(), rng);
      hand = deck.slice(0, DEFAULT_HAND_SIZE);
      outside = outsideCounts(hand, levelRank);
    } while (shouldRedeal(outside));
    var remaining = deck.slice(DEFAULT_HAND_SIZE);
    var n = randomIntInclusive(range[0], range[1], rng);
    if (n > remaining.length) n = remaining.length;
    var flips = remaining.slice(0, n);
    var flipDelta = bucketCounts(flips, levelRank);
    return {
      hand: sortHand(hand, levelRank),
      handOutside: outside,
      flips: flips,
      n: n,
      finalOutside: {
        level: outside.level - flipDelta.level,
        big: outside.big - flipDelta.big,
        small: outside.small - flipDelta.small
      },
      flipDelta: flipDelta
    };
  }

  function sortStrength(rank, levelRank) {
    if (rank === BIG_JOKER) return 0;
    if (rank === SMALL_JOKER) return 1;
    if (rank === levelRank) return 2;
    var desc = RANKS.slice().reverse();
    var idx = desc.indexOf(rank);
    return idx === -1 ? 100 : 3 + idx;
  }

  function suitTieIndex(suit) {
    var i = SUITS.indexOf(suit);
    return i === -1 ? SUITS.length : i;
  }

  function sortHand(hand, levelRank) {
    return hand.slice().sort(function (a, b) {
      var sa = sortStrength(a.rank, levelRank);
      var sb = sortStrength(b.rank, levelRank);
      if (sa !== sb) return sa - sb;
      if (a.rank === levelRank) {
        var aw = isWild(a, levelRank) ? 0 : 1;
        var bw = isWild(b, levelRank) ? 0 : 1;
        if (aw !== bw) return aw - bw;
      }
      return suitTieIndex(a.suit) - suitTieIndex(b.suit);
    });
  }

  function numberOptions(key) {
    var max = maxCopies(key);
    var opts = [];
    for (var i = 0; i <= max; i++) opts.push(i);
    return opts;
  }

  function checkScan(guesses, outside, keys) {
    keys = keys || SCAN_KEYS;
    return keys.map(function (key) {
      var user = guesses[key];
      var truth = outside[key];
      return { key: key, user: user, truth: truth, ok: user === truth };
    });
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
    // 已满三行：连对停在 3，不再累加成 4/3、5/3
    if (unlockedRows >= MAX_UNLOCKED_ROWS) {
      var held = capStreak(streak + 1);
      return { unlockedRows: unlockedRows, streak: held, justUnlocked: false };
    }
    var next = streak + 1;
    if (next >= UNLOCK_STREAK_NEED) {
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
    SUITS: SUITS,
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
    SIM_N_BASE: SIM_N_BASE,
    SIM_N_UP: SIM_N_UP,
    SIM_FLIP_MS: SIM_FLIP_MS,
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
    rowLabel: rowLabel,
    createSuitedDeck: createSuitedDeck,
    isWild: isWild,
    isLevelCard: isLevelCard,
    dealHand: dealHand,
    outsideCounts: outsideCounts,
    shouldRedeal: shouldRedeal,
    dealScanHand: dealScanHand,
    dealSimRound: dealSimRound,
    simNRange: simNRange,
    applySimStreak: applySimStreak,
    simTopbar: simTopbar,
    simFeedbackNotes: simFeedbackNotes,
    closedTopbar: closedTopbar,
    sortHand: sortHand,
    numberOptions: numberOptions,
    checkScan: checkScan
  };
});
