import { movable, validMoves, snapshot } from './engine.js';
import { openEdge } from './topology.js';
import { STOCK_CAPS, STOCK_TOTAL, STAGE_USES } from './storage.js';
export const STOCK_TYPES = { delivery: 'cross', line: 'horizontal', rainbow: 'rainbow' };
export const stockTotal = save => Object.values(save.stock).reduce((a, b) => a + b, 0);
export function stockPairs(game) {
  const normal = i => movable(game.board[i]) && !game.board[i].special;
  return game.board.flatMap((_, i) => normal(i) ? [i+1, i+game.width].filter(j => normal(j) && openEdge(game.board, i, j)).flatMap(j => [[i,j],[j,i]]) : []);
}
export function stockUsable(game, save) {
  return !game.complete() && stockTotal(save) > 0 && (save.stageUses[game.level.id] ?? 0) < STAGE_USES && stockPairs(game).length > 0;
}
export function settleRescue(game, save, result) {
  if (result.valid && !game.complete() && !validMoves(game.board).length) {
    if (stockUsable(game, save)) result.waitingForStock = true;
    else result.events.push({ type: 'shuffle', ...game.reshuffle(), board: snapshot(game.board) });
  }
  return result;
}
export function playMove(game, save, a, b) {
  return settleRescue(game, save, game.play(a, b, { noShuffle: true }));
}
export function useStock(game, save, kind, a, b) {
  if (!STOCK_TYPES[kind] || !save.stock[kind] || !stockUsable(game, save) || !stockPairs(game).some(p => p[0] === a && p[1] === b)) return { valid: false, events: [] };
  const before = snapshot(game.board);
  game.board[a] = { ...game.board[a], fruit: null, special: STOCK_TYPES[kind] };
  const placed = snapshot(game.board);
  const result = game.play(a, b, { noShuffle: true });
  if (!result.valid) { game.board = before; return result; }
  save.stock[kind]--; save.stageUses[game.level.id] = (save.stageUses[game.level.id] ?? 0) + 1;
  result.events.unshift({ type: 'stock-place', board: placed });
  return settleRescue(game, save, result);
}
export function collectClear(game, save, maxLevel) {
  if (!game.complete()) return { first: false, collected: 0, overflow: 0 };
  delete save.stageUses[game.level.id];
  if (save.cleared.includes(game.level.id)) return { first: false, collected: 0, overflow: 0 };
  let collected = 0, overflow = 0;
  for (const kind of ['rainbow','line','delivery']) for (const cell of game.board) {
    const type = cell.special === 'cross' ? 'delivery' : ['horizontal','vertical'].includes(cell.special) ? 'line' : cell.special;
    if (type !== kind) continue;
    if (save.stock[kind] < STOCK_CAPS[kind] && stockTotal(save) < STOCK_TOTAL) { save.stock[kind]++; collected++; } else overflow++;
  }
  save.cleared.push(game.level.id);
  save.highest = Math.max(save.highest, Math.min(maxLevel, game.level.id + 1));
  delete save.stageUses[game.level.id];
  return { first: true, collected, overflow };
}
