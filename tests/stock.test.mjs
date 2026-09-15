import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, seeded, validMoves, snapshot } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { cleanSave } from '../src/storage.js';
import { useStock, stockUsable, stockPairs, collectClear, settleRescue, stockTotal } from '../src/stock.js';
const fixture = () => [new Game(LEVELS[0],seeded(17)),cleanSave(null,20)];
test('新規と旧セーブに初期2個、一度保存した0個は再配布しない',()=>{
  for(const raw of [null,{version:1,cleared:[1],highest:2}]) {
    const s=cleanSave(raw,20);assert.deepEqual(s.stock,{delivery:1,line:1,rainbow:0});
    s.stock.delivery=s.stock.line=0;assert.equal(stockTotal(cleanSave(s,20)),0);
  }
});
test('保存の上限・型・ステージ使用回数を修復',()=>{
  const s=cleanSave({version:2,stock:{delivery:99,line:9,rainbow:3},stageUses:{1:8,2:-5,3:'3',99:2}},20);
  assert.equal(stockTotal(s),6);assert.equal(s.stageUses[1],3);assert.equal(s.stageUses[2],0);assert.equal(s.stageUses[3],0);assert.equal(s.stageUses[99],undefined);
});
test('配置候補は通常果物間のみ、壁・障害物・アイテムを拒否',()=>{
  const [g,s]=fixture();const [a,b]=stockPairs(g)[0];g.board[a].cover=1;
  assert.equal(useStock(g,s,'line',a,b).valid,false);g.board[a].cover=0;g.board[a].special='rainbow';
  assert.equal(useStock(g,s,'line',a,b).valid,false);assert.equal(s.stock.line,1);
  const wallGame=new Game(LEVELS[2],seeded(1));assert.ok(!stockPairs(wallGame).some(([a,b])=>a===8&&b===15));
});
test('無効操作は消費なし、ライン使用は方向に発動し確定時だけ消費',()=>{
  const [g,s]=fixture(),before=snapshot(g.board);
  assert.equal(useStock(g,s,'line',0,39).valid,false);assert.deepEqual(g.board,before);
  const r=useStock(g,s,'line',0,1);assert.equal(r.valid,true);assert.equal(s.stock.line,0);assert.equal(s.stageUses[1],1);
  assert.equal(r.events[0].type,'stock-place');assert.equal(r.events.find(e=>e.type==='clear').label,'LINE HARVEST');
  assert.equal(cleanSave(s,20).stageUses[1],1);
});
test('1ステージ3個上限は在庫があっても越えられない',()=>{
  const [g,s]=fixture();s.stageUses[1]=3;assert.equal(stockUsable(g,s),false);assert.equal(useStock(g,s,'line',0,1).valid,false);
});
test('通常手ゼロでも使えるストックがあればシャッフルを待つ、使用枠なしなら救済',()=>{
  const [g,s]=fixture();g.board.forEach((c,i)=>{c.special=null;c.fruit=(Math.floor(i/8)*2+i%8)%6;});assert.equal(validMoves(g.board).length,0);
  let r=settleRescue(g,s,{valid:true,events:[]});assert.equal(r.waitingForStock,true);assert.equal(r.events.length,0);
  s.stageUses[1]=3;r=settleRescue(g,s,{valid:true,events:[]});assert.equal(r.events[0].type,'shuffle');assert.ok(validMoves(g.board).length);
});
test('初回のみ回収・種類別と合計上限・再クリアやリロードで増殖しない',()=>{
  const [g,s]=fixture();g.progress.fruit0=15;
  ['cross','cross','cross','horizontal','vertical','rainbow','rainbow'].forEach((special,i)=>{g.board[i].special=special;g.board[i].fruit=null;});
  const r=collectClear(g,s,20);assert.deepEqual(r,{first:true,collected:4,overflow:3});assert.equal(stockTotal(s),6);
  assert.equal(collectClear(g,cleanSave(s,20),20).collected,0);
  const old=cleanSave({version:1,cleared:[1]},20);assert.equal(collectClear(g,old,20).collected,0);
});
test('クリア時に手がなくてもシャッフルやストック使用は不要',()=>{
  const [g,s]=fixture();g.progress.fruit0=15;g.board.forEach((c,i)=>c.fruit=(Math.floor(i/8)*2+i%8)%6);
  assert.equal(stockUsable(g,s),false);assert.equal(settleRescue(g,s,{valid:true,events:[]}).events.length,0);
});
test('おとどけ・虹もストックから使え、残り3回の実使用で打ち止め',()=>{
  const [g,s]=fixture();g.level={...g.level,goals:[{key:'fruit0',count:9999}]};
  s.stock={delivery:3,line:2,rainbow:1};
  for(const kind of ['delivery','rainbow','line']) {
    const result=useStock(g,s,kind,...stockPairs(g)[0]);assert.equal(result.valid,true);
  }
  assert.equal(s.stageUses[1],3);assert.equal(stockTotal(s),3);assert.equal(stockUsable(g,s),false);
  assert.equal(stockUsable(new Game(g.level,seeded(99)),cleanSave(s,20)),false);
});
test('回収対象は連鎖後の残余のみ、未クリアでは回収せず、再クリア時は使用枠だけ戻す',()=>{
  const [g,s]=fixture();g.board[0].special='cross';g.board[0].fruit=null;
  assert.equal(collectClear(g,s,20).collected,0);assert.equal(stockTotal(s),2);
  g.progress.fruit0=15;assert.equal(collectClear(g,s,20).collected,1);
  s.stageUses[1]=3;assert.equal(collectClear(g,s,20).collected,0);assert.equal(s.stageUses[1],undefined);assert.equal(stockTotal(s),3);
});
