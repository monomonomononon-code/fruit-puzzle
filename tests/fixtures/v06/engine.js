// 描画・時刻・localStorage に依存しないゲームルール。
// 寸法は board.topology に保持。既存テスト配列だけ8×8として互換読み込みする。
import { row, col, adjacent, neighbors, widthOf, heightOf, withTopology, edgeKey, openEdge, active } from './topology.js';
export { row, col, adjacent, neighbors } from './topology.js';
export const occupied = cell => !!cell && (cell.fruit !== null || !!cell.special);
export const movable = cell => active(cell) && !cell.cover && occupied(cell);
const matchable = cell => movable(cell) && !cell.special;
export const snapshot = board => withTopology(board.map(cell => ({ ...cell })), board.topology);
export function seeded(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function findMatches(board) {
  const runs = [], SIZE = widthOf(board), COUNT = board.length;
  for (const step of [1, SIZE]) {
    for (let start = 0; start < COUNT; start++) {
      if (!matchable(board[start])) continue;
      const prev = start - step;
      if (prev >= 0 && (step === SIZE || row(prev, board) === row(start, board)) && openEdge(board, prev, start) && matchable(board[prev]) && board[prev].fruit === board[start].fruit) continue;
      const run = [];
      for (let j = start; j < COUNT && (step === SIZE || row(j, board) === row(start, board)) && (j === start || openEdge(board, j - step, j)) && matchable(board[j]) && board[j].fruit === board[start].fruit; j += step) run.push(j);
      if (run.length >= 3) runs.push(new Set(run));
    }
  }
  for (let i = 0; i < COUNT; i++) {
    const square = [i, i + 1, i + SIZE, i + SIZE + 1];
    if (col(i, board) + 1 < SIZE && row(i, board) + 1 < heightOf(board) && square.every(j => matchable(board[j]) && board[j].fruit === board[i].fruit) && [[i,i+1],[i,i+SIZE],[i+1,i+SIZE+1],[i+SIZE,i+SIZE+1]].every(([a,b]) => openEdge(board,a,b))) runs.push(new Set(square));
  }
  // 交差する線を推移的に結合。離れた同色マッチは結合しない。
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length;) {
      if ([...runs[j]].some(k => runs[i].has(k))) {
        for (const k of runs[j]) runs[i].add(k);
        runs.splice(j, 1); j = i + 1;
      } else j++;
    }
  }
  return runs.map(s => [...s].sort((a, b) => a - b));
}

export function canSwap(board, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= board.length || b >= board.length || !openEdge(board, a, b) || !movable(board[a]) || !movable(board[b])) return false;
  if (board[a].special || board[b].special) return true;
  [board[a], board[b]] = [board[b], board[a]];
  const result = findMatches(board).some(g => g.includes(a) || g.includes(b));
  [board[a], board[b]] = [board[b], board[a]];
  return result;
}
export function validMoves(board) {
  const moves = [], SIZE = widthOf(board), COUNT = board.length;
  for (let i = 0; i < COUNT; i++) for (const j of [i + 1, i + SIZE]) if (j < COUNT && adjacent(i, j, board) && canSwap(board, i, j)) moves.push([i, j]);
  return moves;
}

