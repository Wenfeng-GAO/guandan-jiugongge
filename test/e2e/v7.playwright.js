/* v7 smoke: console errors + 计时器/暂停/时间到/小结/翻牌暂停恢复 */
/* v7.1: 时间到核对后不自动跳小结（反馈保留 + 「看小结」按钮）；暂停返回首页保持暂停 */
const { chromium } = require('/workspace/pw/node_modules/playwright');

const S = '/workspace/guandan-jiugongge/artifacts/v7/';
const toSec = t => { const m = t.match(/(\d+):(\d+)/); return m ? +m[1]*60 + +m[2] : -1; };
const BASE = 'file:///workspace/guandan-jiugongge/index.html';
let failures = 0;

function ok(cond, name) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}

(async () => {
  const browser = await chromium.launch();

  // ============ Flow A: scan + 暂停盖屏 + 闪牌重闪 + 时间到 + 小结 ============
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(BASE + '?t=6');
    await page.waitForTimeout(300);

    // 三关顶栏都有小组件（首页不可见）
    ok(await page.locator('[data-testid="timer"]').count() === 3, 'A1 三个顶栏各有一份计时组件');
    ok((await page.locator('#view-scan [data-testid="timer-label"]').innerText()) === '00:06', 'A2 idle 显示 15:00 规则（t=6 → 00:06）');

    // 进开局扫牌
    await page.click('[data-testid="entry-scan"]');
    await page.waitForSelector('[data-testid="scan-countdown"]');
    ok(await page.locator('#view-scan').isVisible(), 'A3 进入扫牌关');
    const lineW0 = await page.locator('#view-scan [data-testid="timer-line"] i').evaluate(el => el.style.width);
    ok(lineW0 === '' || parseFloat(lineW0) < 10, 'A4 进度线从接近 0% 开始: ' + lineW0);
    await page.screenshot({ path: S + '01-topbar-timer.png' });

    // 暂停：盖住 + 文案 + 按钮变 ▶
    await page.click('#view-scan [data-testid="timer-btn"]');
    await page.waitForTimeout(150);
    ok(await page.locator('[data-testid="pause-cover"]').isVisible(), 'A5 暂停盖屏出现');
    ok((await page.locator('[data-testid="pause-cover"]').innerText()).includes('已暂停'), 'A6 盖屏文案 已暂停');
    ok((await page.locator('#view-scan [data-testid="timer-btn"]').innerText()) === '▶', 'A7 暂停钮变 ▶');
    ok((await page.locator('#view-scan [data-testid="timer-label"]').innerText()).startsWith('已暂停'), 'A8 标签 已暂停 mm:ss');
    ok(await page.locator('#view-scan [data-testid="timer"]').evaluate(el => el.classList.contains('pause')), 'A9 组件 pause class');
    const pc = await page.locator('#view-scan [data-testid="timer-label"]').evaluate(el => getComputedStyle(el).color);
    ok(pc === 'rgb(139, 147, 161)', 'A9b 暂停数字灰色 ' + pc);
    ok(await page.evaluate(() => [...document.querySelectorAll('[data-testid="scan-card"]')].every(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return !el.contains(top); })), 'A9c 手牌被盖住不可见');
    await page.screenshot({ path: S + '03-paused-covered.png' });

    // 恢复：盖屏消失、闪牌重新完整 8 秒
    await page.click('[data-testid="pause-resume"]');
    await page.waitForTimeout(150);
    ok(!(await page.locator('[data-testid="pause-cover"]').isVisible()), 'A10 恢复后盖屏消失');
    const cd1 = await page.locator('[data-testid="scan-countdown"]').innerText();
    const cdSec = parseInt(cd1.split(':')[0], 10) * 60 + parseInt(cd1.split(':')[1], 10);
    ok(cdSec >= 6, 'A11 恢复后重新完整闪 8 秒 (countdown=' + cd1 + ')');

    // 等作答阶段（期间 6 秒场计时已 → 时间到）
    await page.waitForSelector('[data-testid="btn-check"]', { timeout: 12000 });
    await page.waitForTimeout(400);
    ok(await page.locator('#view-scan [data-testid="timer"]').evaluate(el => el.classList.contains('dim')), 'A12 作答阶段组件 dim(35%)');
    const op = await page.locator('#view-scan [data-testid="timer"]').evaluate(el => getComputedStyle(el).opacity);
    ok(op === '0.35', 'A12b computed opacity 0.35: ' + op);
    await page.screenshot({ path: S + '04-timeup-round-continues.png' });
    ok((await page.locator('#view-scan [data-testid="timer-label"]').innerText()) === '时间到 · 打完这盘', 'A13 时间到文案，不打断');
    ok(await page.locator('#view-scan [data-testid="timer-btn"]').isDisabled(), 'A14 时间到后暂停钮不可用');

    // 答对 → 反馈保留 → 小结不自动弹出，底部「看小结」点了才进（走真实点击：点格 → 数字键）
    const outside = await page.evaluate(() => window.__scanDebug.getOutside());
    for (const slot of ['level', 'big', 'small']) {
      await page.click('#view-scan [data-testid="grid-cell-' + slot + '"]');
      await page.click('#view-scan .ans-picker .num-btn:text-is("' + outside[slot] + '")');
    }
    await page.click('[data-testid="btn-check"]');
    await page.waitForSelector('[data-testid="btn-view-summary"]', { timeout: 3000 });
    ok(await page.locator('#view-scan').isVisible(), 'A15 核对后反馈保留（扫牌关仍可见）');
    ok(!(await page.locator('#view-summary').isVisible()), 'A15b 小结未自动弹出');
    await page.screenshot({ path: S + '06-view-summary-btn.png' });
    await page.click('[data-testid="btn-view-summary"]');
    await page.waitForSelector('#view-summary:not(.hidden)', { timeout: 5000 });
    ok(await page.locator('#view-summary').isVisible(), 'A15c 点「看小结」后进入小结');
    ok((await page.locator('[data-testid="summary-total"]').innerText()) === '1 盘', 'A16 小结总盘数 1 盘');
    ok((await page.locator('[data-testid="summary-correct"]').innerText()) === '全对 1 盘', 'A17 小结全对 1 盘');
    ok((await page.locator('[data-testid="summary-row-scan"] .sum-row-val').innerText()) === '1 盘 · 对 1', 'A18 扫牌行 1 盘 · 对 1');
    ok((await page.locator('[data-testid="summary-row-closed"] .sum-row-val').innerText()) === '—', 'A19 未玩闭卷显示 —');
    ok((await page.locator('[data-testid="summary-row-sim"] .sum-row-val').innerText()) === '—', 'A20 未玩实战显示 —');
    ok((await page.locator('[data-testid="summary-again"]').innerText()) === '再来 6 分钟' ||
       (await page.locator('[data-testid="summary-again"]').innerText()).startsWith('再来 '), 'A21 再来按钮文案（实际分钟）');
    const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: S + '05-summary-one-screen.png' });
    ok(scrollH <= 844, 'A22 小结一屏无滚动 (scrollHeight=' + scrollH + ')');

    // 再来 → 回首页，计时器清零
    await page.click('[data-testid="summary-again"]');
    await page.waitForTimeout(200);
    ok(await page.locator('#view-home').isVisible(), 'A23 再来后回首页');
    ok((await page.locator('#view-scan [data-testid="timer-label"]').innerText()) === '00:06', 'A24 计时器已重置');
    ok(errors.length === 0, 'A25 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  // ============ Flow B: sim 翻牌途中暂停 → 恢复从当前张继续 ============
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(BASE + '?t=120');
    await page.click('[data-testid="entry-sim"]');
    // 等闪牌结束进入翻牌
    await page.waitForFunction(() => window.__simDebug.state.phase === 'flip', null, { timeout: 12000 });
    await page.waitForTimeout(100);
    const idxBefore = await page.evaluate(() => window.__simDebug.state.flipIndex);
    // 暂停 → 翻牌停住
    await page.click('#view-sim [data-testid="timer-btn"]');
    await page.waitForTimeout(300);
    const idxPaused = await page.evaluate(() => window.__simDebug.state.flipIndex);
    await page.waitForTimeout(1600); // 超过一张牌时长，确认没有偷偷翻
    const idxPaused2 = await page.evaluate(() => window.__simDebug.state.flipIndex);
    ok(idxBefore >= 1, 'B1 已进入翻牌 (flipIndex=' + idxBefore + ')');
    ok(idxPaused === idxBefore && idxPaused2 === idxBefore, 'B2 暂停期间停在当前张不动');
    ok(await page.locator('[data-testid="pause-cover"]').isVisible(), 'B3 暂停盖屏盖住');
    // 恢复 → 从当前张继续，不重开
    await page.click('[data-testid="pause-resume"]');
    await page.waitForTimeout(2200);
    const st = await page.evaluate(() => ({ phase: window.__simDebug.state.phase, idx: window.__simDebug.state.flipIndex }));
    ok(st.phase === 'flip' || st.phase === 'stop', 'B4 恢复后仍在翻牌/停牌（未重开闪牌）phase=' + st.phase);
    ok(st.idx > idxBefore, 'B5 恢复后从停下那张继续翻 (idx ' + idxBefore + '→' + st.idx + ')');

    // 停牌作答阶段 dim
    await page.waitForFunction(() => window.__simDebug.state.phase === 'stop', null, { timeout: 60000 });
    await page.waitForTimeout(300);
    ok(await page.locator('#view-sim [data-testid="timer"]').evaluate(el => el.classList.contains('dim')), 'B6 实战停牌作答 dim');

    // 扫牌关暂停恢复（模拟关闪牌重闪 8 秒）
    await page.click('#view-sim [data-testid="btn-back"]');
    await page.click('[data-testid="entry-scan"]');
    await page.waitForSelector('[data-testid="scan-countdown"]');
    await page.click('#view-scan [data-testid="timer-btn"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="pause-resume"]');
    await page.waitForTimeout(150);
    const cd2 = await page.locator('[data-testid="scan-countdown"]').innerText();
    const cd2Sec = parseInt(cd2.split(':')[0], 10) * 60 + parseInt(cd2.split(':')[1], 10);
    ok(cd2Sec >= 6, 'B7 扫牌暂停恢复重闪完整 8 秒 (countdown=' + cd2 + ')');

    // 闭卷关作答 dim
    await page.click('#view-scan [data-testid="btn-back"]');
    await page.click('[data-testid="entry-closed"]');
    await page.click('#btn-primary'); // 新开一盘
    await page.click('#btn-primary'); // 翻开下一张
    await page.click('#btn-secondary'); // 闭卷填剩余
    await page.waitForTimeout(200);
    ok(await page.locator('#view-closed [data-testid="timer"]').evaluate(el => el.classList.contains('dim') && getComputedStyle(el).opacity === '0.35'), 'B8 闭卷填剩余 dim 0.35');
    await page.screenshot({ path: S + '02-closed-answer-dim35.png' });
    // 切关不重置：剩余时间持续减少
    const t1 = toSec(await page.locator('#view-closed [data-testid="timer-label"]').innerText());
    ok(t1 > 0 && t1 < 120, 'B10 三关切换后计时未重置 (剩 ' + t1 + 's / 120s)');
    // 切后台自动暂停 + 盖住
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(200);
    ok(await page.locator('[data-testid="pause-cover"]').isVisible(), 'B11 切后台自动暂停并盖住');
    const h1 = await page.locator('#view-closed [data-testid="timer-label"]').innerText();
    await page.waitForTimeout(1500);
    ok(h1 === await page.locator('#view-closed [data-testid="timer-label"]').innerText(), 'B12 后台期间计时不走 ' + h1);

    ok(errors.length === 0, 'B9 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  // ============ Flow C: 暂停 → 返回首页保持暂停 → 再进关盖屏重现 → ▶ 继续 ============
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(BASE + '?t=120');
    await page.click('[data-testid="entry-scan"]');
    await page.waitForSelector('[data-testid="scan-countdown"]');
    await page.waitForTimeout(300);

    // 暂停 → 返回首页：不重置、保持暂停，首页不盖屏
    await page.click('#view-scan [data-testid="timer-btn"]');
    await page.waitForTimeout(150);
    ok(await page.locator('[data-testid="pause-cover"]').isVisible(), 'C0 暂停盖屏出现');
    await page.click('#view-scan [data-testid="btn-back"]');
    await page.waitForTimeout(400); // 等 tick 刷新盖屏可见性
    ok(await page.locator('#view-home').isVisible(), 'C1 暂停时可点返回，回到首页');
    ok(!(await page.locator('[data-testid="pause-cover"]').isVisible()), 'C2 首页不显示暂停盖屏');
    ok(await page.evaluate(() => window.GuandanSession.timer.getState().status === 'paused'), 'C3 回首页后计时器仍 paused');
    const rem1 = await page.evaluate(() => window.GuandanSession.timer.getState().remainingMs);
    await page.waitForTimeout(1200);
    const rem2 = await page.evaluate(() => window.GuandanSession.timer.getState().remainingMs);
    ok(Math.abs(rem1 - rem2) < 50, 'C4 首页停留期间剩余时间不走 (' + rem1 + '→' + rem2 + ')');

    // 再进任意关：盖屏重现，▶ 从同一时间继续
    await page.click('[data-testid="entry-closed"]');
    await page.waitForTimeout(400); // 等 tick 刷新盖屏可见性
    ok(await page.locator('[data-testid="pause-cover"]').isVisible(), 'C5 再进关卡盖屏重现');
    ok(await page.evaluate(() => window.GuandanSession.timer.getState().status === 'paused'), 'C6 再进关卡仍 paused');
    await page.click('[data-testid="pause-resume"]');
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => window.GuandanSession.timer.getState().status === 'running'), 'C7 ▶ 后恢复 running');
    const rem3 = await page.evaluate(() => window.GuandanSession.timer.getState().remainingMs);
    await page.waitForTimeout(1200);
    const rem4 = await page.evaluate(() => window.GuandanSession.timer.getState().remainingMs);
    ok(rem3 - rem4 > 800, 'C8 恢复后时间继续走 (' + rem3 + '→' + rem4 + ')');

    ok(errors.length === 0, 'C9 无 console 错误 ' + JSON.stringify(errors));
    await page.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nSMOKE ALL PASS' : '\nSMOKE FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('SMOKE CRASH', e); process.exit(1); });
