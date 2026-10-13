const { chromium } = require('playwright');
const S = '/workspace/guandan-v6-shots/';
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('PASS', m); };
const sleep = (p, ms) => p.waitForTimeout(ms);

async function fillAsked(page, truth, wrongSlot) {
  // truth: {level,big,small} or rank-keyed for closed
  for (const [slot, val] of Object.entries(truth)) {
    const pick = (slot === wrongSlot) ? ((val + 1) % (slot === 'level' || !['big','small'].includes(slot) ? 9 : 3)) : val;
    await page.click(`[data-testid=grid-cell-${slot}]`);
    await page.click(`[data-testid=grid-num-${pick}]`);
  }
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8765/');

  // Home: 3 entries side by side
  const boxes = await Promise.all(['entry-scan','entry-closed','entry-sim'].map(id => p.locator(`[data-testid=${id}]`).boundingBox()));
  ok(boxes.every(Boolean), '3 entries present');
  ok(Math.abs(boxes[0].y - boxes[1].y) < 4 && Math.abs(boxes[1].y - boxes[2].y) < 4, 'entries side by side');
  await p.screenshot({ path: S + '01-home.png', fullPage: true });

  // === 开局扫牌 with unified grid ===
  await p.click('[data-testid=entry-scan]');
  await sleep(p, 400);
  ok(await p.locator('[data-testid=scan-card]').count() === 27, 'scan 27 cards');
  await p.screenshot({ path: S + '02-scan-flash.png', fullPage: true });
  await sleep(p, 8000);
  ok(await p.locator('[data-testid=scan-card]').count() === 0, 'scan auto-cover');
  // locked cells dashed + ▢
  const lockStyle = await p.locator('[data-testid=grid-cell-A]').evaluate(e => ({
    border: getComputedStyle(e).borderStyle, locked: e.getAttribute('data-locked'), text: e.textContent
  }));
  ok(lockStyle.border.includes('dashed') && lockStyle.locked === '1' && lockStyle.text.includes('▢'), 'scan locked dashed ▢: ' + JSON.stringify(lockStyle));
  const o = await p.evaluate(() => window.__scanDebug.getOutside());
  await p.click('[data-testid=grid-cell-level]');
  await p.screenshot({ path: S + '03-scan-answer-grid.png', fullPage: true });
  await fillAsked(p, o, 'small');
  await p.click('[data-testid=btn-check]');
  await sleep(p, 300);
  // wrong cell shows → correct
  const wrongTxt = await p.locator('[data-testid=grid-cell-small]').textContent();
  ok(wrongTxt.includes('→'), 'scan wrong shows → correct: ' + wrongTxt.trim());
  await p.screenshot({ path: S + '04-scan-feedback-grid.png', fullPage: true });
  // retry wrong
  ok(await p.locator('[data-testid=btn-retry-wrong]').count() === 1, 'scan retry-wrong');
  await p.click('[data-testid=btn-retry-wrong]');
  await sleep(p, 400);
  await sleep(p, 8000);
  const o2 = await p.evaluate(() => window.__scanDebug.getOutside());
  // only small asked
  ok(await p.locator('[data-testid=grid-cell-level]').getAttribute('data-locked') === '1', 'retry locks level');
  await p.click('[data-testid=grid-cell-small]');
  await p.click(`[data-testid=grid-num-${o2.small}]`);
  await p.click('[data-testid=btn-check]');
  await sleep(p, 200);
  await p.click('[data-testid=btn-next]');
  await sleep(p, 300);
  await p.click('[data-testid=btn-back]');
  await sleep(p, 200);

  // level 5 ♥5
  await p.selectOption('#level-select', '5');
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    await p.click('[data-testid=entry-scan]');
    await sleep(p, 300);
    const w = p.locator('[data-testid=scan-card][data-wild="1"]');
    if (await w.count()) {
      const t = await w.first().textContent();
      ok(t.includes('♥') && t.includes('5'), '♥5 wild: ' + t.trim());
      await p.screenshot({ path: S + '05-scan-level5-wild.png', fullPage: true });
      found = true;
    }
    await p.click('[data-testid=btn-back]');
    await sleep(p, 150);
  }
  ok(found, 'found ♥5');
  await p.selectOption('#level-select', '2');

  // === 出牌闭卷 with unified grid + unlock ===
  await p.click('[data-testid=entry-closed]');
  await sleep(p, 300);
  for (let r = 0; r < 3; r++) {
    await p.click('#btn-primary');
    for (let i = 0; i < 6; i++) await p.click('#btn-primary');
    await p.click('#btn-secondary');
    await sleep(p, 150);
    const t = await p.evaluate(() => window.__closedDebug.truth());
    // map rank keys to slots
    const level = await p.evaluate(() => window.__closedDebug.state.levelRank);
    const slotMap = {};
    for (const [k, v] of Object.entries(t)) {
      if (k === '大王') slotMap.big = v;
      else if (k === '小王') slotMap.small = v;
      else if (k === level) slotMap.level = v;
      else slotMap[k] = v;
    }
    if (r === 0) {
      await p.click('[data-testid=grid-cell-level]');
      await p.screenshot({ path: S + '06-closed-answer-grid.png', fullPage: true });
    }
    for (const [slot, val] of Object.entries(slotMap)) {
      await p.click(`[data-testid=grid-cell-${slot}]`);
      await p.click(`[data-testid=grid-num-${val}]`);
    }
    await p.click('#btn-primary');
    await sleep(p, 200);
  }
  const st = await p.evaluate(() => ({ u: window.__closedDebug.state.unlockedRows, s: window.__closedDebug.state.streak }));
  ok(st.u === 2, 'closed unlocked row 2: ' + JSON.stringify(st));
  await p.screenshot({ path: S + '07-closed-unlocked.png', fullPage: true });
  await p.click('[data-testid=btn-back]');
  await sleep(p, 200);

  // === 实战模拟 ===
  await p.click('[data-testid=entry-sim]');
  await sleep(p, 200);
  // set fast flip during flash
  await p.evaluate(() => window.__simDebug.setFastFlip(40));
  ok(await p.locator('[data-testid=sim-card]').count() === 27, 'sim 27 flash');
  await p.screenshot({ path: S + '08-sim-flash.png', fullPage: true });
  // wait flash cover then flip until stop
  await p.waitForSelector('[data-testid=sim-stage]', { timeout: 12000 });
  await p.screenshot({ path: S + '09-sim-flipping.png', fullPage: true });
  await p.waitForSelector('[data-testid=sim-stop]', { timeout: 60000 });
  const n = await p.evaluate(() => window.__simDebug.round().n);
  console.log('sim N=', n);
  await p.screenshot({ path: S + '10-sim-stop.png', fullPage: true }); // 停牌那一刻
  const fo = await p.evaluate(() => window.__simDebug.round().finalOutside);
  await p.click('[data-testid=grid-cell-level]');
  await p.screenshot({ path: S + '11-sim-answer-grid.png', fullPage: true });
  await fillAsked(p, fo, 'level'); // deliberate wrong on level
  await p.click('[data-testid=btn-check]');
  await sleep(p, 400);
  const bd = await p.locator('[data-testid=sim-breakdown]').textContent();
  ok(bd.includes('开局外剩') && bd.includes('翻牌减') && bd.includes('最终'), 'three-part feedback: ' + bd.slice(0, 80));
  const lvlWrong = await p.locator('[data-testid=grid-cell-level]').textContent();
  ok(lvlWrong.includes('→'), 'sim wrong shows → : ' + lvlWrong.trim());
  await p.screenshot({ path: S + '12-sim-feedback.png', fullPage: true }); // 三段反馈页
  ok(await p.locator('[data-testid=btn-review]').count() === 1, 'review button');
  await p.click('[data-testid=btn-review]');
  await sleep(p, 200);
  await p.screenshot({ path: S + '13-sim-review.png', fullPage: true });

  await b.close();
  console.log('ALL DONE');
})().catch(e => { console.error(e); process.exit(1); });