export class Game {
  constructor(level, rng = Math.random) {
    this.level = level; this.rng = rng; this.uid = 0;
    this.progress = Object.fromEntries(['ice', 'box', ...Array.from({ length: 6 }, (_, i) => `fruit${i}`)].map(k => [k, 0]));
    const width = level.width ?? 8, height = level.height ?? 8;
    this.board = withTopology(Array.from({ length: width * height }, (_, i) => ({
      id: ++this.uid, fruit: (level.voids ?? []).includes(i) || level.blocks.includes(i) ? null : this.randomFruit(),
      special: null, void: (level.voids ?? []).includes(i), block: level.blocks.includes(i), cover: level.ice.includes(i) ? 1 : level.boxes.includes(i) ? 2 : 0,
      coverType: level.ice.includes(i) ? 'ice' : level.boxes.includes(i) ? 'box' : null,
    })), { width, height, walls: new Set((level.walls ?? []).map(([a,b]) => edgeKey(a,b))) });
    this.reshuffle();
  }
  get width() { return widthOf(this.board); }
  get height() { return heightOf(this.board); }
  randomFruit() { return Math.min(5, Math.floor(this.rng() * 6)); }
  complete() { return this.level.goals.every(g => this.progress[g.key] >= g.count); }
  // 上から構成して即時マッチを防ぐ。障害物・既存特殊の位置は保持。
  reshuffle() {
    const SIZE = this.width, COUNT = this.board.length;
    for (let attempt = 0; attempt < 60; attempt++) {
      for (let i = 0; i < COUNT; i++) {
        const cell = this.board[i];
        if (!matchable(cell)) continue;
        const forbidden = new Set();
        for (const step of [1, SIZE]) {
          if (i >= 2 * step && (step === SIZE || col(i, this.board) >= 2)) {
            const a = this.board[i - step], b = this.board[i - 2 * step];
            if (openEdge(this.board,i,i-step) && openEdge(this.board,i-step,i-2*step) && matchable(a) && matchable(b) && a.fruit === b.fruit) forbidden.add(a.fruit);
          }
        }
        if (row(i, this.board) > 0 && col(i, this.board) > 0) {
          const a=i-SIZE-1, b=i-SIZE, c=i-1;
          if ([a,b,c].every(j=>matchable(this.board[j]) && this.board[j].fruit===this.board[a].fruit) && [[a,b],[a,c],[b,i],[c,i]].every(([x,y])=>openEdge(this.board,x,y))) forbidden.add(this.board[a].fruit);
        }
        const options = [0, 1, 2, 3, 4, 5].filter(f => !forbidden.has(f));
        cell.fruit = options[Math.min(options.length - 1, Math.floor(this.rng() * options.length))];
      }
      if (validMoves(this.board).length) return { assisted: false };
    }
    const i = this.board.findIndex((c, index) => movable(c) && neighbors(index, this.board).some(j => openEdge(this.board,index,j) && movable(this.board[j])));
    if (i < 0) throw new Error('このレベルには交換できる隣接セルがありません');
    this.board[i].special = 'rainbow'; this.board[i].fruit = null;
    return { assisted: true };
  }
  ensurePlayable() { return validMoves(this.board).length ? null : this.reshuffle(); }
  line(i, vertical = false) { return Array.from({ length: vertical ? this.height : this.width }, (_, n) => vertical ? n * this.width + col(i, this.board) : row(i, this.board) * this.width + n); }
  square(i, radius) { return Array.from({ length: this.board.length }, (_, j) => j).filter(j => Math.abs(row(i, this.board) - row(j, this.board)) <= radius && Math.abs(col(i, this.board) - col(j, this.board)) <= radius); }
  // 色を持たない虹が他の特殊に巻き込まれた場合も、再現可能な対象を選ぶ。
  dominantFruit() {
    const counts = Array(6).fill(0);
    for (const c of this.board) if (active(c) && !c.special && Number.isInteger(c.fruit)) counts[c.fruit]++;
    return counts.indexOf(Math.max(...counts));
  }
  flightTarget(excluded = new Set()) {
    const candidates = this.board.flatMap((c,i)=>matchable(c)&&!excluded.has(i)?[i]:[]);
    const goals = candidates.filter(i=>this.level.goals.some(g=>g.key==='fruit'+this.board[i].fruit&&this.progress[g.key]<g.count));
    const pool=goals.length?goals:candidates;
    return pool.length?pool[Math.min(pool.length-1,Math.floor(this.rng()*pool.length))]:null;
  }
  // 試算した乱数系列と盤面をそのまま採用し、演出後に結果が変わることを防ぐ。
  planFlight(a,b) {
    const after=snapshot(this.board);[after[a],after[b]]=[after[b],after[a]];
    const targets=after.flatMap((c,i)=>matchable(c)?[i]:[]);
    const normalMoves=board=>validMoves(board).filter(([x,y])=>!board[x].special&&!board[y].special);
    const stuck=!normalMoves(this.board).length;
    const seed=Math.floor(this.rng()*4294967296);
    const order=seeded(seed);
    for(let i=targets.length-1;i>0;i--){const j=Math.floor(order()*(i+1));[targets[i],targets[j]]=[targets[j],targets[i]];}
    if(!stuck)targets.sort((x,y)=>Number(this.level.goals.some(g=>g.key==='fruit'+after[y].fruit&&this.progress[g.key]<g.count))-Number(this.level.goals.some(g=>g.key==='fruit'+after[x].fruit&&this.progress[g.key]<g.count)));
    let fallback;
    for(let pass=0;pass<(stuck?12:1);pass++)for(const target of targets){
      const trial=Object.create(Game.prototype);
      Object.assign(trial,{level:this.level,board:snapshot(this.board),progress:{...this.progress},uid:this.uid,rng:seeded(seed+pass*7919)});
      const result=trial.play(a,b,{flightTarget:target,planned:true,noShuffle:true});
      if(!result.valid)continue;
      fallback??={trial,result};
      if(trial.complete()||normalMoves(trial.board).length||(!stuck&&validMoves(trial.board).length)){Object.assign(this,{board:trial.board,progress:trial.progress,uid:trial.uid,rng:trial.rng});return result;}
    }
    if(fallback){
      const {trial,result}=fallback;
      // 一果物の消去では通常手を作れない地形でも、シャッフルせず次の発動手を残す。
      if(!validMoves(trial.board).length){
        const pair=trial.board.flatMap((c,i)=>movable(c)?neighbors(i,trial.board).filter(j=>openEdge(trial.board,i,j)&&movable(trial.board[j])).map(j=>[i,j]):[])[0];
        if(pair){trial.board[pair[0]].fruit=null;trial.board[pair[0]].special='horizontal';result.events.push({type:'flight-rescue',board:snapshot(trial.board),at:pair[0]});}
      }
      Object.assign(this,{board:trial.board,progress:trial.progress,uid:trial.uid,rng:trial.rng});return result;
    }
    return {valid:false,events:[],chain:0,cancelled:'no-flight-target'};
  }
  effect(i, special, target = this.dominantFruit()) {
    if (special === 'cross') { const to=this.flightTarget(); return to===null?[i]:[i,to]; }
    if (special === 'horizontal') return this.line(i);
    if (special === 'vertical') return this.line(i, true);
    if (special === 'rainbow') return this.board.flatMap((c, j) => !c.special && c.fruit === target ? [j] : []);
    return [];
  }
  combo(a, b) {
    const x = this.board[a], y = this.board[b], types = [x.special, y.special];
    const lineType = s => s === 'horizontal' || s === 'vertical';
    let targets = [a, b], name;
    if (types.every(s => s === 'rainbow')) { targets = Array.from({ length: this.board.length }, (_, i) => i); name = 'RAINBOW FESTIVAL'; }
    else if (types.includes('rainbow')) {
      const other = x.special === 'rainbow' ? y : x;
      const target = this.dominantFruit();
      const seeds = this.board.flatMap((c, i) => !c.special && c.fruit === target ? [i] : []);
      targets.push(...seeds.flatMap(i => lineType(other.special) ? [...this.line(i), ...this.line(i, true)] : this.square(i, 1)));
      name = lineType(other.special) ? 'RAINBOW LINES' : 'RAINBOW BLOOM';
    } else if (types.every(s => s === 'cross')) { targets.push(...this.square(b, 2)); name = 'DOUBLE BLOOM'; }
    else if (types.some(s => s === 'cross')) {
      targets.push(...Array.from({ length: this.board.length }, (_, i) => i).filter(i => Math.abs(row(i, this.board) - row(b, this.board)) <= 1 || Math.abs(col(i, this.board) - col(b, this.board)) <= 1)); name = 'CROSS PARADE';
    } else { targets.push(...this.line(a), ...this.line(a, true), ...this.line(b), ...this.line(b, true)); name = 'LINE PARTY'; }
    return { targets, name };
  }
  // 消去の1波を解決。before/after は演出用の読み取りスナップショット。
  wave(groups = [], preferred = [], forced = [], consumed = [], label = '') {
    const before = snapshot(this.board), targets = new Set(forced), created = new Map(), flights = [];
    for (const group of groups) {
      group.forEach(i => targets.add(i));
      if (group.length >= 4 && !group.some(i => this.board[i].special)) {
        const at = preferred.find(i => group.includes(i)) ?? group[0];
        const height = Math.max(...group.map(i => row(i, this.board))) - Math.min(...group.map(i => row(i, this.board)));
        const width = Math.max(...group.map(i => col(i, this.board))) - Math.min(...group.map(i => col(i, this.board)));
        created.set(at, group.length >= 6 ? 'rainbow' : group.length === 5 ? (height > width ? 'vertical' : 'horizontal') : (height === 1 && width === 1 ? this.level.squareSpecial ?? 'cross' : 'cross'));
      }
    }
    const activated = new Set(consumed);
    for (const i of targets) {
      const cell = this.board[i];
      if (movable(cell) && cell.special && !activated.has(i) && !created.has(i)) {
        activated.add(i);
        if(cell.special==='cross'){const to=this.flightTarget(targets);if(to!==null){targets.add(to);flights.push({from:i,to});}}
        else for (const j of this.effect(i, cell.special)) targets.add(j);
      }
    }
    const removed = [], damaged = new Set();
    for (const i of targets) {
      const cell = this.board[i];
      if (!active(cell)) continue;
      if (cell.cover) { damaged.add(i); continue; }
      if (!occupied(cell) || created.has(i)) continue;
      removed.push(i);
      if (!cell.special && Number.isInteger(cell.fruit)) this.progress[`fruit${cell.fruit}`]++;
      if(!(label==='FLYING PICK'&&consumed.includes(i))) for (const j of neighbors(i, this.board)) if (openEdge(this.board,i,j) && this.board[j].cover) damaged.add(j);
    }
    for (const i of removed) { this.board[i].fruit = null; this.board[i].special = null; }
    for (const i of damaged) {
      const cell = this.board[i];
      if (--cell.cover === 0) { this.progress[cell.coverType]++; cell.coverType = null; }
    }
    for (const [i, special] of created) { this.board[i].special = special; this.board[i].fruit = null; }
    return { type: 'clear', flights, before, board: snapshot(this.board), removed, damaged: [...damaged], created: [...created.keys()], activated: [...activated], targets: [...targets], label, progress: { ...this.progress } };
  }
  gravity() {
    this.uid = Math.max(this.uid, ...this.board.map(c => c.id));
    const before = snapshot(this.board), paths = new Map();
    const empty = i => active(this.board[i]) && !this.board[i].cover && !occupied(this.board[i]);
    // 同じ行の通路で、上から供給できる列までの距離を測る。
    // 空洞の下では距離が小さい側から大きい側へ流す。逆流・往復は起こさない。
    const flowDistance = Array(this.board.length).fill(Infinity);
    const passable = i => active(this.board[i]) && !this.board[i].cover;
    for (let r = 0; r < this.height; r++) {
      let segment = [];
      const measure = () => {
        const sources = segment.filter(i => r === 0 || (passable(i-this.width) && openEdge(this.board,i-this.width,i)));
        for (const i of segment) flowDistance[i] = sources.length ? Math.min(...sources.map(j => Math.abs(i-j))) : 0;
        segment = [];
      };
      for (let c = 0; c < this.width; c++) {
        const i = r*this.width+c;
        if (!passable(i)) { measure(); continue; }
        if (segment.length && !openEdge(this.board,i-1,i)) measure();
        segment.push(i);
      }
      measure();
    }
    const move = (from, to, via = []) => {
      const piece = this.board[from], hole = this.board[to];
      [this.board[from], this.board[to]] = [hole, piece];
      let record = paths.get(piece.id);
      if (!record) { record = { from, to, id: piece.id, path: [from] }; paths.set(piece.id, record); }
      record.path.push(...via, to); record.to = to;
    };
    const settle = () => {
      while (true) {
        let moved = false;
        for (let i = this.board.length - this.width - 1; i >= 0; i--) {
          if (movable(this.board[i]) && empty(i + this.width) && openEdge(this.board, i, i + this.width)) { move(i,i+this.width); moved = true; }
        }
        if (moved) continue;
        // 下の行から、同じ行では左から。真下が通常果物なら横滑りしない。
        for (let r = this.height - 2; r >= 0; r--) for (let c = 0; c < this.width; c++) {
          const i=r*this.width+c, down=i+this.width;
          if (!movable(this.board[i]) || (openEdge(this.board,i,down) && !this.board[down].cover)) continue;
          for (const dc of [-1,1]) {
            const side=i+dc, to=side+this.width;
            if (empty(side) && empty(to) && openEdge(this.board,i,side) && openEdge(this.board,side,to)) { move(i,to,[side]); moved=true; break; }
          }
        }
        if (moved) continue;
        // 真下・回り込みで埋まらない穴を左右から埋める。近い供給列を優先、同距離なら左。
        for (let r = this.height-1; r >= 0; r--) for (let c = 0; c < this.width; c++) {
          const to = r*this.width+c;
          if (!empty(to)) continue;
          const candidates = [to-1,to+1].filter(from => row(from,this.board) === r && openEdge(this.board,from,to) && movable(this.board[from]) && flowDistance[from] < flowDistance[to]);
          candidates.sort((a,b) => flowDistance[a]-flowDistance[b] || a-b);
          if (candidates.length) { move(candidates[0],to); moved = true; }
        }
        if (!moved) break;
      }
    };
    settle();
    // 各分断区間の空き上端に局所補充。空き数は1回につき必ず1減る。
    for (let i; (i=this.board.findIndex((_,j)=>empty(j))) >= 0;) {
      const piece={ id:++this.uid, fruit:this.randomFruit(), special:null, cover:0, coverType:null, block:false, void:false };
      this.board[i]=piece;
      paths.set(piece.id,{from:i,to:i,id:piece.id,fresh:true,path:[i]});
      settle();
    }
    return { type:'fall', before, board:snapshot(this.board), moves:[...paths.values()] };
  }
  play(a, b, options = {}) {
    if (!canSwap(this.board, a, b)) return { valid: false, events: [], chain: 0 };
    if(!options.planned&&((this.board[a].special==='cross'&&!this.board[b].special)||(this.board[b].special==='cross'&&!this.board[a].special)))return this.planFlight(a,b);
    const before = snapshot(this.board), progressBefore = { ...this.progress }, uidBefore = this.uid;
    [this.board[a], this.board[b]] = [this.board[b], this.board[a]];
    const events = [{ type: 'swap', before, board: snapshot(this.board), a, b }];
    let first;
    if (this.board[a].special && this.board[b].special) {
      const combo = this.combo(a, b); first = this.wave([], [], combo.targets, [a, b], combo.name);
    } else if (this.board[a].special || this.board[b].special) {
      const item = this.board[a].special ? a : b, other = item === a ? b : a;
      let type = this.board[item].special;
      // ラインは生成時の向きより、今回のスワップ方向を優先。
      if (type === 'horizontal' || type === 'vertical') {
        type = row(a, this.board) === row(b, this.board) ? 'horizontal' : 'vertical';
        this.board[item].special = type;
      }
      const targets = type==='cross'?[item,options.flightTarget]:[item, ...this.effect(item, type, this.board[other].fruit)];
      if (type === 'rainbow') targets.push(other);
      first = this.wave([], [], targets, [item], type === 'rainbow' ? 'COLOR HARVEST' : type === 'cross' ? 'FLYING PICK' : 'LINE HARVEST');
      if(type==='cross')first.flights=[{from:item,to:options.flightTarget}];
    } else first = this.wave(findMatches(this.board), [b, a]);
    let chain = 1;
    events.push({ ...first, chain }, this.gravity());
    let groups;
    while ((groups = findMatches(this.board)).length && chain < 60) {
      events.push({ ...this.wave(groups), chain: ++chain }, this.gravity());
    }
    // 異常に長い連鎖は元の手へ戻す。発動手が残る盤面を勝手にシャッフルしない。
    if (groups.length) {
      this.board = before; this.progress = progressBefore; this.uid = uidBefore;
      return { valid: false, events: [], chain: 0, cancelled: 'cascade-limit' };
    }
    if (!options.noShuffle && !validMoves(this.board).length) {
      const result = this.reshuffle(); events.push({ type: 'shuffle', board: snapshot(this.board), ...result });
    }
    return { valid: true, events, chain, complete: this.complete() };
  }
}
