import { Game, movable, adjacent, validMoves, row, col, snapshot } from './engine.js';
import { walled, openEdge } from './topology.js';
import { LEVELS, FRUITS } from './levels.js';
import { fruitSVG, icons } from './art.js';
import { playMove, useStock, stockUsable, stockTotal, collectClear } from './stock.js';
import { SAVE_KEY, cleanSave } from './storage.js';

const $ = id => document.getElementById(id);
let saved;
function storageWarning() { $('save-warning').hidden = false; $('save-warning').textContent = 'このブラウザでは保存できません。ゲームは引き続き遊べます。'; }
try { saved = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY)), LEVELS.length); } catch { saved = cleanSave(null, LEVELS.length); storageWarning(); }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch { storageWarning(); } }
let stockKind = null, clearReward = null;
let game, busy = false, selected = null, visibleBoard, visibleProgress, clearSounds, clearSoundIndex = 0;
const reduced = () => saved.settings.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
const symbols = { cross: '➤', horizontal: '✥', vertical: '✥', rainbow: '✦' };
const specialNames = { cross: 'おとどけ', horizontal: 'ライン（交換方向に発動）', vertical: 'ライン（交換方向に発動）', rainbow: '虹' };
const controls = ['hint', 'reset', 'levels', 'settings', 'help', 'stock'];
let cells = [];
function buildBoard() {
  $('board').replaceChildren();
  document.body.style.setProperty('--board-cols', game.width);
  document.body.style.setProperty('--board-rows', game.height);
  document.body.style.setProperty('--board-ratio', game.width / game.height);
  cells = Array.from({length:game.board.length},(_,i)=>{
    const button=document.createElement('button'); button.className='cell'; button.dataset.index=i;
    button.addEventListener('click',()=>choose(i)); $('board').append(button); return button;
  });
  drawWalls();
}
function drawWalls() {
  document.getElementById('walls')?.remove();
  if (!game) return;
  const layer=document.createElement('div');layer.id='walls';layer.setAttribute('aria-hidden','true');
  const base=$('board').getBoundingClientRect();
  for (const [a,b] of game.level.walls ?? []) {
    const x=cells[a].getBoundingClientRect(),y=cells[b].getBoundingClientRect(),wall=document.createElement('i');
    if (row(a,game.board)===row(b,game.board)) {
      wall.style.cssText=`left:${(x.x+y.x+x.width)/2-base.x-2}px;top:${x.y-base.y}px;width:4px;height:${x.height}px`;
    } else {
      wall.style.cssText=`left:${x.x-base.x}px;top:${(x.y+y.y+x.height)/2-base.y-2}px;width:${x.width}px;height:4px`;
    }
    layer.append(wall);
  }
  $('board').append(layer);
}
new ResizeObserver(drawWalls).observe($('board'));
$('brand-icon').innerHTML = icons.leaf; $('grid-icon').innerHTML = icons.grid; $('settings').innerHTML = icons.settings;

