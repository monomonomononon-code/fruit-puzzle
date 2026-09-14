import { Game, movable, adjacent, validMoves, row, col, snapshot } from './engine.js';
import { LEVELS, FRUITS } from './levels.js';
import { fruitSVG, icons } from './art.js';
import { SAVE_KEY, cleanSave } from './storage.js';

const $ = id => document.getElementById(id);
let saved;
function storageWarning() { $('save-warning').hidden = false; $('save-warning').textContent = 'このブラウザでは保存できません。ゲームは引き続き遊べます。'; }
try { saved = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY)), LEVELS.length); } catch { saved = cleanSave(null, LEVELS.length); storageWarning(); }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch { storageWarning(); } }
let game, busy = false, selected = null, visibleBoard, visibleProgress, audioContext;
const reduced = () => saved.settings.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
const symbols = { cross: '＋', horizontal: '↔', vertical: '↕', rainbow: '✦' };
const specialNames = { cross: '十字', horizontal: '横ライン', vertical: '縦ライン', rainbow: '虹' };
const controls = ['hint', 'reset', 'levels', 'settings', 'help'];
const cells = Array.from({ length: 64 }, (_, i) => {
  const button = document.createElement('button'); button.className = 'cell'; button.dataset.index = i;
  button.addEventListener('click', () => choose(i));
  $('board').append(button); return button;
});
$('brand-icon').innerHTML = icons.leaf; $('grid-icon').innerHTML = icons.grid; $('settings').innerHTML = icons.settings;

