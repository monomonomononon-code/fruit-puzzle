// 描画・時刻・localStorage に依存しないゲームルール。
export const SIZE = 8;
export const COUNT = SIZE * SIZE;
export const row = i => Math.floor(i / SIZE);
export const col = i => i % SIZE;
export const adjacent = (a, b) => Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1;
export function neighbors(i) {
  return [i - SIZE, i + SIZE, i - 1, i + 1].filter(j => j >= 0 && j < COUNT && adjacent(i, j));
}
export const movable = cell => !!cell && !cell.block && !cell.cover && cell.fruit !== null;
const matchable = cell => movable(cell) && cell.special !== 'rainbow';
export const snapshot = board => board.map(cell => ({ ...cell }));
export function seeded(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function findMatches(board) {
  const runs = [];
  for (const step of [1, SIZE]) {
    for (let start = 0; start < COUNT; start++) {
      if (!matchable(board[start])) continue;
      const prev = start - step;
      if (prev >= 0 && (step === SIZE || row(prev) === row(start)) && matchable(board[prev]) && board[prev].fruit === board[start].fruit) continue;
      const run = [];
      for (let j = start; j < COUNT && (step === SIZE || row(j) === row(start)) && matchable(board[j]) && board[j].fruit === board[start].fruit; j += step) run.push(j);
      if (run.length >= 3) runs.push(new Set(run));
    }
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
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= COUNT || b >= COUNT || !adjacent(a, b) || !movable(board[a]) || !movable(board[b])) return false;
  if ((board[a].special && board[b].special) || board[a].special === 'rainbow' || board[b].special === 'rainbow') return true;
  [board[a], board[b]] = [board[b], board[a]];
  const result = findMatches(board).some(g => g.includes(a) || g.includes(b));
  [board[a], board[b]] = [board[b], board[a]];
  return result;
}
export function validMoves(board) {
  const moves = [];
  for (let i = 0; i < COUNT; i++) for (const j of [i + 1, i + SIZE]) if (j < COUNT && adjacent(i, j) && canSwap(board, i, j)) moves.push([i, j]);
  return moves;
}

export class Game {
  constructor(level, rng = Math.random) {
    this.level = level; this.rng = rng; this.uid = 0;
    this.progress = Object.fromEntries(['ice', 'box', ...Array.from({ length: 6 }, (_, i) => `fruit${i}`)].map(k => [k, 0]));
    this.board = Array.from({ length: COUNT }, (_, i) => ({
      id: ++this.uid, fruit: level.blocks.includes(i) ? null : this.randomFruit(),
      special: null, block: level.blocks.includes(i), cover: level.ice.includes(i) ? 1 : level.boxes.includes(i) ? 2 : 0,
      coverType: level.ice.includes(i) ? 'ice' : level.boxes.includes(i) ? 'box' : null,
    }));
    this.reshuffle();
  }
  randomFruit() { return Math.min(5, Math.floor(this.rng() * 6)); }
  complete() { return this.level.goals.every(g => this.progress[g.key] >= g.count); }
  // 上から構成して即時マッチを防ぐ。障害物・既存特殊の位置は保持。
  reshuffle() {
    for (let attempt = 0; attempt < 60; attempt++) {
      for (let i = 0; i < COUNT; i++) {
        const cell = this.board[i];
        if (!movable(cell) || cell.special === 'rainbow') continue;
        const forbidden = new Set();
        for (const step of [1, SIZE]) {
          if (i >= 2 * step && (step === SIZE || col(i) >= 2)) {
            const a = this.board[i - step], b = this.board[i - 2 * step];
            if (matchable(a) && matchable(b) && a.fruit === b.fruit) forbidden.add(a.fruit);
          }
        }
        const options = [0, 1, 2, 3, 4, 5].filter(f => !forbidden.has(f));
        cell.fruit = options[Math.min(options.length - 1, Math.floor(this.rng() * options.length))];
      }
      if (validMoves(this.board).length) return { assisted: false };
    }
    const i = this.board.findIndex((c, index) => movable(c) && neighbors(index).some(j => movable(this.board[j])));
    if (i < 0) throw new Error('このレベルには交換できる隣接セルがありません');
    this.board[i].special = 'rainbow';
    return { assisted: true };
  }
  ensurePlayable() { return validMoves(this.board).length ? null : this.reshuffle(); }
  line(i, vertical = false) { return Array.from({ length: SIZE }, (_, n) => vertical ? n * SIZE + col(i) : row(i) * SIZE + n); }
  square(i, radius) { return Array.from({ length: COUNT }, (_, j) => j).filter(j => Math.abs(row(i) - row(j)) <= radius && Math.abs(col(i) - col(j)) <= radius); }
  effect(i, special, target = this.board[i].fruit) {
    if (special === 'cross') return [i, ...neighbors(i)];
    if (special === 'horizontal') return this.line(i);
    if (special === 'vertical') return this.line(i, true);
    if (special === 'rainbow') return this.board.flatMap((c, j) => c.fruit === target ? [j] : []);
    return [];
  }
  combo(a, b) {
    const x = this.board[a], y = this.board[b], types = [x.special, y.special];
    const lineType = s => s === 'horizontal' || s === 'vertical';
    let targets = [a, b], name;
    if (types.every(s => s === 'rainbow')) { targets = Array.from({ length: COUNT }, (_, i) => i); name = 'RAINBOW FESTIVAL'; }
    else if (types.includes('rainbow')) {
      const other = x.special === 'rainbow' ? y : x;
      const seeds = this.board.flatMap((c, i) => c.fruit === other.fruit ? [i] : []);
      targets.push(...seeds.flatMap(i => lineType(other.special) ? [...this.line(i), ...this.line(i, true)] : this.square(i, 1)));
      name = lineType(other.special) ? 'RAINBOW LINES' : 'RAINBOW BLOOM';
    } else if (types.every(s => s === 'cross')) { targets.push(...this.square(b, 2)); name = 'DOUBLE BLOOM'; }
    else if (types.some(s => s === 'cross')) {
      targets.push(...Array.from({ length: COUNT }, (_, i) => i).filter(i => Math.abs(row(i) - row(b)) <= 1 || Math.abs(col(i) - col(b)) <= 1)); name = 'CROSS PARADE';
    } else { targets.push(...this.line(a), ...this.line(a, true), ...this.line(b), ...this.line(b, true)); name = 'LINE PARTY'; }
    return { targets, name };
  }
  // 消去の1波を解決。before/after は演出用の読み取りスナップショット。
  wave(groups = [], preferred = [], forced = [], consumed = [], label = '') {
    const before = snapshot(this.board), targets = new Set(forced), created = new Map();
    for (const group of groups) {
      group.forEach(i => targets.add(i));
      if (group.length >= 4 && !group.some(i => this.board[i].special)) {
        const at = preferred.find(i => group.includes(i)) ?? group[0];
        const height = Math.max(...group.map(row)) - Math.min(...group.map(row));
        const width = Math.max(...group.map(col)) - Math.min(...group.map(col));
        created.set(at, group.length >= 6 ? 'rainbow' : group.length === 5 ? (height > width ? 'vertical' : 'horizontal') : 'cross');
      }
    }
    const activated = new Set(consumed);
    for (const i of targets) {
      const cell = this.board[i];
      if (movable(cell) && cell.special && !activated.has(i) && !created.has(i)) {
        activated.add(i);
        for (const j of this.effect(i, cell.special)) targets.add(j);
      }
    }
    const removed = [], damaged = new Set();
    for (const i of targets) {
      const cell = this.board[i];
      if (cell.block) continue;
      if (cell.cover) { damaged.add(i); continue; }
      if (cell.fruit === null || created.has(i)) continue;
      removed.push(i);
      this.progress[`fruit${cell.fruit}`]++;
      for (const j of neighbors(i)) if (this.board[j].cover) damaged.add(j);
    }
    for (const i of removed) { this.board[i].fruit = null; this.board[i].special = null; }
    for (const i of damaged) {
      const cell = this.board[i];
      if (--cell.cover === 0) { this.progress[cell.coverType]++; cell.coverType = null; }
    }
    for (const [i, special] of created) this.board[i].special = special;
    return { type: 'clear', before, board: snapshot(this.board), removed, damaged: [...damaged], created: [...created.keys()], activated: [...activated], targets: [...targets], label, progress: { ...this.progress } };
  }
  gravity() {
    const before = snapshot(this.board), moves = [];
    for (let c = 0; c < SIZE; c++) {
      let segment = [];
      const fill = () => {
        const pieces = segment.filter(i => this.board[i].fruit !== null).map(i => ({ from: i, cell: this.board[i] }));
        let incoming = 0;
        for (let n = segment.length - 1; n >= 0; n--) {
          const to = segment[n], piece = pieces.pop();
          if (piece) { this.board[to] = piece.cell; if (piece.from !== to) moves.push({ from: piece.from, to, id: piece.cell.id }); }
          else {
            this.board[to] = { id: ++this.uid, fruit: this.randomFruit(), special: null, cover: 0, coverType: null, block: false };
            moves.push({ from: segment[0] - SIZE * ++incoming, to, id: this.board[to].id, fresh: true });
          }
        }
        segment = [];
      };
      for (let r = 0; r < SIZE; r++) {
        const i = r * SIZE + c;
        if (this.board[i].block || this.board[i].cover) fill(); else segment.push(i);
      }
      fill();
    }
    return { type: 'fall', before, board: snapshot(this.board), moves };
  }
  play(a, b) {
    if (!canSwap(this.board, a, b)) return { valid: false, events: [], chain: 0 };
    const before = snapshot(this.board);
    [this.board[a], this.board[b]] = [this.board[b], this.board[a]];
    const events = [{ type: 'swap', before, board: snapshot(this.board), a, b }];
    let first;
    if (this.board[a].special && this.board[b].special) {
      const combo = this.combo(a, b); first = this.wave([], [], combo.targets, [a, b], combo.name);
    } else if (this.board[a].special === 'rainbow' || this.board[b].special === 'rainbow') {
      const rainbow = this.board[a].special === 'rainbow' ? a : b, other = rainbow === a ? b : a;
      first = this.wave([], [], [rainbow, other, ...this.effect(rainbow, 'rainbow', this.board[other].fruit)], [rainbow], 'COLOR HARVEST');
    } else first = this.wave(findMatches(this.board), [b, a]);
    let chain = 1;
    events.push({ ...first, chain }, this.gravity());
    let groups;
    while ((groups = findMatches(this.board)).length && chain < 60) {
      events.push({ ...this.wave(groups), chain: ++chain }, this.gravity());
    }
    if (groups.length || !validMoves(this.board).length) {
      const result = this.reshuffle(); events.push({ type: 'shuffle', board: snapshot(this.board), ...result });
    }
    return { valid: true, events, chain, complete: this.complete() };
  }
}