function render(board = game.board) {
  visibleBoard = snapshot(board);
  cells.forEach((button, i) => {
    const c = board[i];
    button.className = `cell${c.void ? ' void' : c.block ? ' blocked' : ''}${c.cover ? ` covered ${c.coverType}` : ''}${c.coverType === 'box' && c.cover === 1 ? ' dented' : ''}${c.special ? ` special-${c.special}` : ''}${selected === i ? ' selected' : ''}`;
    button.innerHTML = c.void || c.block ? '' : c.special ? `<span class="item-symbol ${c.special === 'rainbow' ? 'rainbow-symbol' : ''}" aria-hidden="true">${symbols[c.special]}</span>` : c.fruit === null ? '' : fruitSVG(c.fruit);
    button.tabIndex = c.void ? -1 : 0;
    button.setAttribute('aria-hidden', String(!!c.void));
    const walls = ['上','下','左','右'].filter((_,n)=>walled(board,i,[i-game.width,i+game.width,i-1,i+1][n])).join('・');
    const label = c.void ? '盤面の外' : c.block ? '埋まりマス' : `${c.special ? specialNames[c.special] + 'アイテム・隣と交換で発動' : FRUITS[c.fruit] ?? '空き'}${c.cover ? `・${c.coverType === 'ice' ? '氷' : `箱 残り${c.cover}回`}` : ''}`;
    button.setAttribute('aria-label', `${row(i, board) + 1}行${col(i, board) + 1}列 ${label}${walls ? `・壁：${walls}` : ''}`);
    button.setAttribute('aria-pressed', String(selected === i));
    button.setAttribute('aria-disabled', String(busy || !movable(c)));
  });
}
function renderGoals(progress = game.progress) {
  visibleProgress = { ...progress };
  $('stock').textContent = `持ちもの ${stockTotal(saved)}/6`;
  $('stock').title = `このステージ ${saved.stageUses[game.level.id] ?? 0}/3個使用済み`;
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
  game = new Game(LEVELS[id - 1]); selected = null; stockKind = null; clearReward = null; buildBoard();
  $('level-tag').textContent = `LEVEL ${String(id).padStart(2, '0')}`;
  $('stage-number').textContent = `${String(id).padStart(2, '0')} / ${LEVELS.length}`;
  $('stage-title').textContent = game.level.name; $('stage-subtitle').textContent = game.level.subtitle;
  $('shape-label').hidden = !game.level.shape;
  $('shape-label').textContent = game.level.shape ? `${game.level.shape} · ${game.width}×${game.height}` : '';
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
    clearSounds ??= Array.from({ length: 4 }, () => {
      const audio = new Audio(new URL('../assets/audio/fruit-clear.mp3', import.meta.url));
      audio.preload = 'auto';
      return audio;
    });
    const audio = clearSounds[clearSoundIndex++ % clearSounds.length];
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.min(.52, .26 + chain * .025 + (special ? .05 : 0));
    void audio.play().catch(() => { /* ブラウザの自動再生制限時は無音で継続 */ });
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
  if (event.type === 'stock-place') render(event.board);
  if (event.type === 'swap') { await swapVisual(event.a, event.b); render(event.board); }
  if(event.type==='flight-rescue'){render(event.board);$('status').textContent='次につながるラインアイテムが届きました';return;}
  if (event.type === 'clear') {
    for(const flight of event.flights??[]){
      const a=cells[flight.from].getBoundingClientRect(),b=cells[flight.to].getBoundingClientRect(),base=$('effects').getBoundingClientRect();
      const el=document.createElement('span');el.className='flying-pick';el.textContent='➤';el.style.left=(a.x-base.x+a.width/2)+'px';el.style.top=(a.y-base.y+a.height/2)+'px';$('effects').append(el);
      const dx=b.x-a.x,dy=b.y-a.y;
      await animate(el,[{transform:'translate(-50%,-50%) scale(1)'},{transform:`translate(calc(-50% + ${dx*.5}px),calc(-50% + ${dy*.5-45}px)) scale(1.25)`,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.8)`}],520);
      el.remove();
    }
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
    await Promise.all(event.moves.map(m => {
      const end=cells[m.to].getBoundingClientRect();
      const frames=(m.path??[m.from,m.to]).map((i,n)=>{
        const r=cells[i].getBoundingClientRect();
        return {transform:`translate(${r.x-end.x}px,${r.y-end.y}px) scale(${m.fresh&&n===0?.6:1})`,opacity:m.fresh&&n===0?0:1};
      });
      if(frames.length===1)frames.push({transform:'translate(0,0) scale(1)',opacity:1});
      return animate(cells[m.to],frames,260+Math.min(250,frames.length*35));
    }));
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
    const result = stockKind ? useStock(game, saved, stockKind, a, b) : playMove(game, saved, a, b);
    if (!result.valid) { if (stockKind && !result.cancelled) { $('status').textContent='壁のない、隣り合う通常フルーツ2つを選んでください。在庫は減っていません'; return; } if (result.cancelled) { $('status').textContent='連鎖が長く続いたため、交換前に戻しました。もう一度お試しください'; return; } if (!openEdge(game.board,a,b)) { $('status').textContent='壁の向こうへは交換できません'; return; } await swapVisual(a, b, true); $('status').textContent = '3つ以上そろう場所を探してみよう'; return; }
    stockKind = null;
    if (result.complete) clearReward = collectClear(game, saved, LEVELS.length);
    save();
    for (const event of result.events) await showEvent(event);
    if (result.complete) {
      $('board-label').textContent = '収穫できました！'; showClear(result.chain);
    } else if (result.waitingForStock) { $('status').textContent = '今は交換できる手がありません。持ちものを使うか、ヒントからシャッフルを選べます'; } else if (!result.events.some(e => e.type === 'shuffle' || e.type === 'flight-rescue')) $('status').textContent = result.chain > 1 ? `${result.chain}連鎖！ 気持ちいい収穫でした` : 'いい収穫！ 次はどこをそろえよう？';
  } catch (error) { console.error(error); $('status').textContent = '処理を中断しました。「やり直す」で再開できます'; }
  finally { render(); renderGoals(); lock(false); }
}
function choose(i) {
  if (busy || $('modal').open || game.complete()) return;
  if (!movable(game.board[i])) { $('status').textContent = game.board[i].block ? 'このマスは動かせません' : 'となりの果物を消すと、障害物をこわせます'; return; }
  if (selected === i) { selected = null; render(); return; }
  if (selected !== null && adjacent(selected, i, game.board)) { void attempt(selected, i); return; }
  selected = i; render();
  if (stockKind) { $('status').textContent = '隣の通常フルーツを選んで使用を確定（Escで取消）'; return; }
  const type=game.board[i].special;
  if(type) $('status').textContent=type==='rainbow' ? `隣の果物と交換で同じ種類を収穫。特殊との合成は${FRUITS[game.dominantFruit()]}が対象` : type==='cross' ? '隣と交換すると飛んで1つ収穫。目標や次の一手につながる場所を狙います' : '左右に交換で横一列、上下に交換で縦一列を収穫できます';
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
  const j = i + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * game.width);
  if (j >= 0 && j < game.board.length && adjacent(i, j, game.board) && movable(game.board[j])) void attempt(i, j);
});
$('board').addEventListener('pointercancel', () => { drag = null; });
$('board').addEventListener('click', event => { if (suppressClick) { event.stopImmediatePropagation(); event.preventDefault(); suppressClick = false; } }, true);
$('board').addEventListener('keydown', event => {
  const cell = event.target.closest('.cell'); if (!cell) return;
  if (event.key === 'Escape') { stockKind = null; selected = null; render(); return; }
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -game.width, ArrowDown: game.width }[event.key];
  if (!delta) return; event.preventDefault();
  const i = Number(cell.dataset.index), j = i + delta;
  if (j >= 0 && j < game.board.length && adjacent(i, j, game.board) && !game.board[j].void) cells[j].focus();
});

function openModal(html) { $('modal-content').innerHTML = html; if (!$('modal').open) $('modal').showModal(); }
function closeModal() { $('modal').close(); }
$('close-modal').onclick = closeModal;
$('modal').addEventListener('close', () => { if (game.complete()) $('status').innerHTML = '収穫完了！ <button id="continue-clear" class="small-button">次のレベルへ →</button>'; const button = $('continue-clear'); if (button) button.onclick = () => showClear(1); });
function heading(label, title, copy = '') { return `<p class="modal-eyebrow">${label}</p><h2 id="modal-title" class="modal-title">${title}</h2>${copy ? `<p class="modal-copy">${copy}</p>` : ''}`; }
function showLevels() {
  if (busy) return;
  openModal(heading('YOUR LITTLE ORCHARD', 'レベルを選ぶ', `クリア ${saved.cleared.length} / ${LEVELS.length} · ひとつずつ、新しい果樹園へ。`) + `<div class="level-grid">${LEVELS.map(l => `<button class="level-choice ${l.id === game.level.id ? 'current' : ''} ${saved.cleared.includes(l.id) ? 'cleared' : ''}" data-level="${l.id}" ${l.id > saved.highest ? 'disabled' : ''} aria-label="レベル${l.id} ${l.name}${l.id > saved.highest ? ' 未開放' : ''}">${l.id}<small>${saved.cleared.includes(l.id) ? '✓' : l.id > saved.highest ? '未開放' : 'PLAY'}</small></button>`).join('')}</div><p class="modal-copy">1〜10 はじまりの果樹園 / 11〜${LEVELS.length} 石畳の奥庭</p>`);
  document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { closeModal(); start(Number(b.dataset.level)); });
}
$('levels').onclick = showLevels;
$('settings').onclick = () => {
  openModal(heading('MAKE YOURSELF COMFORTABLE', 'あなた好みのひと息') + `<label class="setting-row">効果音 <input id="sound-setting" type="checkbox" ${saved.settings.sound ? 'checked' : ''}></label><label class="setting-row">動きを減らす <input id="motion-setting" type="checkbox" ${saved.settings.reduced ? 'checked' : ''}></label><p class="modal-copy">進行状況はこのブラウザに自動保存します。プレイ中の盤面は、再読み込みすると最初からになります。</p><button id="delete-save" class="text-button danger">すべてのセーブデータをリセット</button>`);
  $('sound-setting').onchange = e => { saved.settings.sound = e.target.checked; save(); tone(1); };
  $('motion-setting').onchange = e => { saved.settings.reduced = e.target.checked; document.body.classList.toggle('reduced', saved.settings.reduced); save(); };
  $('delete-save').onclick = () => confirmModal('セーブをリセットしますか？', 'クリア済みレベル・持ちもの・使用回数・設定を消去し、初期アイテム2個でレベル1から始めます。', () => { saved = cleanSave(null, LEVELS.length); save(); document.body.classList.remove('reduced'); start(1); });
};
function confirmModal(title, copy, action) {
  openModal(heading('A FRESH START', title, copy) + '<div class="modal-actions"><button id="confirm-action" class="primary">リセットする</button><button id="cancel-action" class="secondary">戻る</button></div>');
  $('confirm-action').onclick = () => { closeModal(); action(); }; $('cancel-action').onclick = closeModal;
}
$('reset').onclick = () => confirmModal('この収穫をやり直しますか？', '今の盤面と収穫数をリセットします。クリア済みの記録は残ります。使った持ちものと使用回数は戻りません。', () => start(game.level.id));
$('hint').onclick = () => {
  if (busy || game.complete()) return;
  stockKind = null; selected = null; render(); const move = validMoves(game.board)[0];
  if (!move && stockUsable(game, saved)) { openModal(heading('YOUR CHOICE', '持ちものが使えます', '自分でアイテムを使うか、今回はシャッフルできます。') + '<button id=choose-stock class=primary>持ちものを選ぶ</button> <button id=manual-shuffle class=secondary>シャッフルする</button>'); $('choose-stock').onclick = () => { closeModal(); showStock(); }; $('manual-shuffle').onclick = () => { closeModal(); game.reshuffle(); render(); }; return; }
  if (move) { move.forEach(i => cells[i].classList.add('hinted')); $('status').textContent = '点線の2つを入れ替えてみよう'; }
};
$('help').onclick = () => openModal(heading('HOW TO PICK', 'ちいさな遊び方') + `<ol class="help-list"><li>となり同士をタップして交換。スワイプでも遊べます。</li><li>同じ果物が縦か横に3つ以上そろうと収穫。そろわない交換は元に戻ります。</li><li>2×2の正方形も4マッチ。4つでおとどけ、5つでライン、6つ以上で虹。T字・L字も数えます。</li><li>おとどけは飛んで果物1つを収穫。通常は未達成の目標を優先し、通常手がないときは次の手を作る場所を探します。1個の消去では続行できない場合はラインが届きます。特殊は果物ではなく、通常マッチには参加しません。隣の果物と交換するだけで発動。ラインは左右交換で横、上下交換で縦。虹は相手の種類を全収穫。</li><li>今回の収穫をすべて達成するとクリア！</li></ol><table class="help-table"><tr><td>➤ × ➤</td><td>5×5に広がる大収穫</td></tr><tr><td>➤ × ↔</td><td>3行＋3列の大きな十字</td></tr><tr><td>↔ × ↕</td><td>双方の位置の縦横ライン</td></tr><tr><td>↔ × ✦</td><td>最多の果物から縦横ライン</td></tr><tr><td>✦ × ✦</td><td>盤面全体を収穫！</td></tr><tr><td>➤ × ✦</td><td>最多の果物から3×3</td></tr></table><p class="modal-copy">氷はとなりを1回、箱は2回消すと開きます。特殊の直撃も有効ですが、1回の消去で与えるダメージは1段階。中身は開いてから収穫できます。石畳は動かせません。空白は盤面の外です。壁を越えた交換・通常マッチはできません。真下が塞がると、空いた左側→下、右側→下の順で回り込みます。特殊の効果は壁の向こうにも届きます。</p><p class="modal-copy">特殊に巻き込まれたアイテムも発動します。虹との合成や巻き込み発動は盤面に最も多い果物を対象にします（同数なら果物一覧順）。盤面に有効手がなくても、使える持ちものがあれば待機します。「持ちもの」で種類を選び、通常フルーツ同士を交換して使用。合計6個、1ステージ3個まで。初回クリア時だけ残った特殊を回収します。持ちものも使えない場合は自動シャッフル。「ヒント」から手動シャッフルも選べます。矢印キーで移動、Enter / Spaceで選択できます。時間・手数の制限はありません。</p>`);
function showStock() {
  if (busy || game.complete()) return;
  stockKind = null; selected = null; render();
  openModal(heading('YOUR HARVEST BASKET', '持ちもの', '合計6個まで。このステージはあと' + Math.max(0,3-(saved.stageUses[game.level.id]??0)) + '個使えます。選んだ後、通常フルーツ→隣の通常フルーツの順にタップ。確定前は消費しません。') + ['delivery','line','rainbow'].map((kind,i)=>'<button class="secondary stock-choice" data-stock="'+kind+'" '+(!saved.stock[kind]||!stockUsable(game,saved)?'disabled':'')+'>'+['➤ おとどけ','✥ ライン','✦ 虹'][i]+' × '+saved.stock[kind]+'</button>').join('') + '<p class=modal-copy>初回クリア時だけ残った特殊を回収。やり直しても使用回数・消費は戻りません。</p>');
  document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=()=>{stockKind=b.dataset.stock;closeModal();$('status').textContent='置く通常フルーツを選んでから、隣へ交換してください。取消は持ちものボタン';});
}
$('stock').onclick = showStock;
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && stockKind && !busy) {
    stockKind = null; selected = null; render();
    $('status').textContent = '持ちものの使用を取り消しました';
  }
});
function showClear(chain) {
  const last = game.level.id === LEVELS.length;
  openModal(`<div class="clear-content"><div class="clear-art">✦</div>${heading('A LOVELY HARVEST', last ? `${LEVELS.length}の果樹園に、実りを。` : 'いい収穫でした！', last ? `全${LEVELS.length}レベルの最後のステージをクリア。好きな果樹園で、またひと息。` : `レベル ${game.level.id}「${game.level.name}」クリア。<br>次の果樹園があなたを待っています。`)}<p class="modal-copy">${clearReward?.first ? `持ちものを${clearReward.collected}個回収しました。${clearReward.overflow ? `上限を超えた${clearReward.overflow}個は持ち越せません。` : ''}` : '回収は初回クリア時のみです。'}</p><div class="modal-actions"><button id="next-level" class="primary">${last ? 'レベルを選ぶ' : '次のレベルへ →'}</button><button id="play-again" class="secondary">もう一度</button></div></div>`);
  $('next-level').onclick = () => { if (last) showLevels(); else { closeModal(); start(game.level.id + 1); } };
  $('play-again').onclick = () => { closeModal(); start(game.level.id); };
}
document.body.classList.toggle('reduced', saved.settings.reduced);
save(); // 初期配布・旧セーブ移行を一度だけ確定
start(saved.highest);
// QA専用。通常URLにはテスト操作を公開しない。
if (new URLSearchParams(location.search).has('test')) {
  window.__gameTest = {
    get game() { return game; }, get busy() { return busy; }, get saved() { return saved; },
    start, attempt, chooseStock: kind => { stockKind = kind; }, stockUsable: () => stockUsable(game,saved), validMoves: () => validMoves(game.board),
    inject(board, progress) { if (busy) throw new Error('busy'); game.board = snapshot(board); if (progress) game.progress = { ...progress }; render(); renderGoals(); },
    state: () => ({ board: snapshot(game.board), progress: { ...game.progress }, visibleBoard, visibleProgress }),
  };
}
