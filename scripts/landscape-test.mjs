import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
await mkdir('test-results/landscape', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [], errors = [];
const check = name => { report.push(name); console.log(`PASS ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('fruitful-save-v1')) localStorage.setItem('fruitful-save-v1', JSON.stringify({ version: 1, highest: 10, cleared: Array.from({ length: 10 }, (_, i) => i + 1), settings: { reduced: true, sound: false } }));
  });
  await page.goto('http://localhost:4173/?test=1');
  await page.waitForFunction(() => !!window.__gameTest);
  assert.equal(await page.evaluate(() => window.__gameTest.game.level.id), 11);
  assert.equal(await page.evaluate(() => window.__gameTest.saved.cleared.length), 10);
  check('旧10レベルクリア済みセーブからLv11へ継続');

  for (const [width, height] of [[844, 390], [667, 375], [568, 320], [932, 430], [740, 300]]) {
    await page.setViewportSize({ width, height });
    for (const level of [1, 10, 12, 17, 20]) {
      await page.evaluate(id => window.__gameTest.start(id), level);
      const bounds = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { board: rect('.board-shell'), left: rect('.stage-panel'), top: rect('.topbar'), toolbar: rect('.board-toolbar'), footer: rect('.board-footer'), overflow: document.documentElement.scrollWidth > innerWidth, viewport: { width: innerWidth, height: innerHeight } };
      });
      assert.equal(bounds.overflow, false, `${width} overflow`);
      for (const name of ['board', 'left', 'top', 'toolbar', 'footer']) {
        const r = bounds[name];
        assert.ok(r.x >= 0 && r.y >= 0 && r.right <= width + 1 && r.bottom <= height + 1, `${width}×${height} Lv${level} ${name}: ${JSON.stringify(r)}`);
      }
      assert.ok(bounds.left.right <= bounds.board.x, '左目標と盤面が重なる');
      assert.ok(bounds.board.right <= bounds.top.x, '右操作と盤面が重なる');
      assert.ok(bounds.top.bottom <= bounds.toolbar.y, 'ヘッダーと連鎖表示が重なる');
      assert.ok(bounds.toolbar.bottom <= bounds.footer.y, '連鎖と操作が重なる');
      assert.ok(bounds.board.width >= Math.min(760, width - 308, (height - 40) * 1.1), '盤面が小さすぎる');
      if (width === 844 || (width === 568 && level === 20)) await page.screenshot({ path: `test-results/landscape/${width}x${height}-lv${level}.png` });
    }
  }
  check('横向き5サイズ×5レベル：全盤面が収まり、目標・操作・連鎖が重ならない');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.__gameTest.start(12));
  const move = await page.evaluate(() => window.__gameTest.validMoves()[0]);
  const a = await page.locator('.cell').nth(move[0]).boundingBox(), b = await page.locator('.cell').nth(move[1]).boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !window.__gameTest.busy && Object.values(window.__gameTest.game.progress).some(n => n > 0));
  check('分断ステージで横向きタッチスワイプ成功');
  const stateBefore = await page.evaluate(() => JSON.stringify(window.__gameTest.state()));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gameTest.state())), stateBefore);
  assert.ok(await page.locator('.orientation-tip').isVisible());
  await page.screenshot({ path: 'test-results/landscape/portrait.png', fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gameTest.state())), stateBefore);
  check('縦横回転で盤面・進捗を維持');
  await page.locator('#levels').click();
  assert.equal(await page.locator('.level-choice').count(), 20);
  assert.ok(await page.locator('[data-level="12"]').isDisabled());
  await page.screenshot({ path: 'test-results/landscape/level-select.png' });
  await page.locator('#close-modal').click();
  await page.locator('#settings').click(); assert.ok(await page.locator('#motion-setting').isVisible());
  await page.locator('#close-modal').click();
  await page.locator('#help').click(); assert.ok(await page.locator('#modal-title').isVisible());
  await page.locator('#close-modal').click();
  check('横向きレベル選択20件・ロック・設定・ヘルプ');

  // 第10面をクリアし、旧最終画面ではなく第11面へ進む。
  for (const id of [10, 20]) {
    await page.evaluate(id => {
      const t = window.__gameTest; t.start(id); const s = t.state();
      t.game.level.goals.forEach(g => { s.progress[g.key] = g.count; });
      s.progress.fruit0--;
      const pair = id === 10 ? [2, 3] : [0, 1];
      pair.forEach(i => { s.board[i].special = 'rainbow'; s.board[i].fruit = 0; });
      t.inject(s.board, s.progress);
    }, id);
    for (const i of id === 10 ? [2, 3] : [0, 1]) await page.locator('.cell').nth(i).click();
    await page.waitForFunction(() => !window.__gameTest.busy);
    if (id === 10) {
      assert.equal(await page.locator('#next-level').textContent(), '次のレベルへ →');
      await page.locator('#next-level').click();
      assert.equal(await page.evaluate(() => window.__gameTest.game.level.id), 11);
    } else {
      assert.match(await page.locator('#modal-title').textContent(), /20/);
      assert.equal(await page.locator('#next-level').textContent(), 'レベルを選ぶ');
      await page.screenshot({ path: 'test-results/landscape/clear20.png' });
      await page.locator('#close-modal').click();
    }
  }
  check('Lv10→11の継続・Lv20の最終クリア表示');
  await page.reload(); await page.waitForFunction(() => !!window.__gameTest);
  assert.equal(await page.evaluate(() => window.__gameTest.saved.highest), 20);
  check('追加レベルの到達・クリア記録を再読み込みで保持');
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.evaluate(() => window.__gameTest.start(20));
  await page.screenshot({ path: 'test-results/landscape/desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile('test-results/landscape/report.json', JSON.stringify({ passed: report, errors }, null, 2));
} finally { await browser.close(); }
