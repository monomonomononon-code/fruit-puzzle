import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
await mkdir('test-results/flow',{recursive:true});
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
      const t=window.__gameTest;t.start(8);const g=new Game(LEVELS[7],seeded(17));t.game.board=g.board;t.game.rng=g.rng;
      t.game.level={...t.game.level,goals:[{key:'fruit0',count:500}]};
      t.game.board[57].special='horizontal';t.game.board[57].fruit=null;t.inject(t.game.board);
      const play=t.game.play.bind(t.game);t.game.play=(a,b)=>{window.flowResult=play(a,b);return window.flowResult;};
    });
    await page.screenshot({path:'test-results/flow/'+name+'-before.png'});
    await page.locator('.cell').nth(57).click();await page.locator('.cell').nth(58).click();
    await page.waitForFunction(()=>!window.__gameTest.busy);
    const fall=await page.evaluate(()=>window.flowResult.events.find(e=>e.type==='fall'));
    assert.ok(fall.moves.some(m=>!m.fresh&&m.path.some((p,n)=>n&&Math.floor(p/9)===Math.floor(m.path[n-1]/9))));
    assert.ok(fall.moves.filter(m=>m.fresh).every(m=>m.from<9));
    assert.ok(await page.evaluate(()=>{const s=window.__gameTest.state();return JSON.stringify(s.board)===JSON.stringify(s.visibleBoard);}));
    await page.screenshot({path:'test-results/flow/'+name+'-after.png'});
  }
  check('Lv8中央下の実クリック消去：左右流入・上端補充・アニメーション完了・PC/スマホ画像');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/flow/report.json',JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
