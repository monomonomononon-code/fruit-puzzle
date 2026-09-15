export const SAVE_KEY = 'fruitful-save-v1';
export const STOCK_CAPS = { delivery: 3, line: 2, rainbow: 1 };
export const STOCK_TOTAL = 6;
export const STAGE_USES = 3;
export function cleanSave(raw, maxLevel) {
  const valid = raw && [1, 2].includes(raw.version) ? raw : {};
  const cleared = [...new Set((Array.isArray(valid.cleared) ? valid.cleared : []).filter(n => Number.isInteger(n) && n >= 1 && n <= maxLevel))].sort((a, b) => a - b);
  const highest = Math.min(maxLevel, Math.max(1, Number.isInteger(valid.highest) ? valid.highest : 1, ...cleared.map(n => n + 1)));
  const bounded = (n, cap) => Number.isInteger(n) ? Math.max(0, Math.min(cap, n)) : 0;
  const stock = valid.version === 2 ? Object.fromEntries(Object.entries(STOCK_CAPS).map(([k, cap]) => [k, bounded(valid.stock?.[k], cap)])) : { delivery: 1, line: 1, rainbow: 0 };
  const stageUses = {};
  for (let id = 1; id <= maxLevel; id++) if (valid.version === 2 && valid.stageUses?.[id]) stageUses[id] = bounded(valid.stageUses[id], STAGE_USES);
  return { version: 2, highest, cleared, stock, stageUses, settings: { sound: valid.settings?.sound === true, reduced: valid.settings?.reduced === true } };
}
