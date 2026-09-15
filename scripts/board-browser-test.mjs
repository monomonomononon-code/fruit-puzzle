import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
await mkdir('test-results/board',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
const check=s=>{checks.push(s);console.log(`PASS ${s}`);};
try {
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173/?test=1');await page.waitForFunction(()=>!!window.__gameTest);
  // 全面でマス寸法と地形表示を確認。最小端末も含む。
  for(const [width,height] of [[844,390],[568,320],[1366,900]]) {
    await page.setViewportSize({width,height});
    for(let id=1;id<=20;id++) {
      const state=await page.evaluate(id=>{
        const t=window.__gameTest;t.start(id);
        const cells=[...document.querySelectorAll('.cell')],r=document.querySelector('#board').getBoundingClientRect();
        return {count:cells.length,expected:t.game.width*t.game.height,voids:cells.filter(c=>c.classList.contains('void')).length,expectedVoids:t.game.level.voids.length,
          square:cells.every(c=>{const x=c.getBoundingClientRect();return Math.abs(x.width-x.height)<1;}),walls:document.querySelectorAll('#walls i').length,expectedWalls:t.game.level.walls.length,
          inView:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
      },id);
      assert.equal(state.count,state.expected);assert.equal(state.voids,state.expectedVoids);assert.equal(state.walls,state.expectedWalls);assert.ok(state.square);assert.ok(state.inView);
    }
  }
  check('全20面×3画面サイズ：可変マス数・正方形セル・壁・空間・画面内表示');
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>window.__gameTest.start(3));
  const before=await page.evaluate(()=>JSON.stringify(window.__gameTest.state()));
  for(const i of [8,15])await page.locator('.cell').nth(i).click();
  await page.waitForFunction(()=>!window.__gameTest.busy);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__gameTest.state())),before);
  assert.match(await page.locator('#status').textContent(),/壁/);
  check('壁を挟んだタップ交換は拒否し、盤面・進行を維持');
  await page.evaluate(()=>{
    const t=window.__gameTest;t.start(3);const state=t.state();
    state.board.forEach((c,i)=>{if(!c.void&&!c.block&&!c.cover)c.fruit=(Math.floor(i/7)*2+i%7)%6;});
    for(const i of [10,11,17,19])state.board[i].fruit=0;
    state.board[16].fruit=2;state.board[18].fruit=5;t.inject(state.board);
    window.recordedWaves=[];
    const play=t.game.play.bind(t.game);
    t.game.play=(a,b)=>{const result=play(a,b);window.recordedWaves=result.events;return result;};
    window.fallAnimations=[];const animate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){if(this.classList.contains('cell')&&frames.some(f=>f.transform?.startsWith('translate(')))window.fallAnimations.push(frames);return animate.call(this,frames,options);};
  });
  await page.locator('.cell').nth(19).click();await page.locator('.cell').nth(18).click();
  await page.waitForFunction(()=>!window.__gameTest.busy);
  const square=await page.evaluate(()=>window.recordedWaves.find(e=>e.type==='clear'));
  assert.ok(square.created.includes(18));assert.equal(square.board[18].special,'cross');
  assert.equal(square.removed.length,3);
  assert.ok(await page.evaluate(()=>window.fallAnimations.length>0));
  check('実クリックで2×2特殊生成、落下アニメーション、入力解放');
  await page.screenshot({path:'test-results/board/square-landscape.png'});
  await page.evaluate(()=>window.__gameTest.start(10));
  await page.screenshot({path:'test-results/board/max-landscape.png'});
  // 乱数固定で回り込みのある通常プレイを再現し、経路が描画用キーに渡ることを確認。
  const found=await page.evaluate(async()=>{
    const {Game,seeded,validMoves}=await import('/src/engine.js');
    const {LEVELS}=await import('/src/levels.js');
    for(let seed=1;seed<=60;seed++){
      const g=new Game(LEVELS[2],seeded(seed)),pair=validMoves(g.board)[0];
      const before=g.board.map(c=>({...c})),result=g.play(...pair);
      if(result.events.some(e=>e.type==='fall'&&e.moves.some(m=>m.path.some((p,i)=>i&&Math.floor(p/7)===Math.floor(m.path[i-1]/7))))) {
        const t=window.__gameTest;t.start(3);before.forEach((c,i)=>Object.assign(t.game.board[i],c));
        t.game.rng=seeded(seed);t.inject(t.game.board);return pair;
      }
    }
    return null;
  });
  assert.ok(found);
  await page.evaluate(()=>{window.fallAnimations=[];});
  for(const i of found)await page.locator('.cell').nth(i).click();
  await page.waitForFunction(()=>!window.__gameTest.busy);
  assert.ok(await page.evaluate(()=>window.fallAnimations.some(frames=>frames.length>2&&frames.some((f,i)=>i&&f.transform?.split(',')[0]!==frames[i-1].transform?.split(',')[0]))));
  check('回り込みのある実プレイで横移動を含む落下アニメーションが完了');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/board/report.json',JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
