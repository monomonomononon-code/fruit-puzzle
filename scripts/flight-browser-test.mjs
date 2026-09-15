import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
await mkdir('test-results/flight',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
const check=s=>{checks.push(s);console.log(`PASS ${s}`);};
try {
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173/?test=1');await page.waitForFunction(()=>!!window.__gameTest);
  for(const [width,height,name] of [[844,390,'mobile'],[1366,900,'desktop']]) {
    await page.setViewportSize({width,height});
    await page.evaluate(async()=>{
      const {Game,seeded}=await import('/src/engine.js');const {LEVELS}=await import('/src/levels.js');
      const t=window.__gameTest;t.start(1);const g=new Game(LEVELS[0],seeded(9));
      g.board.forEach((c,i)=>{c.fruit=(Math.floor(i/8)*2+i%8)%6;c.special=null;});g.board[17].fruit=null;g.board[17].special='cross';
      t.game.board=g.board;t.game.rng=g.rng;t.inject(t.game.board);
      const play=t.game.play.bind(t.game);t.game.play=(a,b)=>{window.flightResult=play(a,b);return window.flightResult;};
    });
    await page.locator('.cell').nth(17).click();await page.locator('.cell').nth(18).click();
    await page.locator('.flying-pick').waitFor({state:'visible'});
    assert.equal(await page.locator('#board').getAttribute('aria-busy'),'true');
    await page.screenshot({path:'test-results/flight/'+name+'-flight.png'});
    await page.waitForFunction(()=>!window.__gameTest.busy);
    const result=await page.evaluate(()=>window.flightResult),wave=result.events.find(e=>e.type==='clear');
    assert.equal(wave.flights.length,1);assert.equal(wave.removed.length,2);
    assert.ok(!result.events.some(e=>e.type==='shuffle'));
    assert.ok(await page.evaluate(()=>{const t=window.__gameTest;return t.validMoves().some(([a,b])=>!t.game.board[a].special&&!t.game.board[b].special);}));
    await page.screenshot({path:'test-results/flight/'+name+'-after.png'});
  }
  check('PC/スマホ：飛行→着地1果物消去→通常手復帰、演出中入力ロック');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/flight/report.json',JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
