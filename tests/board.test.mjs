import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, seeded, findMatches, canSwap, validMoves, snapshot, movable } from '../src/engine.js';
import { withTopology, edgeKey, openEdge } from '../src/topology.js';
import { LEVELS } from '../src/levels.js';
import { mappedStage, validateLayout } from '../src/level-layout.js';

function fixture(width=5,height=4,walls=[]) {
  const g=new Game(LEVELS[0],seeded(19));
  g.board=withTopology(Array.from({length:width*height},(_,i)=>({id:i+1,fruit:(Math.floor(i/width)*2+i%width)%6,special:null,cover:0,coverType:null,void:false,block:false})),{width,height,walls:new Set(walls.map(([a,b])=>edgeKey(a,b)))});
  return g;
}
test('2×2単独は4マッチ、交換先に十字を生成して3個だけ収穫',()=>{
  const g=fixture();
  [6,7,11,13].forEach(i=>g.board[i].fruit=0); g.board[12].fruit=5;
  assert.equal(findMatches(g.board).length,0); assert.ok(canSwap(g.board,12,13));
  const result=g.play(13,12),wave=result.events[1];
  assert.equal(wave.board[12].special,'cross'); assert.deepEqual(wave.created,[12]);
  assert.deepEqual(new Set(wave.removed),new Set([6,7,11]));
});
test('正方形と直線が重なる6マッチは虹、重複消去なし',()=>{
  const g=fixture(); [5,6,7,8,11,12].forEach(i=>g.board[i].fruit=0); g.board[9].fruit=1;
  const groups=findMatches(g.board); const group=groups.find(x=>x.includes(11));
  assert.equal(group.length,6);const wave=g.wave([group],[11]);
  assert.equal(g.board[11].special,'rainbow');assert.equal(wave.removed.length,5);assert.equal(new Set(wave.removed).size,5);
});
test('2×2の4辺のいずれかに壁・空間・氷があると成立しない',()=>{
  for(const wall of [[6,7],[6,11],[7,12],[11,12]]) {
    const g=fixture(5,4,[wall]);[6,7,11,12].forEach(i=>g.board[i].fruit=0);assert.equal(findMatches(g.board).length,0);
  }
  for(const type of ['void','block','cover']) {
    const g=fixture();[6,7,11,12].forEach(i=>g.board[i].fruit=0);g.board[12][type]=true;
    assert.equal(findMatches(g.board).length,0);
  }
});
test('11列の縦5個は縦ライン、単独正方形は専用設定を参照',()=>{
  const g=fixture(11,9),vertical=[18,29,40,51,62];
  vertical.forEach(i=>g.board[i].fruit=0);g.wave([vertical]);
  assert.equal(g.board[18].special,'vertical');
  const h=fixture(11,9);h.level={...h.level,squareSpecial:'horizontal'};
  const square=[60,61,71,72];square.forEach(i=>h.board[i].fruit=0);h.wave([square]);
  assert.equal(h.board[60].special,'horizontal');
});
test('壁は交換・直線マッチ・隣接ダメージを遮り、特殊は届く',()=>{
  const g=fixture(5,4,[[6,7]]);[5,6,7].forEach(i=>g.board[i].fruit=0);
  assert.equal(findMatches(g.board).length,0);
  g.board[6].special=g.board[7].special='rainbow';assert.equal(canSwap(g.board,6,7),false);
  g.board[7].cover=2;g.board[7].coverType='box';g.board[6].special=null;
  g.wave([],[],[6]);assert.equal(g.board[7].cover,2);
  g.wave([],[],g.line(6));assert.equal(g.board[7].cover,1);
});
function slide(walls=[[6,11]]) {
  const g=fixture(5,4,walls);
  for(const i of [0,2]) {g.board[i].void=true;g.board[i].fruit=null;}
  for(const i of [5,7,10,12])g.board[i].fruit=null;
  return g;
}
test('壁の下を回り込む：両側が空なら左を優先、経路は横→下',()=>{
  const g=slide(),id=g.board[6].id,event=g.gravity();
  const m=event.moves.find(m=>m.id===id);
  assert.deepEqual(m.path,[6,5,10]);assert.equal(g.board[10].id,id);
});
test('左の辺が壁なら右回り、どちらも塞がればすり抜けない',()=>{
  let g=slide([[6,11],[6,5]]),id=g.board[6].id;
  assert.deepEqual(g.gravity().moves.find(m=>m.id===id).path,[6,7,12]);
  g=slide([[6,11],[6,5],[7,12]]);id=g.board[6].id;
  const moves=g.gravity().moves;
  // 横方向の新仕様では右の空きへは動けるが、その下の壁は越えない。
  assert.deepEqual(moves.find(m=>m.id===id).path,[6,7]);assert.equal(g.board[7].id,id);
});
test('斜め中継が空間・障害物・果物なら通過しない',()=>{
  for(const kind of ['void','block','cover','fruit']) {
    const g=slide([[6,11],[6,7]]),id=g.board[6].id;
    if(kind==='fruit') {g.board[5].fruit=3;g.board[10].fruit=4;}
    else {g.board[5][kind]=true;if(kind==='cover')g.board[5].fruit=3;}
    g.gravity();assert.equal(g.board[6].id,id);
  }
});
test('真下が空いていれば左右回りより優先し、同じ状態・乱数で同じ経路',()=>{
  const a=slide([]),b=slide([]); a.board[11].fruit=b.board[11].fruit=null;
  const id=a.board[6].id,ea=a.gravity(),eb=b.gravity();
  assert.deepEqual(ea,eb);assert.deepEqual(ea.moves.find(m=>m.id===id).path,[6,11]);
});
test('無効マスの下へは直接落ちず、空いた横の有効経路を使う',()=>{
  const g=slide([]),id=g.board[6].id;g.board[11].void=true;g.board[11].fruit=null;
  assert.deepEqual(g.gravity().moves.find(m=>m.id===id).path,[6,5,10]);assert.equal(g.board[11].fruit,null);
});
test('11×9全消去後も分断・壁を維持し、全有効マスを補充する',()=>{
  for(const id of [10,16,20]) {
    const g=new Game(LEVELS[id-1],seeded(24)),before=snapshot(g.board);
    g.board.forEach(c=>{if(movable(c)){c.fruit=null;c.special=null;}});
    const event=g.gravity();
    assert.equal(g.board.length,99);assert.ok(g.board.every(c=>c.void||c.block?c.fruit===null:c.fruit!==null));
    assert.equal(new Set(g.board.map(c=>c.id)).size,99);
    for(const m of event.moves) for(let n=1;n<m.path.length;n++)assert.ok(openEdge(before,m.path[n-1],m.path[n]));
  }
});
test('寸法上限、不正壁、マップ行幅の不一致を拒否',()=>{
  assert.throws(()=>validateLayout({...LEVELS[0],width:12}),/11×9/);
  assert.throws(()=>validateLayout({...LEVELS[0],height:10}),/11×9/);
  for(const walls of [[[0,9]],[[0,1],[1,0]],[[0,-1]]])assert.throws(()=>validateLayout({...LEVELS[0],walls}),/壁/);
  assert.throws(()=>mappedStage(99,'','','',[],['...','..']),/行幅/);
});
test('全20面×10シード：初期正方形なし、壁を越える合法手なし、地形をシャッフルで保存',()=>{
  for(const level of LEVELS)for(let seed=1;seed<=10;seed++) {
    const g=new Game(level,seeded(seed)),before=snapshot(g.board),topology=g.board.topology;
    assert.equal(findMatches(g.board).length,0);assert.ok(validMoves(g.board).every(([a,b])=>openEdge(g.board,a,b)));
    g.reshuffle();assert.equal(g.board.topology,topology);
    before.forEach((c,i)=>{if(c.void||c.block||c.cover)assert.deepEqual(g.board[i],c);});
  }
});
