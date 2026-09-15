import {createRequire} from 'node:module';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try {
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 await page.goto('http://localhost:4173/?test=1');await page.waitForFunction(()=>window.__gameTest);
 for(const id of [8,17,18]) {
  await page.evaluate(async id=>{
   const q=window.__gameTest,{Game,seeded}=await import('/src/engine.js');
   q.start(id);const g=new Game(q.game.level,seeded(id*713));q.game.board=g.board;q.game.uid=g.uid;q.game.rng=g.rng;
   q.saved.settings.reduced=true;q.inject(q.game.board);window.shuffleCount=0;
   const original=q.game.reshuffle.bind(q.game);q.game.reshuffle=()=>{window.shuffleCount++;return original();};
  },id);
  let steps=0,stocks=0;
  while(!await page.evaluate(()=>window.__gameTest.game.complete())&&steps<400) {
   const moves=await page.evaluate(()=>window.__gameTest.validMoves());let pair;
   if(moves.length)pair=moves[(steps*17+id)%moves.length];
   else {
    const option=await page.evaluate(async()=>{const q=window.__gameTest,{stockPairs}=await import('/src/stock.js');return {kind:['delivery','line','rainbow'].find(k=>q.saved.stock[k]),pair:stockPairs(q.game)[0]};});
    assert.ok(option.kind&&option.pair,'stock wait must be actionable');
    await page.locator('#stock').click();await page.locator(`[data-stock=${option.kind}]`).click();pair=option.pair;stocks++;
   }
   await page.locator('.cell').nth(pair[0]).click();await page.locator('.cell').nth(pair[1]).click();await page.waitForFunction(()=>!window.__gameTest.busy);steps++;
  }
  assert.ok(await page.evaluate(()=>window.__gameTest.game.complete()),`Lv${id} clear`);
  const shuffles=await page.evaluate(()=>window.shuffleCount);report.push({id,steps,stocks,shuffles});
  await page.screenshot({path:`test-results/stock/clear-lv${id}.png`});await page.locator('#close-modal').click();
  console.log(JSON.stringify(report.at(-1)));
 }
 await writeFile('test-results/stock/stage-play.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
