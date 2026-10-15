/* v7.2 回归（#6）：暂停 → 回首页 → 再进关卡，盖屏后面不得偷跑
 * 用 Playwright 假时钟（page.clock）推进时间，覆盖：
 *   P1 开局扫牌 / P2 实战模拟：手动暂停 → 返回 → 进关 → 暂停 >8s → ▶ 继续 → 完整闪 8 秒，暂停期间 0 张翻牌
 *   P3 回首页时切后台（visibilitychange 自动暂停）→ 进实战模拟 → 30s 不翻牌、整场计时不走
 *   P4 实战翻牌中切后台 → 返回 → 进开局扫牌：旧盘计时器全清，扫牌不跑，继续后完整 8 秒
 * 运行：node test/e2e/v7_2-pause-enter.playwright.js
 *   （PW=playwright 模块路径可覆盖；BASE=页面地址可覆盖，默认本地 index.html）
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const BASE = process.env.BASE || ('file://' + path.resolve(__dirname, '../../index.html'));
let failures = 0;
function ok(cond, name) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.clock.install();
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="entry-scan"]');
  return { page, errors };
}

const st = page => page.evaluate(() => ({
  scan: { phase: window.__scanDebug.state.phase, timerId: window.__scanDebug.state.timerId },
  sim: {
    phase: window.__simDebug.state.phase,
    flipIndex: window.__simDebug.state.flipIndex,
    timerId: window.__simDebug.state.timerId,
    flipTimeout: window.__simDebug.state.flipTimeout
  },
  timer: window.GuandanSession.timer.getState()
}));
const coverVisible = page => page.locator('[data-testid="pause-cover"]').isVisible();
const countdown = (page, lv) => page.locator('[data-testid="' + lv + '-countdown"]').innerText();
const hidden = (page, h) => page.evaluate(h => {
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, h);

// 进关后（已暂停）→ 暂停 waitMs → ▶ 继续 → 断言完整 8 秒闪牌；lv = 'scan' | 'sim'
async function assertPausedEntryThenFullFlash(page, lv, tag, waitMs) {
  await page.waitForSelector('[data-testid="' + lv + '-countdown"]');
  ok(await coverVisible(page), tag + 'a 进关即显示「已暂停」盖屏');
  const s0 = await st(page);
  ok(s0.timer.status === 'paused', tag + 'b 整场计时器仍 paused');
  ok(s0[lv].phase === 'flash' && s0[lv].timerId == null, tag + 'c 闪牌未起表 ' + JSON.stringify(s0[lv]));

  await page.clock.runFor(waitMs);
  const s1 = await st(page);
  ok(s1[lv].phase === 'flash', tag + 'd 暂停 ' + waitMs / 1000 + 's 后仍在闪牌（未自动盖牌） phase=' + s1[lv].phase);
  ok(s1.sim.flipIndex === 0, tag + 'e 暂停期间 0 张翻牌 flipIndex=' + s1.sim.flipIndex);
  ok(s1.timer.remainingMs === s0.timer.remainingMs, tag + 'f 暂停期间整场计时不走 ' + s0.timer.remainingMs + '→' + s1.timer.remainingMs);
  ok(await countdown(page, lv) === '0:08', tag + 'g 盖屏后倒计时停在 0:08');

  await page.click('[data-testid="pause-resume"]');
  ok(!(await coverVisible(page)), tag + 'h ▶ 继续后盖屏消失');
  ok(await countdown(page, lv) === '0:08', tag + 'i 继续后从完整 0:08 开始闪');
  await page.clock.runFor(7500);
  const s2 = await st(page);
  ok(s2[lv].phase === 'flash' && await page.locator('[data-testid="' + (lv === 'scan' ? 'scan-card' : 'sim-hand') + '"]').first().isVisible(),
    tag + 'j 继续后 7.5s 仍在亮手牌');
  await page.clock.runFor(700);
  const s3 = await st(page);
  if (lv === 'scan') {
    ok(s3.scan.phase === 'answer', tag + 'k 满 8 秒后才自动盖牌 phase=' + s3.scan.phase);
  } else {
    ok(s3.sim.phase === 'flip' && s3.sim.flipIndex === 1, tag + 'k 满 8 秒后才开始翻第 1 张 ' + JSON.stringify(s3.sim));
    // 1.5s 节拍：以 100ms 步进测出第 1→2 张的间隔
    let t = 0;
    while ((await st(page)).sim.flipIndex < 2 && t < 3000) { await page.clock.runFor(100); t += 100; }
    ok(t >= 1300 && t <= 1600, tag + 'l 第 1→2 张间隔≈1.5s（测得 ≤' + (t + 200) + 'ms，≥' + t + 'ms）');
  }
  ok(s3.timer.status === 'running' && s3.timer.remainingMs < s1.timer.remainingMs, tag + 'n 继续后整场计时恢复走');
}

async function pauseInScanAndGoHome(page) {
  await page.click('[data-testid="entry-scan"]');
  await page.waitForSelector('[data-testid="scan-countdown"]');
  await page.clock.runFor(1500);
  await page.click('#view-scan [data-testid="timer-btn"]');
  ok(await coverVisible(page), '  · 关内暂停盖屏出现');
  await page.click('#view-scan [data-testid="btn-back"]');
  await page.clock.runFor(300);
  ok(await page.locator('#view-home').isVisible() && !(await coverVisible(page)), '  · 回首页，首页不盖屏');
}

(async () => {
  const browser = await chromium.launch();

  // P1 开局扫牌
  {
    const { page, errors } = await newPage(browser);
    await pauseInScanAndGoHome(page);
    await page.click('[data-testid="entry-scan"]');
    await assertPausedEntryThenFullFlash(page, 'scan', 'P1', 12000);
    ok(errors.length === 0, 'P1z 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  // P2 实战模拟（QA probe5：暂停 30s 曾翻约 15 张）
  {
    const { page, errors } = await newPage(browser);
    await pauseInScanAndGoHome(page);
    await page.click('[data-testid="entry-sim"]');
    await assertPausedEntryThenFullFlash(page, 'sim', 'P2', 30000);
    ok(errors.length === 0, 'P2z 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  // P3 首页（计时在走）切后台 → 自动暂停 → 回前台进实战模拟
  {
    const { page, errors } = await newPage(browser);
    await page.click('[data-testid="entry-scan"]');
    await page.waitForSelector('[data-testid="scan-countdown"]');
    await page.clock.runFor(1000);
    await page.click('#view-scan [data-testid="btn-back"]');
    ok((await st(page)).timer.status === 'running', 'P3- 回首页不暂停（计时在走）');
    await hidden(page, true);
    await hidden(page, false);
    ok((await st(page)).timer.status === 'paused', 'P3- 首页切后台自动暂停');
    await page.click('[data-testid="entry-sim"]');
    await assertPausedEntryThenFullFlash(page, 'sim', 'P3', 30000);
    ok(errors.length === 0, 'P3z 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  // P4 实战翻牌中切后台 → 返回 → 进开局扫牌
  {
    const { page, errors } = await newPage(browser);
    await page.click('[data-testid="entry-sim"]');
    await page.waitForSelector('[data-testid="sim-countdown"]');
    await page.clock.runFor(8000 + 1500 * 2 + 100);
    const f0 = (await st(page)).sim;
    ok(f0.phase === 'flip' && f0.flipIndex >= 2, 'P4- 已进入自动翻牌 ' + JSON.stringify(f0));
    await hidden(page, true);
    await hidden(page, false);
    ok(await coverVisible(page), 'P4- 切后台自动暂停盖住翻牌');
    await page.clock.runFor(10000);
    ok((await st(page)).sim.flipIndex === f0.flipIndex, 'P4- 后台/暂停期间翻牌不动');
    await page.click('#view-sim [data-testid="btn-back"]');
    const h = (await st(page)).sim;
    ok(h.phase === 'off' && h.timerId == null && h.flipTimeout == null, 'P4- 回首页后实战计时器全清 ' + JSON.stringify(h));
    await page.click('[data-testid="entry-scan"]');
    await assertPausedEntryThenFullFlash(page, 'scan', 'P4', 12000);
    ok((await st(page)).sim.phase === 'off', 'P4o 实战旧盘未在后台复活');
    ok(errors.length === 0, 'P4z 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nV7.2 PAUSE-ENTER ALL PASS' : '\nV7.2 PAUSE-ENTER FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