function render(board = game.board) {
  visibleBoard = snapshot(board);
  cells.forEach((button, i) => {
    const c = board[i];
    button.className = `cell${c.block ? ' blocked' : ''}${c.cover ? ` covered ${c.coverType}` : ''}${c.coverType === 'box' && c.cover === 1 ? ' dented' : ''}${c.special ? ` special-${c.special}` : ''}${selected === i ? ' selected' : ''}`;
    button.innerHTML = c.block || c.fruit === null ? '' : c.special === 'rainbow' ? '<span class="rainbow-symbol">✦</span>' : fruitSVG(c.fruit);
    if (c.special && c.special !== 'rainbow') button.insertAdjacentHTML('beforeend', `<span class="badge ${c.special}">${symbols[c.special]}</span>`);
    const label = c.block ? '埋まりマス' : `${FRUITS[c.fruit] ?? '空き'}${c.special ? `・${specialNames[c.special]}` : ''}${c.cover ? `・${c.coverType === 'ice' ? '氷' : `箱 残り${c.cover}回`}` : ''}`;
    button.setAttribute('aria-label', `${row(i) + 1}行${col(i) + 1}列 ${label}`);
    button.setAttribute('aria-pressed', String(selected === i));
    button.setAttribute('aria-disabled', String(busy || !movable(c)));
  });
}
function renderGoals(progress = game.progress) {
  visibleProgress = { ...progress };
  $('goals').innerHTML = game.level.goals.map(g => {
    const isFruit = g.key.startsWith('fruit'), id = Number(g.key.slice(5));
    const name = isFruit ? FRUITS[id] : g.key === 'ice' ? '氷をこわす' : '箱をあける';
    const count = Math.min(g.count, progress[g.key]);
    return `<div class="goal ${count >= g.count ? 'done' : ''}"><span class="goal-art">${isFruit ? fruitSVG(id) : g.key === 'ice' ? '❄' : '▣'}</span><div class="goal-detail"><div class="goal-text"><span>${name}</span><strong>${count}<small> / ${g.count}</small></strong></div><div class="progress" role="progressbar" aria-label="${name}" aria-valuemin="0" aria-valuemax="${g.count}" aria-valuenow="${count}"><span style="width:${count / g.count * 100}%"></span></div></div></div>`;
  }).join('');
}
function lock(value) {
  busy = value; controls.forEach(id => $(id).disabled = value);
  $('board').setAttribute('aria-busy', String(value));
  cells.forEach((b, i) => b.setAttribute('aria-disabled', String(value || !movable(visibleBoard[i]))));
}
function start(id) {
  if (busy) return;
  game = new Game(LEVELS[id - 1]); selected = null;
  $('level-tag').textContent = `LEVEL ${String(id).padStart(2, '0')}`;
  $('stage-number').textContent = `${String(id).padStart(2, '0')} / ${LEVELS.length}`;
  $('stage-title').textContent = game.level.name; $('stage-subtitle').textContent = game.level.subtitle;
  $('board-label').textContent = 'のんびり収穫中'; $('chain').textContent = 'READY TO PICK'; $('chain').className = '';
  $('status').textContent = 'となりの果物を入れ替えて、3つそろえよう';
  render(); renderGoals(); lock(false);
}
async function animate(element, frames, duration = 230, options = {}) {
  if (!element || reduced()) return;
  try { await element.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.3,1)', ...options }).finished; } catch { /* キャンセル時も入力ロックを解放できる */ }
}
function tone(chain, special = false) {
  if (!saved.settings.sound) return;
  try {
    audioContext ??= new AudioContext(); void audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(Math.min(1100, 340 + chain * 80), now);
    oscillator.frequency.exponentialRampToValueAtTime(special ? 1250 : 700, now + .15);
    gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + .24);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + .25);
  } catch { /* サウンド非対応でもゲームを継続 */ }
}
function particles(indices, big) {
  if (reduced()) return;
  const base = $('effects').getBoundingClientRect();
  for (const i of indices.slice(0, big ? 36 : 16)) {
    const rect = cells[i].getBoundingClientRect();
    for (let n = 0; n < 3; n++) {
      const el = document.createElement('i'); el.className = 'burst';
      el.style.left = `${rect.left - base.left + rect.width / 2}px`; el.style.top = `${rect.top - base.top + rect.height / 2}px`;
      el.style.background = ['#e6ae68', '#95b379', '#d99599', '#b19dcc'][i % 4];
      $('effects').append(el);
      void animate(el, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${(n - 1) * 35}px,${-35 - (i % 3) * 12}px) rotate(${i * 15}deg) scale(.2)`, opacity: 0 }], 420).then(() => el.remove());
    }
  }
}
async function swapVisual(a, b, reverse = false) {
  const x = cells[a].getBoundingClientRect(), y = cells[b].getBoundingClientRect();
  const dx = y.left - x.left, dy = y.top - x.top;
  const frames = (tx, ty) => reverse ? [{ transform: 'translate(0,0)' }, { transform: `translate(${tx}px,${ty}px)` }, { transform: 'translate(0,0)' }] : [{ transform: 'translate(0,0)' }, { transform: `translate(${tx}px,${ty}px)` }];
  await Promise.all([animate(cells[a], frames(dx, dy), reverse ? 320 : 170), animate(cells[b], frames(-dx, -dy), reverse ? 320 : 170)]);
}
async function showEvent(event) {
  if (event.type === 'swap') { await swapVisual(event.a, event.b); render(event.board); }
  if (event.type === 'clear') {
    $('chain').className = 'active'; $('chain').textContent = `${event.chain} CHAIN${event.chain > 1 ? ' · いい感じ！' : ''}`;
    const big = event.removed.length >= 18 || !!event.label;
    const festival = event.label === 'RAINBOW FESTIVAL';
    if (event.label) $('status').textContent = event.label === 'RAINBOW FESTIVAL' ? '虹 × 虹！ 盤面いっぱいの大収穫！' : '特殊アイテムが発動！';
    tone(event.chain, big); particles(event.removed, big);
    const animations = event.removed.map(i => animate(cells[i], [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.16)', opacity: 1, offset: .25 }, { transform: 'scale(.15)', opacity: 0 }], big ? 330 : 230));
    for (const i of event.damaged) animations.push(animate(cells[i], [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)', background: '#c3e7e8' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], 280));
    if (big && !reduced()) {
      $('celebration').textContent = festival ? 'Rainbow\nFestival!' : event.label ? event.label.replaceAll(' ', '\n') : 'Sweet harvest!';
      animations.push(animate($('celebration'), [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)', offset: .25 }, { opacity: 0, transform: 'scale(1.1)' }], festival ? 900 : 600));
      const ring = document.createElement('div'); ring.className = 'ring';
      if (festival) ring.style.borderColor = '#c1a4d6';
      $('effects').append(ring);
      animations.push(animate(ring, [{ transform: 'scale(.2)', opacity: .9 }, { transform: 'scale(2)', opacity: 0 }], festival ? 900 : 500).then(() => ring.remove()));
    }
    await Promise.all(animations); $('celebration').textContent = '';
    render(event.board); renderGoals(event.progress);
    await Promise.all(event.created.map(i => animate(cells[i], [{ transform: 'scale(.4)' }, { transform: 'scale(1.18)', offset: .65 }, { transform: 'scale(1)' }], 300)));
  }
  if (event.type === 'fall') {
    render(event.board);
    const stride = cells[8].getBoundingClientRect().top - cells[0].getBoundingClientRect().top;
    await Promise.all(event.moves.map(m => animate(cells[m.to], [
      { transform: `translateY(${m.fresh ? 0 : (row(m.from) - row(m.to)) * stride}px) scale(${m.fresh ? .6 : 1})`, opacity: m.fresh ? 0 : 1 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], 260 + Math.min(150, (row(m.to) - row(m.from)) * 25))));
  }
  if (event.type === 'shuffle') {
    $('status').textContent = event.assisted ? '手詰まりを解消。虹のアイテムをプレゼント！' : '手詰まりを解消するため、果物をシャッフルしました';
    await animate($('board'), [{ opacity: 1 }, { opacity: .15 }], 180); render(event.board);
    await animate($('board'), [{ opacity: .15 }, { opacity: 1 }], 220);
  }
}
async function attempt(a, b) {
  if (busy || $('modal').open) return;
  lock(true); selected = null; render();
  try {
    const result = game.play(a, b);
    if (!result.valid) { await swapVisual(a, b, true); $('status').textContent = '3つ以上そろう場所を探してみよう'; return; }
    for (const event of result.events) await showEvent(event);
    if (result.complete) {
      saved.cleared = [...new Set([...saved.cleared, game.level.id])];
      saved.highest = Math.max(saved.highest, Math.min(LEVELS.length, game.level.id + 1)); save();
      $('board-label').textContent = '収穫できました！'; showClear(result.chain);
    } else if (!result.events.some(e => e.type === 'shuffle')) $('status').textContent = result.chain > 1 ? `${result.chain}連鎖！ 気持ちいい収穫でした` : 'いい収穫！ 次はどこをそろえよう？';
  } catch (error) { console.error(error); $('status').textContent = '処理を中断しました。「やり直す」で再開できます'; }
  finally { render(); renderGoals(); lock(false); }
}
function choose(i) {
  if (busy || $('modal').open || game.complete()) return;
  if (!movable(game.board[i])) { $('status').textContent = game.board[i].block ? 'このマスは動かせません' : 'となりの果物を消すと、障害物をこわせます'; return; }
  if (selected === i) { selected = null; render(); return; }
  if (selected !== null && adjacent(selected, i)) { void attempt(selected, i); return; }
  selected = i; render();
}
let drag = null, suppressClick = false;
$('board').addEventListener('pointerdown', event => {
  const cell = event.target.closest('.cell');
  if (!cell || busy || $('modal').open || game.complete() || !movable(game.board[Number(cell.dataset.index)])) return;
  drag = { i: Number(cell.dataset.index), x: event.clientX, y: event.clientY, pointer: event.pointerId };
  cell.setPointerCapture(event.pointerId);
});
$('board').addEventListener('pointerup', event => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const { i, x, y } = drag; drag = null;
  const dx = event.clientX - x, dy = event.clientY - y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const j = i + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * 8);
  if (j >= 0 && j < 64 && adjacent(i, j) && movable(game.board[j])) void attempt(i, j);
});
$('board').addEventListener('pointercancel', () => { drag = null; });
$('board').addEventListener('click', event => { if (suppressClick) { event.stopImmediatePropagation(); event.preventDefault(); suppressClick = false; } }, true);
$('board').addEventListener('keydown', event => {
  const cell = event.target.closest('.cell'); if (!cell) return;
  if (event.key === 'Escape') { selected = null; render(); return; }
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[event.key];
  if (!delta) return; event.preventDefault();
  const i = Number(cell.dataset.index), j = i + delta;
  if (j >= 0 && j < 64 && adjacent(i, j)) cells[j].focus();
});

function openModal(html) { $('modal-content').innerHTML = html; if (!$('modal').open) $('modal').showModal(); }
function closeModal() { $('modal').close(); }
$('close-modal').onclick = closeModal;
$('modal').addEventListener('close', () => { if (game.complete()) $('status').innerHTML = '収穫完了！ <button id="continue-clear" class="small-button">次のレベルへ →</button>'; const button = $('continue-clear'); if (button) button.onclick = () => showClear(1); });
function heading(label, title, copy = '') { return `<p class="modal-eyebrow">${label}</p><h2 id="modal-title" class="modal-title">${title}</h2>${copy ? `<p class="modal-copy">${copy}</p>` : ''}`; }
function showLevels() {
  if (busy) return;
  openModal(heading('YOUR LITTLE ORCHARD', 'レベルを選ぶ', `クリア ${saved.cleared.length} / ${LEVELS.length} · ひとつずつ、新しい果樹園へ。`) + `<div class="level-grid">${LEVELS.map(l => `<button class="level-choice ${l.id === game.level.id ? 'current' : ''} ${saved.cleared.includes(l.id) ? 'cleared' : ''}" data-level="${l.id}" ${l.id > saved.highest ? 'disabled' : ''} aria-label="レベル${l.id} ${l.name}${l.id > saved.highest ? ' 未開放' : ''}">${l.id}<small>${saved.cleared.includes(l.id) ? '✓' : l.id > saved.highest ? '未開放' : 'PLAY'}</small></button>`).join('')}</div><p class="modal-copy">1〜3 果物 / 4〜5 氷 / 6〜7 箱 / 8〜9 石畳 / 10 祝祭</p>`);
  document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { closeModal(); start(Number(b.dataset.level)); });
}
$('levels').onclick = showLevels;
$('settings').onclick = () => {
  openModal(heading('MAKE YOURSELF COMFORTABLE', 'あなた好みのひと息') + `<label class="setting-row">効果音 <input id="sound-setting" type="checkbox" ${saved.settings.sound ? 'checked' : ''}></label><label class="setting-row">動きを減らす <input id="motion-setting" type="checkbox" ${saved.settings.reduced ? 'checked' : ''}></label><p class="modal-copy">進行状況はこのブラウザに自動保存します。プレイ中の盤面は、再読み込みすると最初からになります。</p><button id="delete-save" class="text-button danger">すべてのセーブデータをリセット</button>`);
  $('sound-setting').onchange = e => { saved.settings.sound = e.target.checked; save(); tone(1); };
  $('motion-setting').onchange = e => { saved.settings.reduced = e.target.checked; document.body.classList.toggle('reduced', saved.settings.reduced); save(); };
  $('delete-save').onclick = () => confirmModal('セーブをリセットしますか？', 'クリア済みレベルと設定を消去し、レベル1から始めます。', () => { saved = cleanSave(null, LEVELS.length); save(); document.body.classList.remove('reduced'); start(1); });
};
function confirmModal(title, copy, action) {
  openModal(heading('A FRESH START', title, copy) + '<div class="modal-actions"><button id="confirm-action" class="primary">リセットする</button><button id="cancel-action" class="secondary">戻る</button></div>');
  $('confirm-action').onclick = () => { closeModal(); action(); }; $('cancel-action').onclick = closeModal;
}
$('reset').onclick = () => confirmModal('この収穫をやり直しますか？', '今の盤面と収穫数をリセットします。クリア済みの記録は残ります。', () => start(game.level.id));
$('hint').onclick = () => {
  if (busy || game.complete()) return;
  selected = null; render(); const move = validMoves(game.board)[0];
  if (move) { move.forEach(i => cells[i].classList.add('hinted')); $('status').textContent = '点線の2つを入れ替えてみよう'; }
};
$('help').onclick = () => openModal(heading('HOW TO PICK', 'ちいさな遊び方') + `<ol class="help-list"><li>となり同士をタップして交換。スワイプでも遊べます。</li><li>同じ果物が縦か横に3つ以上そろうと収穫。そろわない交換は元に戻ります。</li><li>4つで十字、5つでライン、6つ以上で虹。T字・L字も数えます。</li><li>十字・ラインはマッチや他の特殊で発動。虹は果物と交換して同じ種類を全収穫。</li><li>今回の収穫をすべて達成するとクリア！</li></ol><table class="help-table"><tr><td>＋ × ＋</td><td>5×5に広がる大収穫</td></tr><tr><td>＋ × ↔</td><td>3行＋3列の大きな十字</td></tr><tr><td>↔ × ↕</td><td>双方の位置の縦横ライン</td></tr><tr><td>↔ × ✦</td><td>同じ色の果物から縦横ライン</td></tr><tr><td>✦ × ✦</td><td>盤面全体を収穫！</td></tr><tr><td>＋ × ✦</td><td>同じ色の果物から3×3</td></tr></table><p class="modal-copy">氷はとなりを1回、箱は2回消すと開きます。特殊の直撃も有効ですが、1回の消去で与えるダメージは1段階。中身は開いてから収穫できます。石畳は動かせません。</p><p class="modal-copy">手詰まりは自動でシャッフル。矢印キーで移動、Enter / Spaceで選択できます。時間・手数の制限はありません。</p>`);
function showClear(chain) {
  const last = game.level.id === LEVELS.length;
  openModal(`<div class="clear-content"><div class="clear-art">✦</div>${heading('A LOVELY HARVEST', last ? '10の果樹園に、実りを。' : 'いい収穫でした！', last ? '全10レベルの最後のステージをクリア。好きな果樹園で、またひと息。' : `レベル ${game.level.id}「${game.level.name}」クリア。<br>次の果樹園があなたを待っています。`)}<div class="modal-actions"><button id="next-level" class="primary">${last ? 'レベルを選ぶ' : '次のレベルへ →'}</button><button id="play-again" class="secondary">もう一度</button></div></div>`);
  $('next-level').onclick = () => { if (last) showLevels(); else { closeModal(); start(game.level.id + 1); } };
  $('play-again').onclick = () => { closeModal(); start(game.level.id); };
}
document.body.classList.toggle('reduced', saved.settings.reduced);
start(saved.highest);
// QA専用。通常URLにはテスト操作を公開しない。
if (new URLSearchParams(location.search).has('test')) {
  window.__gameTest = {
    get game() { return game; }, get busy() { return busy; }, get saved() { return saved; },
    start, attempt, validMoves: () => validMoves(game.board),
    inject(board, progress) { if (busy) throw new Error('busy'); game.board = snapshot(board); if (progress) game.progress = { ...progress }; render(); renderGoals(); },
    state: () => ({ board: snapshot(game.board), progress: { ...game.progress }, visibleBoard, visibleProgress }),
  };
}
