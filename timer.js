/* 掼蛋九宫格记牌练习 - 整场会话计时器（浏览器与 Node 共用）
 * v7：开第一盘起计时 / 暂停不计时 / 时间到打完这盘再小结
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.GuandanTimer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_DURATION_MS = 15 * 60 * 1000;
  var DEFAULT_LEVELS = [
    { id: 'scan', name: '开局扫牌', suggestMin: 3 },
    { id: 'closed', name: '出牌闭卷', suggestMin: 5 },
    { id: 'sim', name: '实战模拟', suggestMin: 7 }
  ];
  var LABEL_TIMEUP = '时间到 · 打完这盘';

  function copyLevels(list) {
    return list.map(function (lv) {
      return { id: lv.id, name: lv.name, suggestMin: lv.suggestMin };
    });
  }

  function emptyCounts(levels) {
    var c = {};
    levels.forEach(function (lv) {
      c[lv.id] = { played: 0, correct: 0 };
    });
    return c;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatMs(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return pad2(m) + ':' + pad2(s);
  }

  function create(opts) {
    opts = opts || {};
    var durationMs = opts.durationMs != null ? opts.durationMs : DEFAULT_DURATION_MS;
    var nowFn = opts.now || Date.now;
    var levels = copyLevels(opts.levels && opts.levels.length ? opts.levels : DEFAULT_LEVELS);

    var status = 'idle';
    var startedAt = null;
    var pausedAt = null;
    var pausedTotal = 0;
    var pauseReason = null;
    var inProgress = false;
    var roundLevel = null;
    var timeupEmitted = false;
    var summaryEmitted = false;
    var counts = emptyCounts(levels);
    var listeners = {};

    function now() {
      return nowFn();
    }

    function on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    }

    function emit(event) {
      var args = Array.prototype.slice.call(arguments, 1);
      var list = listeners[event];
      if (!list) return;
      list.slice().forEach(function (fn) {
        fn.apply(null, args);
      });
    }

    function elapsedUnclamped() {
      if (startedAt == null) return 0;
      var n = now();
      var extra = pausedAt != null ? n - pausedAt : 0;
      var e = n - startedAt - pausedTotal - extra;
      return e < 0 ? 0 : e;
    }

    function elapsedClamped() {
      var e = elapsedUnclamped();
      if (e > durationMs) return durationMs;
      return e;
    }

    function settleTimeUp() {
      if (status === 'idle' || status === 'paused' || status === 'summary') return;
      if (elapsedUnclamped() < durationMs) return;

      if (!timeupEmitted) {
        timeupEmitted = true;
        emit('timeup');
      }
      if (inProgress) {
        status = 'timeup';
      } else if (!summaryEmitted) {
        status = 'summary';
        summaryEmitted = true;
        emit('summary');
      }
    }

    function snapshot() {
      settleTimeUp();
      var e = elapsedClamped();
      var rem = durationMs - e;
      var label = (status === 'timeup' && inProgress) ? LABEL_TIMEUP : formatMs(rem);
      var progress = durationMs <= 0 ? 1 : e / durationMs;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      return {
        status: status,
        elapsedMs: e,
        remainingMs: rem,
        progress: progress,
        label: label,
        roundInProgress: !!inProgress
      };
    }

    function roundStarted(levelId) {
      settleTimeUp();
      if (status === 'timeup' || status === 'summary') return;
      if (status === 'idle') {
        status = 'running';
        startedAt = now();
        pausedTotal = 0;
        pausedAt = null;
      }
      inProgress = true;
      roundLevel = levelId;
      emit('change');
    }

    function roundFinished(levelId, allCorrect) {
      if (inProgress) {
        var id = levelId != null ? levelId : roundLevel;
        if (id != null && !counts[id]) {
          counts[id] = { played: 0, correct: 0 };
        }
        if (id != null && counts[id]) {
          counts[id].played += 1;
          if (allCorrect) counts[id].correct += 1;
        }
      }
      inProgress = false;
      roundLevel = null;
      settleTimeUp();
      emit('change');
    }

    function pause(reason) {
      settleTimeUp();
      if (status !== 'running') return;
      status = 'paused';
      pausedAt = now();
      pauseReason = reason || 'manual';
      emit('pause', pauseReason);
      emit('change');
    }

    function resume() {
      if (status !== 'paused') return;
      var n = now();
      if (pausedAt != null) pausedTotal += n - pausedAt;
      pausedAt = null;
      var reason = pauseReason;
      pauseReason = null;
      status = 'running';
      emit('resume', reason);
      settleTimeUp();
      emit('change');
    }

    function togglePause() {
      settleTimeUp();
      if (status === 'paused') resume();
      else if (status === 'running') pause('manual');
    }

    function isPaused() {
      return status === 'paused';
    }

    function tick() {
      var s = snapshot();
      if (status !== 'idle') emit('change');
      return s;
    }

    function getState() {
      return snapshot();
    }

    function getSummary() {
      var total = 0;
      var totalCorrect = 0;
      var rows = levels.map(function (lv) {
        var c = counts[lv.id] || { played: 0, correct: 0 };
        total += c.played;
        totalCorrect += c.correct;
        return {
          id: lv.id,
          name: lv.name,
          suggestMin: lv.suggestMin,
          played: c.played,
          correct: c.correct,
          text: c.played === 0 ? '—' : (c.played + ' 盘 · 对 ' + c.correct)
        };
      });
      return { total: total, totalCorrect: totalCorrect, rows: rows };
    }

    function reset() {
      status = 'idle';
      startedAt = null;
      pausedAt = null;
      pausedTotal = 0;
      pauseReason = null;
      inProgress = false;
      roundLevel = null;
      timeupEmitted = false;
      summaryEmitted = false;
      counts = emptyCounts(levels);
      emit('change');
    }

    function attachVisibility(doc) {
      function onVis() {
        if (doc.hidden) pause('hidden');
      }
      doc.addEventListener('visibilitychange', onVis);
      return function detach() {
        doc.removeEventListener('visibilitychange', onVis);
      };
    }

    return {
      roundStarted: roundStarted,
      roundFinished: roundFinished,
      pause: pause,
      resume: resume,
      togglePause: togglePause,
      isPaused: isPaused,
      tick: tick,
      getState: getState,
      getSummary: getSummary,
      reset: reset,
      on: on,
      attachVisibility: attachVisibility
    };
  }

  return {
    create: create,
    DEFAULT_LEVELS: DEFAULT_LEVELS
  };
});
