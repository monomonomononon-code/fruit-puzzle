import {createRequire} from 'node:module';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[];const pass=s=>{checks.push(s);console.log('PASS '+s);};
await mkdir('test-results/stock',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173/?test=1');await page.waitForFunction(()=>window.__gameTest);
 assert.deepEqual(await page.evaluate(()=>window.__gameTest.saved.stock),{delivery:1,line:1,rainbow:0});
 await page.locator('#stock').click();await page.locator('[data-stock=line]').click();
 await page.locator('.cell').nth(0).click();
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stock.line),1);
 await page.locator('#stock').click();await page.locator('#close-modal').click();
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stock.line),1);pass('選択・取消で在庫を消費しない');
 await page.locator('#stock').click();await page.locator('[data-stock=line]').click();await page.keyboard.press('Escape');
 assert.match(await page.locator('#status').innerText(),/取り消し/);pass('盤面を選ぶ前でもEscで取消');
 await page.locator('#stock').click();await page.locator('[data-stock=line]').click();
 await page.locator('.cell').nth(0).click();await page.locator('.cell').nth(1).click();
 await page.waitForFunction(()=>!window.__gameTest.busy);
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stock.line),0);
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stageUses[1]),1);
 await page.reload();await page.waitForFunction(()=>window.__gameTest);
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stock.line),0);
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stageUses[1]),1);pass('タップでライン発動・消費と使用回数を再読み込みでも保持');
 await page.evaluate(()=>{const q=window.__gameTest;q.saved.settings.reduced=true;q.game.board.forEach((c,i)=>{c.fruit=(Math.floor(i/8)*2+i%8)%6;c.special=null;});q.inject(q.game.board);});
 assert.equal(await page.evaluate(()=>window.__gameTest.validMoves().length),0);
 await page.locator('#hint').click();assert.ok(await page.locator('#choose-stock').isVisible());
 await page.locator('#choose-stock').click();await page.locator('[data-stock=delivery]').click();
 await page.locator('.cell').nth(17).click();await page.locator('.cell').nth(18).click();await page.waitForFunction(()=>!window.__gameTest.busy);
 assert.equal(await page.evaluate(()=>window.__gameTest.saved.stock.delivery),0);assert.ok(await page.evaluate(()=>window.__gameTest.validMoves().length)>0);pass('通常手ゼロからストックおとどけで続行');
 for(const level of [8,17,18]) {
  await page.evaluate(id=>window.__gameTest.start(id),level);
  for(let n=0;n<15;n++) {
   const move=await page.evaluate(()=>window.__gameTest.validMoves()[0]);if(!move)break;
   await page.locator('.cell').nth(move[0]).click();await page.locator('.cell').nth(move[1]).click();await page.waitForFunction(()=>!window.__gameTest.busy);
   if(await page.locator('#modal').evaluate(d=>d.open))break;
  }
  await page.screenshot({path:`test-results/stock/mobile-lv${level}.png`});
  if(await page.locator('#modal').evaluate(d=>d.open))await page.locator('#close-modal').click();
 }
 pass('Lv8・17・18で各最大15手のブラウザ実操作');
 await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'test-results/stock/desktop.png'});
 await page.evaluate(()=>{const q=window.__gameTest;q.start(1);q.game.progress.fruit0=15;q.game.board[0].special='rainbow';});
 // Completion collection is tested in pure logic; UI clear is driven by an actual move below.
 await page.evaluate(()=>{const q=window.__gameTest;q.game.progress.fruit0=14;q.game.board[0].special='rainbow';q.game.board[0].fruit=null;q.game.board[1].special='rainbow';q.game.board[1].fruit=null;q.inject(q.game.board);});
 await page.locator('.cell').nth(0).click();await page.locator('.cell').nth(1).click();await page.waitForFunction(()=>!window.__gameTest.busy);
 assert.ok(await page.locator('#modal-content').innerText().then(t=>t.includes('回収')));pass('初回クリア時の回収結果を表示');
 const blocked=await browser.newPage();
 await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('storage unavailable');};});
 await blocked.goto('http://localhost:4173/?test=1');await blocked.waitForFunction(()=>window.__gameTest);
 assert.ok(await blocked.locator('#save-warning').isVisible());
 await blocked.evaluate(async()=>{const q=window.__gameTest;q.saved.settings.reduced=true;q.chooseStock('line');await q.attempt(0,1);});
 assert.equal(await blocked.evaluate(()=>window.__gameTest.saved.stock.line),0);
 assert.equal(await blocked.evaluate(()=>window.__gameTest.busy),false);pass('保存不可でも警告してストック使用をメモリ内で継続');
 await blocked.close();
 assert.deepEqual(errors,[]);
 await writeFile('test-results/stock/browser-report.json',JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
