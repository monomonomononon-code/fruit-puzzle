export const SAVE_KEY = 'fruitful-save-v1';
export function cleanSave(raw, maxLevel) {
  const valid = raw && raw.version === 1 ? raw : {};
  const cleared = [...new Set((Array.isArray(valid.cleared) ? valid.cleared : []).filter(n => Number.isInteger(n) && n >= 1 && n <= maxLevel))].sort((a, b) => a - b);
  const highest = Math.min(maxLevel, Math.max(1, Number.isInteger(valid.highest) ? valid.highest : 1, ...cleared.map(n => n + 1)));
  return { version: 1, highest, cleared, settings: { sound: valid.settings?.sound === true, reduced: valid.settings?.reduced === true } };
}
