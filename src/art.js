// 自作ベクター素材。すべて同梱し、外部画像を読み込まない。
const drawings = [
  '<path d="M31 17c-8-8-24-3-24 12 0 15 10 27 19 25 4-2 7-2 11 0 10 1 20-13 20-27 0-13-16-18-25-10Z" fill="#ef6261"/><path d="M34 18c-1-8 2-13 5-16" fill="none" stroke="#765245" stroke-width="4" stroke-linecap="round"/><path d="M35 10C44-1 53 5 50 9c-5 7-12 5-15 1" fill="#538d51"/><path d="M17 25c-3 3-4 7-3 10" stroke="#ffb1a2" stroke-width="5" fill="none" stroke-linecap="round"/>',
  '<circle cx="32" cy="35" r="24" fill="#f6a246"/><path d="M33 12c1-5 5-9 9-10" stroke="#765245" stroke-width="3" fill="none"/><path d="M33 11C18 13 16 1 21 2c10-1 14 5 12 9" fill="#639959"/><path d="M16 29c1-5 4-8 8-10" stroke="#ffcf81" stroke-width="5" fill="none" stroke-linecap="round"/><g fill="#d98231"><circle cx="44" cy="43" r="1.4"/><circle cx="49" cy="36" r="1.4"/><circle cx="39" cy="48" r="1.4"/></g>',
  '<path d="M8 36C0 26 19 7 33 12c12-1 22 10 22 16 13 12-8 26-20 25C22 58 7 48 8 36" fill="#efd34a"/><path d="M33 11C40 0 49 2 53 6c-2 8-12 10-20 5" fill="#71a45c"/><path d="M14 31c2-6 7-10 13-11" stroke="#fff2a4" stroke-width="5" fill="none" stroke-linecap="round"/>',
  '<path d="M32 17V6" stroke="#765245" stroke-width="4" stroke-linecap="round"/><path d="M33 9C39-2 52 3 50 7c-3 7-11 7-17 2" fill="#6c9b57"/><g fill="#9b70bb" stroke="#815ca2" stroke-width="1.2"><circle cx="23" cy="22" r="10"/><circle cx="40" cy="23" r="10"/><circle cx="16" cy="36" r="10"/><circle cx="32" cy="37" r="11"/><circle cx="48" cy="36" r="10"/><circle cx="25" cy="49" r="9"/><circle cx="40" cy="49" r="9"/><circle cx="32" cy="56" r="7"/></g><g fill="#c6a6df"><ellipse cx="21" cy="18" rx="4" ry="2.5"/><ellipse cx="30" cy="33" rx="4" ry="2.5"/><ellipse cx="14" cy="32" rx="3" ry="2"/></g>',
  '<path d="M9 25c2-17 45-17 47 0 3 12-17 34-24 34S5 37 9 25" fill="#e9757f"/><path d="m32 17-13 3 3-8-8-5 13 2 5-8 5 8 13-2-8 6 3 8Z" fill="#588d56"/><g fill="#fff0c4"><ellipse cx="20" cy="28" rx="1.6" ry="2.3"/><ellipse cx="32" cy="28" rx="1.6" ry="2.3"/><ellipse cx="44" cy="28" rx="1.6" ry="2.3"/><ellipse cx="26" cy="39" rx="1.6" ry="2.3"/><ellipse cx="38" cy="39" rx="1.6" ry="2.3"/><ellipse cx="32" cy="49" rx="1.6" ry="2.3"/></g>',
  '<circle cx="32" cy="33" r="26" fill="#a88b58"/><circle cx="32" cy="33" r="22" fill="#a3c65a"/><circle cx="32" cy="33" r="8" fill="#eef0b7"/><g stroke="#677b38" stroke-width="2.5" stroke-linecap="round"><path d="m32 17 0 3m0 26v3m16-16h-3m-26 0h-3m27-11-2 2M23 42l-2 2m22 0-2-2M23 24l-2-2m18-4-1 3m-12 24-1 3m21-9-3-1m-24-12 3 1m24 0-3 1m-24 12 3-1m16 8-1-3m-10-22-1-3"/></g>',
];
export function fruitSVG(id) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true" class="fruit-art">${drawings[id] ?? ''}</svg>`;
}
export const icons = {
  leaf: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 5C11 3 5 10 8 20c10 7 19-1 17-15Z" fill="currentColor"/><path d="M6 28 21 11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="15" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/></svg>',
};
