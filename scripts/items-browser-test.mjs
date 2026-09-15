import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
await mkdir('test-results/items',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
const check=s=>{checks.push(s);console.log(`PASS ${s}`);};
try {
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173/?test=1');await page.waitForFunction(()=>!!window.__gameTest);
  await page.evaluate(()=>{window.__gameTest.saved.settings.reduced=true;});
  for (const [type,a,b] of [['cross',17,18],['horizontal',17,18],['horizontal',17,25],['rainbow',17,18]]) {
    await page.evaluate(([type,a])=>{
      const t=window.__gameTest;t.start(1);const state=t.state();
      state.board.forEach((c,i)=>{c.fruit=(Math.floor(i/8)*2+i%8)%6;c.special=null;});
      state.board[a].fruit=null;state.board[a].special=type;t.inject(state.board);
      t.game.level={...t.game.level,goals:[{key:'fruit0',count:500}]};
      const play=t.game.play.bind(t.game);t.game.play=(a,b)=>{window.lastResult=play(a,b);return window.lastResult;};
    },[type,a]);
    assert.ok(await page.evaluate(a=>window.__gameTest.validMoves().every(pair=>pair.includes(a)),a));
    assert.equal(await page.locator('.cell').nth(a).locator('.fruit-art').count(),0);
    assert.ok(await page.locator('.cell').nth(a).locator('.item-symbol').isVisible());
    assert.equal(await page.locator('.cell').nth(a).getAttribute('aria-disabled'),'false');
    await page.locator('#hint').click();assert.equal(await page.locator('.hinted').count(),2);
    await page.locator('.cell').nth(a).click();await page.locator('.cell').nth(b).click();
    await page.waitForFunction(()=>!window.__gameTest.busy);
    const result=await page.evaluate(()=>window.lastResult);assert.ok(result.valid);
    const wave=result.events.find(e=>e.type==='clear');assert.ok(wave.removed.includes(b));
    if(type==='horizontal')assert.equal(wave.removed.length,b===18?8:5);
    assert.ok(await page.evaluate(()=>{const s=window.__gameTest.state();return JSON.stringify(s.board)===JSON.stringify(s.visibleBoard);}));
  }
  check('通常手ゼロ・独立特殊のみの盤面：ヒント、実クリック発動、方向別ライン、描画同期');
  for(const [width,height,name] of [[844,390,'mobile'],[1366,900,'desktop']]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{
      const t=window.__gameTest;t.start(10);const s=t.state();
      ['cross','horizontal','vertical','rainbow'].forEach((special,n)=>{s.board[n].fruit=null;s.board[n].special=special;});t.inject(s.board);
    });
    assert.equal(await page.locator('.item-symbol').count(),4);
    await page.screenshot({path:'test-results/items/'+name+'.png'});
  }
  check('PC・スマホ横向き：果物属性なしの4種表示と操作可能状態');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/items/report.json',JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
