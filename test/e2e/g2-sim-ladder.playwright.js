/* G-2（#8）回归：实战模拟 升档 → 再连对 → 错一盘 → 再错一盘
 * 闪牌 8 秒与翻牌 1.5 秒用 Playwright 假时钟推进；作答、核对、下一盘是真实点击。
 * 1280 与 390 各截三张：满档顶栏、错一盘小字、退档反馈。
 * 顺带走出牌闭卷满档，确认顶栏不再出现 n>3 的「n/3」。
 *
 * 运行：node test/e2e/g2-sim-ladder.playwright.js
 *   PW=playwright 模块路径；BASE=页面地址；GD_OUT=截图目录
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const BASE = process.env.BASE || ('file://' + path.resolve(__dirname, '../../index.html'));
const OUT = process.env.GD_OUT || path.resolve(__dirname, '../../artifacts/g2');
fs.mkdirSync(OUT, { recursive: true });

const AMBER = 'rgb(212, 160, 23)';
const MUTE = 'rgb(139, 147, 161)';

let failures = 0;
function ok(cond, name) {
  if (cond) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name); }
}

function overflowFractions(text) {
  const found = [];
  const re = /(\d+)\/3/g;
  let m;
  while ((m = re.exec(text))) {
    if ((+m[1]) > 3) found.push(m[0]);
  }
  return found;
}

async function bodyText(page) {
  return page.locator('#view-sim').innerText();
}

async function answerSim(page, wrong) {
  await page.waitForSelector('[data-testid="sim-countdown"]', { timeout: 8000 });
  await page.clock.runFor(8200);
  for (let i = 0; i < 55; i++) {
    const phase = await page.evaluate(() => window.__simDebug.state.phase);
    if (phase === 'stop') break;
    await page.clock.runFor(1500);
  }
  const phase = await page.evaluate(() => window.__simDebug.state.phase);
  if (phase !== 'stop') throw new Error('未停牌 phase=' + phase);
  await page.waitForSelector('[data-testid="btn-check"]');
  const fo = await page.evaluate(() => window.__simDebug.round().finalOutside);
  const give = { level: fo.level, big: fo.big, small: fo.small };
  if (wrong) give.level = (give.level + 1) % 9;
  for (const slot of ['level', 'big', 'small']) {
    await page.click('[data-testid="grid-cell-' + slot + '"]');
    await page.click('[data-testid="grid-num-' + give[slot] + '"]');
  }
  await page.click('[data-testid="btn-check"]');
  await page.waitForSelector('[data-testid="sim-breakdown"]');
}

async function styles(page, sel) {
  return page.locator(sel).evaluate(function (el) {
    var s = getComputedStyle(el);
    return {
      color: s.color,
      backgroundColor: s.backgroundColor,
      fontSize: s.fontSize,
      fontWeight: String(s.fontWeight),
      text: el.innerText.replace(/\s+/g, ' ').trim()
    };
  });
}

async function runSim(page, width) {
  const tag = String(width);
  await page.clock.install();
  await page.goto(BASE);
  await page.click('[data-testid="entry-sim"]');

  // 三盘连对 → 升档。升档那一盘反馈保持原句，顶栏已是满档。
  await answerSim(page, false);
  await page.click('[data-testid="btn-next"]');
  await answerSim(page, false);
  await page.click('[data-testid="btn-next"]');
  await answerSim(page, false);
  let text = await bodyText(page);
  ok(text.indexOf('连对 3 盘 → N 从 10–30 放大到 20–50（已升档）') !== -1, tag + ' 升档那一盘反馈不变');
  ok((await styles(page, '#sim-streak-info')).text === '已满档 20–50', tag + ' 升档当盘顶栏已是满档');
  ok(overflowFractions(text).length === 0, tag + ' 升档当盘无 n>3：' + overflowFractions(text).join(','));

  // 再连对一盘：顶栏仍是满档，任何地方都没有连对计数
  await page.click('[data-testid="btn-next"]');
  await answerSim(page, false);
  text = await bodyText(page);
  const cap = await styles(page, '#sim-streak-info');
  ok(cap.text === '已满档 20–50', tag + ' 满档顶栏文案 ' + cap.text);
  ok(cap.color === AMBER && cap.fontSize === '11px' && (cap.fontWeight === '600' || cap.fontWeight === 'bold'),
    tag + ' 满档标签沿用 streak-info（琥珀 11px/600）' + JSON.stringify(cap));
  ok(await page.locator('#sim-streak-info .tier-cap-mark').count() === 1, tag + ' 满档带勾选圆');
  ok(text.indexOf('连对') === -1, tag + ' 满档后再连对，页面不再出现「连对」');
  ok(overflowFractions(text).length === 0, tag + ' 满档后再连对无 n>3');
  ok(await page.locator('[data-testid="grid-cell-level"]').count() === 1, tag + ' 九宫格仍在');
  ok(await page.locator('#view-sim .cell').count() === 9, tag + ' 九宫格仍是 9 格');
  const finalWeight = await page.locator('[data-testid="sim-breakdown"] .sim-bd-line').last()
    .evaluate(function (el) { return getComputedStyle(el).fontWeight; });
  ok(String(finalWeight) === '600' || String(finalWeight) === 'bold', tag + ' 「最终」仍是主行');
  await page.screenshot({ path: path.join(OUT, tag + '-full-tier.png'), fullPage: true });

  // 错一盘：不退档，小字在反馈最底
  await page.click('[data-testid="btn-next"]');
  await answerSim(page, true);
  text = await bodyText(page);
  const hold = await styles(page, '[data-testid="sim-hold-note"]');
  ok(hold.text === '再错一盘退回 10–30', tag + ' 错一盘小字 ' + hold.text);
  ok(hold.color === MUTE, tag + ' 小字用次级灰 ' + hold.color);
  ok(hold.backgroundColor === 'rgba(0, 0, 0, 0)' || hold.backgroundColor === 'transparent',
    tag + ' 小字无底色 ' + hold.backgroundColor);
  ok(hold.fontSize === '11px' && (hold.fontWeight === '500' || hold.fontWeight === 'normal'),
    tag + ' 小字字号字重沿用次要文字 ' + hold.fontSize + '/' + hold.fontWeight);
  ok(await page.locator('[data-testid="sim-hold-note"] .mark').count() === 1, tag + ' 小字前有 info 图标');
  ok((await styles(page, '#sim-streak-info')).text === '已满档 20–50', tag + ' 错一盘顶栏不变');
  ok(overflowFractions(text).length === 0, tag + ' 错一盘无 n>3');
  const holdIsLast = await page.evaluate(function () {
    var panel = document.querySelector('#view-sim .scan-panel');
    return panel.lastElementChild.getAttribute('data-testid') === 'sim-hold-note';
  });
  ok(holdIsLast, tag + ' 小字在反馈最底下');
  const nRange = await page.evaluate(function () { return window.__simDebug.state.streakState.nRange; });
  ok(nRange[0] === 20 && nRange[1] === 50, tag + ' 错一盘未退档 ' + JSON.stringify(nRange));
  await page.screenshot({ path: path.join(OUT, tag + '-one-miss.png'), fullPage: true });

  // 再错一盘：退档
  await page.click('[data-testid="btn-next"]');
  await answerSim(page, true);
  text = await bodyText(page);
  const demote = await styles(page, '[data-testid="sim-demote-note"]');
  ok(demote.text === '连错 2 盘 → N 退回 10–30', tag + ' 退档文案 ' + demote.text);
  ok(demote.color === AMBER, tag + ' 退档用琥珀 ' + demote.color);
  ok(await page.locator('[data-testid="sim-demote-note"] .mark').count() === 1, tag + ' 退档有向下箭头');
  const back = await styles(page, '#sim-streak-info');
  ok(back.text === '连对 0/3 · N 10–30', tag + ' 退档顶栏 ' + back.text);
  ok(await page.locator('#sim-streak-info.tier-cap').count() === 0, tag + ' 退档后不再用满档标签');
  ok(overflowFractions(text).length === 0, tag + ' 退档无 n>3');
  const backRange = await page.evaluate(function () { return window.__simDebug.state.streakState.nRange; });
  ok(backRange[0] === 10 && backRange[1] === 30, tag + ' N 已退回 10–30 ' + JSON.stringify(backRange));
  const demoted = await page.evaluate(function () { return window.__simDebug.state.streakState.justDemoted === true; });
  ok(demoted, tag + ' 本盘标记为退档');
  await page.screenshot({ path: path.join(OUT, tag + '-demote.png'), fullPage: true });
}

async function playClosed(page) {
  const phase = await page.evaluate(function () { return window.__closedDebug.state.phase; });
  if (phase === 'idle' || phase === 'done') await page.click('#btn-primary');
  for (let i = 0; i < 4; i++) await page.click('#btn-primary');
  await page.click('#btn-secondary');
  const mapped = await page.evaluate(function () {
    var t = window.__closedDebug.truth();
    var level = window.__closedDebug.state.levelRank;
    var slotMap = {};
    Object.keys(t).forEach(function (k) {
      if (k === '大王') slotMap.big = t[k];
      else if (k === '小王') slotMap.small = t[k];
      else if (k === level) slotMap.level = t[k];
      else slotMap[k] = t[k];
    });
    return slotMap;
  });
  for (const slot of Object.keys(mapped)) {
    await page.click('[data-testid="grid-cell-' + slot + '"]');
    await page.click('[data-testid="grid-num-' + mapped[slot] + '"]');
  }
  await page.click('#btn-primary');
}

async function runClosed(page) {
  await page.goto(BASE);
  await page.click('[data-testid="entry-closed"]');
  // 3 盘解锁第 2 行，再 3 盘解锁第 3 行，再连对 4 盘（旧逻辑会显示到 4/3）
  for (let i = 0; i < 10; i++) await playClosed(page);
  const bar = await styles(page, '#streak-info');
  ok(bar.text === '已满档', '闭卷满档顶栏 ' + bar.text);
  ok(bar.color === AMBER && bar.fontSize === '11px', '闭卷满档与实战同一套字色字号 ' + JSON.stringify(bar));
  ok(await page.locator('#streak-info .tier-cap-mark').count() === 1, '闭卷满档用同一枚勾选圆');
  const text = await page.locator('#view-closed').innerText();
  ok(overflowFractions(text).length === 0, '闭卷满档后无 n>3：' + overflowFractions(text).join(','));
  ok(await page.locator('#view-closed .cell').count() === 9, '闭卷九宫格仍是 9 格');
}

(async function () {
  const browser = await chromium.launch();
  const pages = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 }
  ];
  for (const vp of pages) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await runSim(page, vp.width);
      ok(errors.length === 0, vp.width + ' 无页面错误 ' + errors.join(' | '));
    } catch (e) {
      failures++;
      console.log('FAIL  ' + vp.width + ' 流程中断 ' + e.message);
      try { await page.screenshot({ path: path.join(OUT, vp.width + '-error.png'), fullPage: true }); } catch (err) { /* ignore */ }
    }
    await page.close();
  }

  const closed = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await runClosed(closed);
  } catch (e) {
    failures++;
    console.log('FAIL  闭卷流程中断 ' + e.message);
  }
  await browser.close();
  if (failures) {
    console.log('FAILED ' + failures);
    process.exit(1);
  }
  console.log('OK：G-2 实战升档 / 退档 / 闭卷满档');
})().catch(function (e) {
  console.error('FATAL', e);
  process.exit(2);
});
