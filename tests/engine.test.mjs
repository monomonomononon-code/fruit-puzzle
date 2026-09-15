import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, findMatches, canSwap, validMoves, seeded, snapshot, movable, occupied, row, col } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { openEdge, active, withTopology, edgeKey } from '../src/topology.js';
import { cleanSave } from '../src/storage.js';
import { readFileSync } from 'node:fs';
import { mappedStage, validateLayout } from '../src/level-layout.js';

const create = (level = LEVELS[0], seed = 42) => new Game(level, seeded(seed));
test('序盤10面のID・名称を保ち、要求どおり可変盤面に再調整', () => {
  const previous=JSON.parse(readFileSync(new URL('./fixtures/legacy-levels.json',import.meta.url),'utf8'));
  assert.deepEqual(LEVELS.slice(0,10).map(l=>[l.id,l.name]),previous.map(l=>[l.id,l.name]));
  assert.ok(LEVELS[0].width*LEVELS[0].height<99);
  assert.ok(LEVELS[1].voids.length>0);
  assert.ok(LEVELS.some(l=>l.width===11&&l.height===9));
  assert.ok(LEVELS.slice(10).some(l=>l.width*l.height<99));
});
test('旧Lv10クリア済みの保存は記録と設定を保ってLv11を開放', () => {
  const old = { version: 1, highest: 10, cleared: Array.from({ length: 10 }, (_, i) => i + 1), settings: { sound: true, reduced: true } };
  const migrated = cleanSave(old, LEVELS.length);
  assert.equal(migrated.highest, 11); assert.deepEqual(migrated.cleared, old.cleared); assert.deepEqual(migrated.settings, old.settings);
  assert.equal(cleanSave({ ...old, cleared: [1, 2, 3] }, LEVELS.length).highest, 10);
});
test('文字マップは障害物を正しく変換し、構造上の開放経路がある', () => {
  for (const level of LEVELS.slice(10)) {
    const info = validateLayout(level);
    assert.equal(info.cells + level.blocks.length + level.voids.length, level.width * level.height);
    assert.equal(info.openingLayers.flat().length, level.ice.length + level.boxes.length);
    for (const [key, char] of [['blocks', '#'], ['ice', 'i'], ['boxes', 'b'], ['voids', '_']]) assert.deepEqual(level[key], [...level.layout.join('')].flatMap((c, i) => c === char ? [i] : []));
  }
  assert.equal(validateLayout(LEVELS[11]).components, 2);
  assert.equal(validateLayout(LEVELS[19]).components, 4);
});
test('不正マップ・重複・不可能な目標・孤立セル・閉鎖障害物を拒否', () => {
  assert.throws(() => mappedStage(99, '', '', '', [{ key: 'fruit0', count: 3 }], ['............']), /11列/ );
  assert.throws(() => mappedStage(99, '', '', '', [{ key: 'fruit0', count: 3 }], Array(8).fill('########')), /プレイできる/);
  assert.throws(() => validateLayout({ ...LEVELS[10], boxes: [...LEVELS[10].boxes, LEVELS[10].ice[0]] }), /重複/);
  assert.throws(() => validateLayout({ ...LEVELS[10], goals: [{ key: 'ice', count: 99 }] }), /配置数/);
  assert.throws(() => mappedStage(99, '', '', '', [{ key: 'fruit0', count: 3 }], ['.#######', '########', '........', '........', '........', '........', '........', '........']), /孤立/);
  assert.throws(() => mappedStage(99, '', '', '', [{ key: 'box', count: 1 }], ['...##bbb', '...##bbb', '...##bbb', '...#####', '...#####', '...#####', '...#####', '...#####']), /足場/);
  assert.throws(() => mappedStage(99, '', '', '', [{ key: 'box', count: 1 }], ['...#####', '...#####', '...#####', '##..bbb#', '###bbbb#', '###bbbb#', '########', '########']), /開けない/);
});
test('追加盤面の手詰まりを救済し、障害物・進捗を保持', () => {
  for (const level of LEVELS.slice(10)) {
    const g = create(level);
    g.board.forEach((c, i) => { if (movable(c)) c.fruit = (row(i, g.board) * 2 + col(i, g.board)) % 6; });
    assert.equal(validMoves(g.board).length, 0);
    const before = snapshot(g.board), progress = { ...g.progress };
    assert.notEqual(g.ensurePlayable(), null);
    assert.ok(validMoves(g.board).length); assert.equal(findMatches(g.board).length, 0);
    assert.deepEqual(g.progress, progress);
    before.forEach((c, i) => { if (c.cover || c.block) assert.deepEqual(g.board[i], c); });
  }
});
test('全盤面の重力経路は空間・壁・固定障害物を越えず、穴を残さない', () => {
  for (const level of LEVELS) {
    const g=create(level), before=snapshot(g.board);
    g.board.forEach((c,i)=>{if(movable(c)&&i%3===0)c.fruit=null;});
    const event=g.gravity();
    for(const m of event.moves) for(let n=1;n<m.path.length;n++) {
      const a=m.path[n-1],b=m.path[n];
      assert.ok(openEdge(before,a,b)); assert.ok(!before[a].cover&&!before[b].cover);
      assert.ok(row(b,before)>=row(a,before));
    }
    g.board.forEach((c,i)=>{assert.equal(c.fruit===null,!active(c));if(!active(c)||c.cover)assert.deepEqual(c,before[i]);});
    assert.equal(new Set(g.board.map(c=>c.id)).size,g.board.length);
  }
});
test('追加10レベル×30シード：合法手だけで全目標クリア、救済後も安定', () => {
  for (const level of LEVELS.slice(10)) for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed * 491), g = create(level, seed * 101); let turns = 0;
    while (!g.complete() && turns++ < 1500) {
      const moves = validMoves(g.board); assert.ok(moves.length, `Lv${level.id} seed${seed}`);
      const result = g.play(...moves[Math.floor(rng() * moves.length)]);
      assert.equal(result.valid, true); assert.equal(findMatches(g.board).length, 0);
    }
    assert.ok(g.complete(), `Lv${level.id} seed${seed}: ${JSON.stringify(g.progress)}`);
  }
});
const board = () => Array.from({ length: 64 }, (_, i) => ({ id: i + 1, fruit: (row(i) * 2 + col(i)) % 6, special: null, block: false, cover: 0, coverType: null }));
function fixture(indices, special = null) {
  const g = create(); g.board = board();
  // 選択した線の周囲に偶発マッチが発生しない色に統一。
  for (const i of indices) { g.board[i].fruit = 0; g.board[i].special = special; }
  return g;
}
test('20レベルのデータ：ID・障害物・達成可能な要求数', () => {
  assert.equal(LEVELS.length, 20);
  for (const [i, l] of LEVELS.entries()) {
    assert.equal(l.id, i + 1);
    const obstacles = [...l.ice, ...l.boxes, ...l.blocks];
    assert.equal(new Set(obstacles).size, obstacles.length);
    assert.ok(obstacles.every(n => Number.isInteger(n) && n >= 0 && n < l.width*l.height));
    for (const goal of l.goals) {
      assert.ok(goal.count > 0);
      if (goal.key === 'ice') assert.ok(goal.count <= l.ice.length);
      if (goal.key === 'box') assert.ok(goal.count <= l.boxes.length);
    }
  }
});
test('20レベル×30シード：初期マッチなし・合法手あり・6種類のみ', () => {
  for (const l of LEVELS) for (let seed = 1; seed <= 30; seed++) {
    const g = create(l, seed);
    assert.equal(findMatches(g.board).length, 0);
    assert.ok(validMoves(g.board).length > 0);
    assert.ok(g.board.every(c => !active(c) ? c.fruit === null : c.fruit >= 0 && c.fruit <= 5));
  }
});
test('無効交換は盤面と収集数を変更しない', () => {
  const g = create(), before = snapshot(g.board), progress = { ...g.progress };
  let pair;
  for (let i = 0; i < 63; i++) if (col(i) < 7 && !canSwap(g.board, i, i + 1)) { pair = [i, i + 1]; break; }
  assert.ok(pair); assert.equal(g.play(...pair).valid, false);
  assert.deepEqual(g.board, before); assert.deepEqual(g.progress, progress);
  assert.equal(canSwap(g.board, 7, 8), false); assert.equal(canSwap(g.board, -1, 0), false);
});
for (const [count, special] of [[3, null], [4, 'cross'], [5, 'horizontal'], [6, 'rainbow'], [7, 'rainbow']]) {
  test(`${count}個マッチ：特殊 ${special ?? 'なし'}、生成位置と収集数`, () => {
    const indices = Array.from({ length: count }, (_, n) => 24 + n), g = fixture(indices);
    if (count < 8) g.board[24 + count].fruit = 1;
    const group = findMatches(g.board).find(x => indices.every(i => x.includes(i)));
    assert.ok(group); assert.equal(group.length, count);
    const e = g.wave([group], [indices[2], indices[1]]);
    assert.equal(g.board[indices[2]].special, special);
    assert.equal(e.removed.length, special ? count - 1 : count);
    assert.equal(g.progress.fruit0, e.removed.length);
    if (special) assert.ok(!e.removed.includes(indices[2]));
  });
}
test('縦5個で縦ライン、連鎖生成は行優先', () => {
  const indices = [3, 11, 19, 27, 35], g = fixture(indices);
  g.wave([indices]); assert.equal(g.board[3].special, 'vertical');
});
test('T字の交差は5個として結合、L字6個は虹', () => {
  let g = fixture([18, 19, 20, 27, 35]);
  let group = findMatches(g.board).find(x => x.includes(19));
  assert.equal(group.length, 5); g.wave([group]); assert.equal(g.board[18].special, 'horizontal');
  g = fixture([17, 25, 33, 41, 42, 43]);
  group = findMatches(g.board).find(x => x.includes(17));
  assert.equal(group.length, 6); g.wave([group]); assert.equal(g.board[17].special, 'rainbow');
});
test('合法な交換から4個特殊を交換先に生成する', () => {
  const g = create(); g.board = board();
  for (const i of [24, 25, 27, 18]) g.board[i].fruit = 0;
  g.board[26].fruit = 4;
  const result = g.play(18, 26);
  assert.equal(result.valid, true);
  const first = result.events.find(e => e.type === 'clear');
  assert.equal(first.board[26].special, 'cross'); assert.ok(first.created.includes(26));
});
test('単独特殊：おとどけ1果物・横8セル・縦8セル', () => {
  const g = create(); g.board = board();
  const flight=g.effect(27,'cross');assert.equal(flight.length,2);assert.equal(flight[0],27);assert.ok(Number.isInteger(g.board[flight[1]].fruit));
  assert.equal(g.effect(27, 'horizontal').length, 8);
  assert.ok(g.effect(27, 'vertical').every(i => col(i) === 3));
});
for (const [aType, bType, minimum, label] of [
  ['cross', 'cross', 25, 'DOUBLE BLOOM'], ['cross', 'horizontal', 39, 'CROSS PARADE'],
  ['horizontal', 'vertical', 22, 'LINE PARTY'], ['horizontal', 'rainbow', 40, 'RAINBOW LINES'],
  ['rainbow', 'rainbow', 64, 'RAINBOW FESTIVAL'], ['cross', 'rainbow', 35, 'RAINBOW BLOOM'],
]) {
  test(`特殊合成 ${aType}×${bType}：効果範囲と重複排除`, () => {
    const g = create(); g.board = board();
    g.board[27].special = aType; g.board[28].special = bType;
    const result = g.play(27, 28), first = result.events.find(e => e.type === 'clear');
    assert.equal(result.valid, true); assert.equal(first.label, label);
    assert.ok(first.removed.length >= minimum, `${first.removed.length} < ${minimum}`);
    assert.equal(new Set(first.removed).size, first.removed.length);
    assert.equal(Object.entries(first.progress).filter(([k]) => k.startsWith('fruit')).reduce((s, [, n]) => s + n, 0), first.removed.filter(i => !first.before[i].special).length);
  });
}
test('虹を通常果物と交換：相手の種類だけ全消去', () => {
  const g = create(); g.board = board(); g.board[27].special = 'rainbow';
  const type = g.board[28].fruit;
  const expected = g.board.flatMap((c, i) => c.fruit === type || i === 27 ? [i] : []);
  const result = g.play(27, 28), wave = result.events[1];
  assert.equal(wave.removed.length, expected.length);
  assert.ok(wave.removed.every(i => i === 28 || wave.before[i].fruit === type));
});
test('巻き込んだ特殊は1回ずつ発動、新生成は同じ波で発動しない', () => {
  const g = create(); g.board = board();
  g.board[27].special = 'horizontal'; g.board[28].special = 'vertical'; g.board[36].special = 'cross';
  const e = g.wave([], [], [27]);
  assert.deepEqual(new Set(e.activated), new Set([27, 28, 36]));
  assert.equal(new Set(e.removed).size, e.removed.length);
});
test('氷：直消し不可、隣接で開くが中身は同じ波で消えない', () => {
  const g = create(LEVELS[3]); g.board = board();
  g.board[27].cover = 1; g.board[27].coverType = 'ice';
  assert.equal(canSwap(g.board, 27, 28), false);
  const fruit = g.board[27].fruit, e = g.wave([], [], [26, 27, 28, 19]);
  assert.equal(g.board[27].cover, 0); assert.equal(g.board[27].fruit, fruit);
  assert.equal(g.progress.ice, 1); assert.ok(!e.removed.includes(27));
});
test('箱：重複攻撃も1波1ダメージ、2波目で開放', () => {
  const g = create(); g.board = board(); g.board[27].cover = 2; g.board[27].coverType = 'box';
  g.wave([], [], [26, 27, 28, 19, 35]); assert.equal(g.board[27].cover, 1); assert.equal(g.progress.box, 0);
  g.wave([], [], [27]); assert.equal(g.board[27].cover, 0); assert.equal(g.progress.box, 1); assert.notEqual(g.board[27].fruit, null);
});
test('虹×虹は全果物を対象にするが永久ブロックと保護を尊重', () => {
  const g = create(LEVELS[9]);
  g.board[2].special = 'rainbow'; g.board[3].special = 'rainbow';
  const before = snapshot(g.board), e = g.play(2, 3).events[1];
  assert.equal(e.removed.length, before.filter(movable).length);
  for (const i of LEVELS[9].blocks) assert.equal(e.board[i].fruit, null);
  for (const i of LEVELS[9].ice) assert.equal(e.board[i].fruit, before[i].fruit);
  for (const i of LEVELS[9].boxes) assert.equal(e.board[i].cover, 1);
});
test('重力は障害物を越えない。区間内部の順序と中身を保持', () => {
  const g = create(); g.board = board();
  g.board[24] = { ...g.board[24], block: true, fruit: null };
  g.board[48].cover = 1; g.board[48].coverType = 'ice';
  const top = g.board[0].id, lower = g.board[32].id, iceId = g.board[48].id;
  for (const i of [8, 16, 40]) g.board[i].fruit = null;
  const event = g.gravity();
  assert.equal(g.board[16].id, top); assert.equal(g.board[40].id, lower); assert.equal(g.board[48].id, iceId);
  assert.equal(g.board[24].fruit, null);
  assert.ok(event.moves.every(m => m.fresh || ![24, 48].some(i => col(i) === col(m.to) && i > m.from && i < m.to)));
});
test('連鎖が発生し、最終盤面は安定・合法手あり', () => {
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const g = create(LEVELS[0], seed), result = g.play(...validMoves(g.board)[0]);
    if (result.chain > 1) {
      found = true; assert.equal(findMatches(g.board).length, 0); assert.ok(validMoves(g.board).length);
      assert.deepEqual(result.events.filter(e => e.type === 'clear').map(e => e.chain), Array.from({ length: result.chain }, (_, i) => i + 1));
    }
  }
  assert.ok(found);
});
test('手詰まりを再現し、自動再配置で進捗・障害物を保持', () => {
  const g = create(LEVELS[9]); g.board = board();
  assert.equal(findMatches(g.board).length, 0); assert.equal(validMoves(g.board).length, 0);
  const progress = { ...g.progress };
  assert.notEqual(g.ensurePlayable(), null); assert.ok(validMoves(g.board).length); assert.equal(findMatches(g.board).length, 0);
  assert.deepEqual(g.progress, progress);
  const h = create(LEVELS[9]), original = snapshot(h.board); h.reshuffle();
  for (let i = 0; i < h.board.length; i++) if (original[i].cover || !active(original[i])) assert.deepEqual(h.board[i], original[i]);
});
test('再配置が失敗し続けても虹を付与して救済', () => {
  const g = create(); g.board = board(); g.rng = () => 0;
  // 通常の再配置で救済されるケースと、虹フォールバック自体を狭い領域で検証。
  g.board.forEach((c, i) => { if (i > 1) { c.block = true; c.fruit = null; } });
  assert.equal(g.reshuffle().assisted, true); assert.equal(g.board[0].special, 'rainbow'); assert.ok(validMoves(g.board).length);
});
test('手の解決後に手詰まりを検知してシャッフルイベントを返す', () => {
  const g = create(); g.board = board();
  g.board.forEach((c, i) => { if (i > 1) { c.block = true; c.fruit = null; } else c.special = 'cross'; });
  const result = g.play(0, 1);
  assert.equal(result.events.at(-1).type, 'shuffle');
  assert.equal(result.events.at(-1).assisted, true);
  assert.ok(validMoves(g.board).length);
});
test('全目標を満たしたときのみクリア', () => {
  const g = create(LEVELS[9]);
  for (const goal of g.level.goals) g.progress[goal.key] = goal.count;
  assert.equal(g.complete(), true); g.progress.box--; assert.equal(g.complete(), false);
});
test('20レベル×3シードを合法手のみで実際にクリアできる', () => {
  for (const level of LEVELS) for (let seed = 1; seed <= 3; seed++) {
    const rng = seeded(seed * 71), g = create(level, seed); let turns = 0;
    while (!g.complete() && turns++ < 1000) {
      const moves = validMoves(g.board); assert.ok(moves.length, `Lv${level.id} 手詰まり`);
      const result = g.play(...moves[Math.floor(rng() * moves.length)]);
      assert.equal(result.valid, true); assert.equal(findMatches(g.board).length, 0);
      assert.ok(g.board.every(c => !active(c) ? c.fruit === null : occupied(c)));
      assert.equal(new Set(g.board.map(c => c.id)).size, g.board.length);
    }
    assert.ok(g.complete(), `Lv${level.id}, seed ${seed}: ${JSON.stringify(g.progress)}`);
  }
});
test('保存の型・範囲・未知バージョンを検証', () => {
  assert.deepEqual(cleanSave(null, 10), { version: 2, highest: 1, cleared: [], stock: { delivery: 1, line: 1, rainbow: 0 }, stageUses: {}, settings: { sound: false, reduced: false } });
  const data = cleanSave({ version: 1, highest: 999, cleared: [1, 1, 4, '3', -1, 11], settings: { sound: 'false', reduced: true } }, 10);
  assert.equal(data.highest, 10); assert.deepEqual(data.cleared, [1, 4]); assert.equal(data.settings.sound, false);
  assert.equal(cleanSave({ version: 50, highest: 9 }, 10).highest, 1);
});
