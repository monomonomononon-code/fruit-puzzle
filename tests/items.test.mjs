import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, seeded, findMatches, validMoves, canSwap, snapshot, occupied } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { withTopology, edgeKey } from '../src/topology.js';

function fixture() {
  const g = new Game(LEVELS[0], seeded(7));
  g.board = withTopology(Array.from({ length: 64 }, (_, i) => ({ id: i + 1, fruit: (Math.floor(i / 8) * 2 + i % 8) % 6, special: null, block: false, void: false, cover: 0, coverType: null })), { width: 8, height: 8, walls: new Set() });
  return g;
}
function item(g, i, special) { g.board[i].fruit = null; g.board[i].special = special; }
for (const [count, type] of [[4, 'cross'], [5, 'horizontal'], [6, 'rainbow']]) {
  test(`${count}個生成：独立${type}は果物属性なし・収穫加算なし`, () => {
    const g=fixture(), group=Array.from({length:count},(_,n)=>24+n);
    group.forEach(i=>g.board[i].fruit=0);g.wave([group],[25]);
    assert.equal(g.board[25].special,type);assert.equal(g.board[25].fruit,null);
    assert.equal(g.progress.fruit0,count-1);assert.ok(occupied(g.board[25]));
  });
}
test('特殊は直線・2×2マッチを構成しない',()=>{
  for(const special of ['cross','horizontal','vertical','rainbow']) {
    const g=fixture();[25,26,27,33,34].forEach(i=>g.board[i].fruit=0);item(g,26,special);
    assert.equal(findMatches(g.board).length,0);
  }
});
for (const type of ['cross','horizontal','vertical','rainbow']) {
  test(`通常の手がなくても${type}があれば交換可能・シャッフルしない`,()=>{
    const g=fixture();assert.equal(validMoves(g.board).length,0);item(g,27,type);
    const before=snapshot(g.board);assert.ok(validMoves(g.board).length);
    assert.equal(g.ensurePlayable(),null);assert.deepEqual(g.board,before);
    const wave=g.play(27,28).events[1];assert.ok(wave.removed.includes(28));
    assert.equal(wave.board[28].special,null);
    assert.ok(!Object.hasOwn(wave.progress,'fruitnull'));
    assert.equal(Object.values(wave.progress).reduce((a,b)=>a+b,0),wave.removed.filter(i=>!wave.before[i].special).length);
  });
}
for (const [a,b,type] of [[27,28,'horizontal'],[28,27,'horizontal'],[27,35,'vertical'],[35,27,'vertical']]) {
  test(`ラインは交換方向で決定 ${a}→${b}、先に選ぶ側に依存しない`,()=>{
    for(const reverse of [false,true]) {
      const g=fixture();item(g,a,type==='horizontal'?'vertical':'horizontal');
      const wave=g.play(...(reverse?[b,a]:[a,b])).events[1];
      assert.equal(wave.before[b].special,type);
      assert.deepEqual(new Set(wave.removed),new Set(g.line(b,type==='vertical')));
    }
  });
}
test('壁や固定障害物で孤立した特殊は有効手と数えない',()=>{
  const g=fixture();item(g,27,'cross');
  for(const j of [19,35,26,28])g.board.topology.walls.add(edgeKey(27,j));
  assert.equal(validMoves(g.board).length,0);assert.equal(canSwap(g.board,27,28),false);
  const old={...g.board[27]};assert.notEqual(g.ensurePlayable(),null);assert.deepEqual(g.board[27],old);
  g.board[28].cover=1;assert.equal(canSwap(g.board,27,28),false);
});
test('属性なしアイテムも通常落下・回り込みでIDと種類を保持',()=>{
  const g=fixture();item(g,9,'cross');const id=g.board[9].id;
  g.board[1].void=true;g.board[1].fruit=null;
  g.board[8].fruit=null;g.board[16].fruit=null;
  g.board[0].void=true;g.board[0].fruit=null;
  g.board.topology.walls.add(edgeKey(9,17));
  const move=g.gravity().moves.find(m=>m.id===id);
  assert.deepEqual(move.path,[9,8,16]);assert.equal(g.board[16].special,'cross');assert.equal(g.board[16].fruit,null);
  assert.equal(new Set(g.board.map(c=>c.id)).size,64);
  assert.ok(g.board.every(c=>c.void||c.block?!occupied(c):occupied(c)));
});
test('虹との合成対象は最多果物、同数は果物順、色をアイテムに保持しない',()=>{
  const g=fixture();g.board.forEach((c,i)=>c.fruit=i<32?2:4);
  item(g,27,'horizontal');item(g,28,'rainbow');
  assert.equal(g.dominantFruit(),4);
  const combo=g.combo(27,28);const seeds=g.board.flatMap((c,i)=>!c.special&&c.fruit===4?[i]:[]);
  assert.deepEqual(new Set(combo.targets),new Set([27,28,...seeds.flatMap(i=>[...g.line(i),...g.line(i,true)])]));
  g.board[40].fruit=2;assert.equal(g.dominantFruit(),2);
});
for(const [a,b] of [['cross','cross'],['cross','horizontal'],['horizontal','vertical'],['horizontal','rainbow'],['cross','rainbow'],['rainbow','rainbow']]) {
  test(`属性なし合成 ${a}×${b}：1回消費・重複計上なし`,()=>{
    const g=fixture();item(g,27,a);item(g,28,b);
    const e=g.play(27,28).events[1];assert.ok(e.label);assert.equal(new Set(e.removed).size,e.removed.length);
    assert.equal(e.activated.filter(i=>i===27).length,1);assert.equal(e.activated.filter(i=>i===28).length,1);
    assert.equal(Object.values(e.progress).reduce((x,y)=>x+y,0),e.removed.length-2);
    if(a===b&&a==='rainbow')assert.equal(e.removed.length,64);
  });
}
test('特殊だけの盤面でも虹合成を消費でき、補充とクリア判定が進む',()=>{
  const g=fixture();g.board.forEach((_,i)=>item(g,i,'rainbow'));
  assert.ok(validMoves(g.board).length);const e=g.play(27,28).events[1];
  assert.equal(e.removed.length,64);assert.ok(Object.values(e.progress).every(n=>n===0));
  assert.equal(g.complete(),false);assert.ok(g.board.every(occupied));
});
test('異常な長連鎖の計算保護でもシャッフルせず元の操作へ戻す',()=>{
  const g=fixture();item(g,27,'horizontal');const before=snapshot(g.board),progress={...g.progress};
  g.gravity=()=>{for(const i of [0,1,2]){g.board[i].fruit=0;g.board[i].special=null;}return {type:'fall',board:snapshot(g.board),moves:[]};};
  const result=g.play(27,28);
  assert.equal(result.cancelled,'cascade-limit');assert.equal(result.valid,false);assert.deepEqual(result.events,[]);
  assert.deepEqual(g.board,before);assert.deepEqual(g.progress,progress);assert.ok(canSwap(g.board,27,28));
});
