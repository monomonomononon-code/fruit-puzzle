// 文字マップ → 既存エンジン用の座標配列。移動・乱数・描画には依存しない。
import { withTopology, edgeKey, openEdge, neighbors } from './topology.js';
const geometry = level => withTopology(Array.from({length: (level.width??8)*(level.height??8)}, (_,i)=>({block:level.blocks.includes(i),void:(level.voids??[]).includes(i)})), {width:level.width??8,height:level.height??8,walls:new Set((level.walls??[]).map(([a,b])=>edgeKey(a,b)))});
export function matchableGeometry(open, board = geometry({blocks:[]})) {
  const cells = new Set(), width = board.topology.width;
  for (const i of open) for (const step of [1, width]) {
    const line = [i, i + step, i + 2 * step];
    if (line.every(j => open.has(j)) && openEdge(board,line[0],line[1]) && openEdge(board,line[1],line[2])) line.forEach(j => cells.add(j));
  }
  for (const i of open) {
    const w=board.topology.width, square=[i,i+1,i+w,i+w+1];
    if (square.every(j=>open.has(j)) && [[i,i+1],[i,i+w],[i+1,i+w+1],[i+w,i+w+1]].every(([a,b])=>openEdge(board,a,b))) square.forEach(j=>cells.add(j));
  }
  return cells;
}
export function componentsOf(open, board = geometry({blocks:[]})) {
  const remaining = new Set(open), components = [];
  while (remaining.size) {
    const component = [remaining.values().next().value]; remaining.delete(component[0]);
    for (const i of component) for (const j of neighbors(i, board).filter(j=>openEdge(board,i,j))) if (remaining.delete(j)) component.push(j);
    components.push(component);
  }
  return components;
}
export function validateLayout(level) {
  const fail = text => { throw new Error(`Lv${level.id}: ${text}`); };
  const width=level.width??8,height=level.height??8,count=width*height;
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>11||height>9) fail('最大11×9の範囲外');
  const board=geometry(level);
  const wallKeys=new Set();
  for (const pair of level.walls??[]) {
    if (!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isInteger)) fail('不正な壁');
    const [a,b]=pair, key=edgeKey(a,b);
    if (!neighbors(a,board).includes(b)||!board[a]||!board[b]||board[a].void||board[b].void||board[a].block||board[b].block||wallKeys.has(key)) fail('壁が重複または無効な辺');
    wallKeys.add(key);
  }
  const obstacles = [...level.blocks, ...level.ice, ...level.boxes, ...(level.voids??[])];
  if (obstacles.some(i => !Number.isInteger(i) || i < 0 || i >= count) || new Set(obstacles).size !== obstacles.length) fail('障害物が重複または範囲外');
  if (!level.goals.length || new Set(level.goals.map(g => g.key)).size !== level.goals.length) fail('目標が空または重複');
  for (const g of level.goals) {
    if (!/^(fruit[0-5]|ice|box)$/.test(g.key) || !Number.isInteger(g.count) || g.count < 1) fail('不正な目標');
    if ((g.key === 'ice' && g.count > level.ice.length) || (g.key === 'box' && g.count > level.boxes.length)) fail('障害物の目標が配置数を超える');
  }
  const playable = new Set(Array.from({ length: count }, (_, i) => i).filter(i => !level.blocks.includes(i) && !(level.voids??[]).includes(i)));
  if (!playable.size) fail('プレイできるマスがない');
  const allMatchable = matchableGeometry(playable, board);
  if ([...playable].some(i => !allMatchable.has(i))) fail('通常マッチに参加できない孤立セル');
  const locked = new Set([...level.ice, ...level.boxes]);
  const open = new Set([...playable].filter(i => !locked.has(i)));
  const components = componentsOf(playable, board);
  // 各分離領域に2×3または3×2の通常果物領域を残す（交換・マッチの足場）。
  for (const component of components) {
    const hasRoom = component.some(i => [[2, 3], [3, 2]].some(([height, width]) => {
      if (Math.floor(i / board.topology.width) + height > board.topology.height || i % board.topology.width + width > board.topology.width) return false;
      return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => i + r * board.topology.width + c)).flat().every(j => open.has(j) && (j % board.topology.width === i % board.topology.width || openEdge(board,j-1,j)) && (Math.floor(j/board.topology.width) === Math.floor(i/board.topology.width) || openEdge(board,j-board.topology.width,j)));
    }));
    if (!hasRoom) fail('分離領域に交換の足場がない');
  }
  const openingLayers = [];
  while (locked.size) {
    const candidates = matchableGeometry(open, board);
    const layer = [...locked].filter(i => neighbors(i, board).filter(j=>openEdge(board,i,j)).some(j => candidates.has(j)));
    if (!layer.length) fail('隣接消去で順に開けない障害物');
    openingLayers.push(layer);
    layer.forEach(i => { locked.delete(i); open.add(i); });
  }
  return { cells: playable.size, blocks: level.blocks.length, components: components.length, openingLayers };
}
export function mappedStage(id, name, subtitle, shape, goals, layout, walls = []) {
  const width=layout[0]?.length, height=layout.length;
  if (!width||width>11||!height||height>9||layout.some(line=>line.length!==width||!/^[._#ib]+$/.test(line))) throw new Error('マップは最大11列×9行（. _ # i b）、行幅は統一');
  const symbols=layout.join(''), indices=char=>[...symbols].flatMap((cell,i)=>cell===char?[i]:[]);
  const level={id,name,subtitle,shape,goals,width,height,ice:indices('i'),boxes:indices('b'),blocks:indices('#'),voids:indices('_'),walls,layout};
  validateLayout(level); return level;
}
