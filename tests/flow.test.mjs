import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, seeded, occupied, snapshot } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { edgeKey, openEdge } from '../src/topology.js';

test('Lv8の中央下を消すと左右の既存果物が流入し、補充は上端だけ',()=>{
  const g=new Game(LEVELS[7],seeded(19)),before=snapshot(g.board);
  for(const i of [57,58,59])g.board[i].fruit=null;
  const e=g.gravity();
  for(const i of [57,58,59])assert.equal(g.board[i].id,before[i-9].id);
  const horizontal=e.moves.filter(m=>!m.fresh&&m.path.some((p,n)=>n&&Math.floor(p/9)===Math.floor(m.path[n-1]/9)));
  assert.ok(horizontal.some(m=>m.path.some((p,n)=>n&&p>m.path[n-1]&&Math.floor(p/9)===Math.floor(m.path[n-1]/9))));
  assert.ok(horizontal.some(m=>m.path.some((p,n)=>n&&p<m.path[n-1])));
  assert.ok(e.moves.filter(m=>m.fresh).every(m=>m.from<9));
  assert.ok(g.board.every(c=>c.void||c.block?!occupied(c):occupied(c)));
});
test('中央直下の穴は左隣のアイテムを引き込み、IDと種類を保持',()=>{
  const g=new Game(LEVELS[7],seeded(11));
  g.board[48].special='cross';g.board[48].fruit=null;const id=g.board[48].id;
  g.board[49].fruit=null;const e=g.gravity();
  assert.equal(g.board[49].id,id);assert.equal(g.board[49].special,'cross');
  assert.deepEqual(e.moves.find(m=>m.id===id).path,[48,49]);
  assert.ok(e.moves.filter(m=>m.fresh).every(m=>m.from<9));
});
test('横流入も壁・空洞・箱を越えず、孤立区間だけ局所補充する',()=>{
  const g=new Game(LEVELS[7],seeded(3));
  g.board.topology.walls.add(edgeKey(48,49));g.board.topology.walls.add(edgeKey(49,50));
  g.board[49].fruit=null;const before=snapshot(g.board),e=g.gravity();
  assert.ok(e.moves.some(m=>m.fresh&&m.from===49));
  for(const m of e.moves)for(let n=1;n<m.path.length;n++)assert.ok(openEdge(before,m.path[n-1],m.path[n]));
  assert.equal(new Set(g.board.map(c=>c.id)).size,g.board.length);
});
test('全20面で横流入は決定的に停止し、完全消去後も空き・ID重複なし',()=>{
  for(const level of LEVELS){
    const a=new Game(level,seeded(25)),b=new Game(level,seeded(25));
    for(const g of [a,b])g.board.forEach(c=>{if(!c.cover){c.fruit=null;c.special=null;}});
    assert.deepEqual(a.gravity(),b.gravity());
    assert.ok(a.board.every(c=>c.void||c.block?!occupied(c):occupied(c)));
    assert.equal(new Set(a.board.map(c=>c.id)).size,a.board.length);
  }
});
