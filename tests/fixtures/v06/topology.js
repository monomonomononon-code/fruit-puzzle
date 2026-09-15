// 配列に付随する不変の地形。旧8×8のルール用フィクスチャも読み込める。
export const widthOf = board => board?.topology?.width ?? 8;
export const heightOf = board => board?.topology?.height ?? 8;
export const row = (i, board) => Math.floor(i / widthOf(board));
export const col = (i, board) => i % widthOf(board);
export const adjacent = (a, b, board) => Math.abs(row(a, board) - row(b, board)) + Math.abs(col(a, board) - col(b, board)) === 1;
export const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
export const walled = (board, a, b) => board.topology?.walls.has(edgeKey(a, b)) ?? false;
export function neighbors(i, board) {
  const width = widthOf(board), count = board?.length ?? 64;
  return [i - width, i + width, i - 1, i + 1].filter(j => j >= 0 && j < count && adjacent(i, j, board));
}
export function withTopology(board, topology) {
  if (topology) Object.defineProperty(board, 'topology', { value: topology, configurable: true });
  return board;
}
export const active = cell => !!cell && !cell.void && !cell.block;
export const openEdge = (board, a, b) => active(board[a]) && active(board[b]) && adjacent(a, b, board) && !walled(board, a, b);
