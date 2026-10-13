const { chromium } = require('playwright');
const S='/workspace/guandan-v5-shots/';
const ok=(c,m)=>{ if(!c) throw new Error('FAIL '+m); console.log('PASS',m); };
(async()=>{
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://localhost:8765/');
const e1=await p.locator('[data-testid=entry-scan]').boundingBox(), e2=await p.locator('[data-testid=entry-closed]').boundingBox();
ok(Math.abs(e1.y-e2.y)<2 && e2.x>e1.x,'entries side by side');
await p.screenshot({path:S+'01-home.png',fullPage:true});
await p.click('[data-testid=entry-scan]');
await p.waitForTimeout(500);
ok(await p.locator('[data-testid=scan-card]').count()===27,'27 cards flashed');
const lvl=await p.locator('[data-testid=scan-card][data-level="1"]').count();
console.log('level cards',lvl,'countdown',await p.textContent('[data-testid=scan-countdown]'));
await p.screenshot({path:S+'02-scan-flash.png',fullPage:true});
await p.waitForTimeout(8000);
ok(await p.locator('[data-testid=scan-card]').count()===0,'auto covered at 8s');
const o=await p.evaluate(()=>window.__scanDebug.getOutside());
await p.click(`[data-testid=num-level-${o.level}]`);
await p.click(`[data-testid=num-big-${o.big}]`);
await p.click(`[data-testid=num-small-${(o.small+1)%3}]`);
await p.screenshot({path:S+'03-scan-answer.png',fullPage:true});
await p.click('[data-testid=btn-check]'); await p.waitForTimeout(300);
await p.screenshot({path:S+'04-scan-feedback.png',fullPage:true});
ok(await p.locator('[data-testid=btn-retry-wrong]').count()===1,'retry-wrong offered');
await p.click('[data-testid=btn-retry-wrong]'); await p.waitForTimeout(500);
ok(await p.locator('[data-testid=scan-card]').count()===27,'new hand flashed for retry');
await p.screenshot({path:S+'05-retry-flash.png',fullPage:true});
await p.waitForTimeout(8000);
ok(await p.locator('[data-testid=cell-level]').count()===0 && await p.locator('[data-testid=cell-small]').count()===1 && await p.locator('[data-testid=cell-big]').count()===0,'only small cell asked');
const o2=await p.evaluate(()=>window.__scanDebug.getOutside());
await p.click(`[data-testid=num-small-${o2.small}]`);
await p.click('[data-testid=btn-check]'); await p.waitForTimeout(300);
await p.screenshot({path:S+'06-retry-correct.png',fullPage:true});
await p.click('[data-testid=btn-next]'); await p.waitForTimeout(500);
ok(await p.locator('[data-testid=scan-card]').count()===27,'all correct → next round flashes');
await p.click('[data-testid=btn-back]'); await p.waitForTimeout(300);
await p.selectOption('#level-select','5');
let found=false;
for(let i=0;i<30&&!found;i++){ await p.click('[data-testid=entry-scan]'); await p.waitForTimeout(300);
  const w=p.locator('[data-testid=scan-card][data-wild="1"]');
  if(await w.count()){ const t=await w.first().textContent(); ok(t.includes('♥')&&t.includes('5'),'wild shows ♥5: '+t.trim());
    const bc=await w.first().evaluate(e=>getComputedStyle(e).borderColor); console.log('wild border',bc);
    await p.screenshot({path:S+'07-level5-wild.png',fullPage:true}); found=true; }
  await p.click('[data-testid=btn-back]'); await p.waitForTimeout(200); }
ok(found,'found ♥5 hand');
await p.selectOption('#level-select','2');
await p.click('[data-testid=entry-closed]'); await p.waitForTimeout(300);
for(let r=0;r<3;r++){
  await p.click('#btn-primary'); for(let i=0;i<6;i++) await p.click('#btn-primary');
  await p.click('#btn-secondary'); await p.waitForTimeout(100);
  const t=await p.evaluate(()=>window.__closedDebug.truth());
  for(const k of Object.keys(t)){ await p.click(`[data-testid="cell-closed-${k}"]`); await p.click(`[data-testid=pick-${t[k]}]`); }
  if(r===0) await p.screenshot({path:S+'08-closed-picker.png',fullPage:true});
  await p.click('#btn-primary'); await p.waitForTimeout(200);
}
const st=await p.evaluate(()=>({u:window.__closedDebug.state.unlockedRows,s:window.__closedDebug.state.streak}));
ok(st.u===2,'row 2 unlocked after 3 correct: '+JSON.stringify(st));
await p.screenshot({path:S+'09-closed-unlocked.png',fullPage:true});
await b.close();})().catch(e=>{console.error(e.message);process.exit(1)});
