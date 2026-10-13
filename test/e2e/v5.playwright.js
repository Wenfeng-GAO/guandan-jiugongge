const { chromium } = require('playwright');
const S = '/workspace/guandan-v5-shots/';
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('PASS', m); };
const sleep = (p, ms) => p.waitForTimeout(ms);

async function fillScan(page, truth, wrongSlot) {
  for (const slot of ['level', 'big', 'small']) {
    const val = truth[slot];
    const pick = (slot === wrongSlot) ? ((val + 1) % (slot === 'level' ? 9 : 3)) : val;
    await page.click(`[data-testid=grid-cell-${slot}]`);
    await page.click(`[data-testid=grid-num-${pick}]`);
  }
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8765/');

  const e1 = await p.locator('[data-testid=entry-scan]').boundingBox();
  const e2 = await p.locator('[data-testid=entry-closed]').boundingBox();
  ok(Math.abs(e1.y - e2.y) < 4 && e2.x > e1.x, 'entries side by side');
  await p.screenshot({ path: S + '01-home.png', fullPage: true });

  await p.click('[data-testid=entry-scan]');
  await sleep(p, 500);
  ok(await p.locator('[data-testid=scan-card]').count() === 27, '27 cards flashed');
  console.log('level cards', await p.locator('[data-testid=scan-card][data-level="1"]').count(),
    'countdown', await p.textContent('[data-testid=scan-countdown]'));
  await p.screenshot({ path: S + '02-scan-flash.png', fullPage: true });
  await sleep(p, 8000);
  ok(await p.locator('[data-testid=scan-card]').count() === 0, 'auto covered at 8s');

  const o = await p.evaluate(() => window.__scanDebug.getOutside());
  await p.click('[data-testid=grid-cell-level]');
  await fillScan(p, o, 'small');
  await p.screenshot({ path: S + '03-scan-answer.png', fullPage: true });
  await p.click('[data-testid=btn-check]');
  await sleep(p, 300);
  await p.screenshot({ path: S + '04-scan-feedback.png', fullPage: true });
  ok(await p.locator('[data-testid=btn-retry-wrong]').count() === 1, 'retry-wrong offered');

  await p.click('[data-testid=btn-retry-wrong]');
  await sleep(p, 500);
  ok(await p.locator('[data-testid=scan-card]').count() === 27, 'new hand flashed for retry');
  await p.screenshot({ path: S + '05-retry-flash.png', fullPage: true });
  await sleep(p, 8000);
  ok(await p.locator('[data-testid=grid-cell-level]').getAttribute('data-locked') === '1'
    && await p.locator('[data-testid=grid-cell-big]').getAttribute('data-locked') === '1'
    && await p.locator('[data-testid=grid-cell-small]').getAttribute('data-locked') !== '1',
    'only small cell asked');
  const o2 = await p.evaluate(() => window.__scanDebug.getOutside());
  await p.click('[data-testid=grid-cell-small]');
  await p.click(`[data-testid=grid-num-${o2.small}]`);
  await p.click('[data-testid=btn-check]');
  await sleep(p, 300);
  await p.screenshot({ path: S + '06-retry-correct.png', fullPage: true });
  await p.click('[data-testid=btn-next]');
  await sleep(p, 500);
  ok(await p.locator('[data-testid=scan-card]').count() === 27, 'all correct → next round flashes');

  await p.click('[data-testid=btn-back]');
  await sleep(p, 300);
  await p.selectOption('#level-select', '5');
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await p.click('[data-testid=entry-scan]');
    await sleep(p, 300);
    const w = p.locator('[data-testid=scan-card][data-wild="1"]');
    if (await w.count()) {
      const t = await w.first().textContent();
      ok(t.includes('♥') && t.includes('5'), 'wild shows ♥5: ' + t.trim());
      await p.screenshot({ path: S + '07-level5-wild.png', fullPage: true });
      found = true;
    }
    await p.click('[data-testid=btn-back]');
    await sleep(p, 200);
  }
  ok(found, 'found ♥5 hand');

  await p.selectOption('#level-select', '2');
  await p.click('[data-testid=entry-closed]');
  await sleep(p, 300);
  for (let r = 0; r < 3; r++) {
    await p.click('#btn-primary'); // 新开一盘
    for (let i = 0; i < 6; i++) await p.click('#btn-primary'); // 翻牌
    await p.click('#btn-secondary'); // 闭卷
    await sleep(p, 100);
    const t = await p.evaluate(() => window.__closedDebug.truth());
    const level = await p.evaluate(() => window.__closedDebug.state.levelRank);
    for (const [k, val] of Object.entries(t)) {
      const slot = (k === level) ? 'level' : (k === '大王' ? 'big' : (k === '小王' ? 'small' : k));
      await p.click(`[data-testid=grid-cell-${slot}]`);
      await p.click(`[data-testid=grid-num-${val}]`);
    }
    if (r === 0) await p.screenshot({ path: S + '08-closed-picker.png', fullPage: true });
    await p.click('#btn-primary'); // 核对
    await sleep(p, 200);
  }
  const st = await p.evaluate(() => ({ u: window.__closedDebug.state.unlockedRows, s: window.__closedDebug.state.streak }));
  ok(st.u === 2, 'row 2 unlocked after 3 correct: ' + JSON.stringify(st));
  await p.screenshot({ path: S + '09-closed-unlocked.png', fullPage: true });
  await b.close();
  console.log('V5 ALL PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
