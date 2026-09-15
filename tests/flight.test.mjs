import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,seeded,validMoves,findMatches,snapshot} from '../src/engine.js';
import {LEVELS} from '../src/levels.js';
function fixture(seed=1){const g=new Game(LEVELS[0],seeded(seed));g.board.forEach((c,i)=>{c.fruit=(Math.floor(i/8)*2+i%8)%6;c.special=null;});g.board[17].fruit=null;g.board[17].special='cross';return g;}
test('飛行は1果物だけを収穫し、着地・消費・進捗を一致させる',()=>{
  const g=fixture();const result=g.play(17,18),wave=result.events.find(e=>e.type==='clear');
  assert.equal(wave.flights.length,1);assert.equal(wave.flights[0].from,18);
  assert.deepEqual(new Set(wave.removed),new Set([18,wave.flights[0].to]));
  assert.equal(Object.values(wave.progress).reduce((a,b)=>a+b,0),1);
  assert.equal(wave.board[18].special,null);assert.ok(!result.events.some(e=>e.type==='shuffle'));
});
test('通常手のあるとき未達成目標の果物を優先し、完了目標を除く',()=>{
  const g=fixture();[24,25,27,18].forEach(i=>g.board[i].fruit=0);g.board[26].fruit=4;
  g.level={...g.level,goals:[{key:'fruit0',count:10},{key:'fruit3',count:20}]};g.progress.fruit0=10;
  assert.ok(validMoves(g.board).some(([a,b])=>!g.board[a].special&&!g.board[b].special));
  const wave=g.play(17,18).events.find(e=>e.type==='clear');assert.equal(wave.before[wave.flights[0].to].fruit,3);
});
test('通常手ゼロ20シード：飛行後は通常手あり・連鎖完了・シャッフルなし',()=>{
  for(let seed=1;seed<=20;seed++){
    const g=fixture(seed);assert.ok(validMoves(g.board).every(([a,b])=>g.board[a].special||g.board[b].special));
    const r=g.play(17,18);assert.equal(r.valid,true);assert.equal(findMatches(g.board).length,0);
    assert.ok(validMoves(g.board).some(([a,b])=>!g.board[a].special&&!g.board[b].special));
    assert.ok(!r.events.some(e=>e.type==='shuffle'||e.type==='flight-rescue'));
    assert.deepEqual(g.board,r.events.at(-1).board);
  }
});
test('同じ盤面と乱数なら着地点・補充・最終盤面が一致',()=>{
  const a=fixture(32),b=fixture(32);assert.deepEqual(a.play(17,18),b.play(17,18));assert.deepEqual(snapshot(a.board),snapshot(b.board));
});
test('2マスしかない例外でもラインを残し完全手詰まりにしない',()=>{
  const g=fixture();g.board.forEach((c,i)=>{if(i!==17&&i!==18){c.block=true;c.fruit=null;c.special=null;}});
  const result=g.play(17,18);assert.ok(result.valid);assert.ok(validMoves(g.board).length);
  assert.ok(result.events.some(e=>e.type==='flight-rescue'));assert.ok(!result.events.some(e=>e.type==='shuffle'));
});
