import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(process.env.PLAYWRIGHT_MODULES || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'), 'playwright'))); }
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [], errors = [];
const check = name => { report.push(name); console.log(`PASS ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('http://localhost:4173/?test=1');
  await page.waitForFunction(() => !!window.__gameTest);
  assert.equal(await page.locator('.cell').count(), 40);
  assert.ok((await page.evaluate(() => window.__gameTest.validMoves())).length > 0);
  await page.screenshot({ path: fileURLToPath(new URL('desktop.png', output)), fullPage: true });
  check('PC起動・Lv1の40マス・合法手・スクリーンショット');

  const move = await page.evaluate(() => window.__gameTest.validMoves()[0]);
  await page.locator('.cell').nth(move[0]).click();
  await page.locator('.cell').nth(move[1]).click();
  assert.equal(await page.locator('#board').getAttribute('aria-busy'), 'true');
  assert.ok(await page.locator('#levels').isDisabled());
  const during = await page.evaluate(() => JSON.stringify(window.__gameTest.game.board));
  await page.locator('.cell').nth(0).dispatchEvent('click');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gameTest.game.board)), during);
  await page.waitForFunction(() => !window.__gameTest.busy);
  assert.ok((await page.locator('#chain').textContent()).includes('CHAIN'));
  check('クリック交換・アニメーション・連鎖表示・二重入力防止');

  await page.locator('#help').click(); assert.ok(await page.locator('#modal').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#settings').click(); await page.locator('#motion-setting').check();
  await page.locator('#close-modal').click();
  await page.reload(); await page.waitForFunction(() => !!window.__gameTest);
  assert.equal(await page.evaluate(() => window.__gameTest.saved.settings.reduced), true);
  check('ヘルプ・Escape・設定・保存再読込');

  // 虹合成を固定盤面でプレイし、達成・次ステージ・保存をDOM経由で確認。
  await page.evaluate(() => {
    const t = window.__gameTest, state = t.state();
    state.board[25].special = 'rainbow'; state.board[26].special = 'rainbow';
    state.progress.fruit0 = 14; t.inject(state.board, state.progress);
  });
  await page.locator('.cell').nth(25).click(); await page.locator('.cell').nth(26).click();
  await page.waitForFunction(() => !window.__gameTest.busy);
  assert.match(await page.locator('#modal-title').textContent(), /収穫/);
  assert.ok((await page.evaluate(() => window.__gameTest.saved.cleared)).includes(1));
  assert.equal(await page.evaluate(() => window.__gameTest.saved.highest), 2);
  await page.locator('#next-level').click(); assert.match(await page.locator('#level-tag').textContent(), /02/);
  await page.reload(); await page.waitForFunction(() => !!window.__gameTest);
  assert.match(await page.locator('#level-tag').textContent(), /02/);
  await page.locator('#levels').click();
  assert.equal(await page.locator('.level-choice').count(), 20);
  assert.ok(await page.locator('[data-level="3"]').isDisabled());
  await page.locator('[data-level="1"]').click();
  assert.match(await page.locator('#level-tag').textContent(), /01/);
  check('虹×虹・レベルクリア・次へ・最高到達保存・レベル選択とロック');

  // 全合成の表示ルートと、描画が最終ロジックへ追いつくことを確認。
  for (const [a, b] of [['cross', 'cross'], ['cross', 'horizontal'], ['horizontal', 'vertical'], ['horizontal', 'rainbow'], ['rainbow', 'rainbow']]) {
    await page.evaluate(([a, b]) => {
      const t = window.__gameTest; t.start(10); const s = t.state();
      s.board[2].special = a; s.board[3].special = b; t.inject(s.board);
    }, [a, b]);
    await page.locator('.cell').nth(2).click(); await page.locator('.cell').nth(3).click();
    await page.waitForFunction(() => !window.__gameTest.busy);
    assert.ok(await page.evaluate(() => { const s = window.__gameTest.state(); return JSON.stringify(s.board) === JSON.stringify(s.visibleBoard) && JSON.stringify(s.progress) === JSON.stringify(s.visibleProgress); }));
  }
  check('指定5種類の特殊合成がブラウザで完了し、描画・目標が一致');

  await page.evaluate(() => window.__gameTest.start(10));
  assert.equal(await page.locator('.cell.ice').count(), 4);
  assert.equal(await page.locator('.cell.box').count(), 4);
  assert.equal(await page.locator('.cell.blocked').count(), 2);
  await page.screenshot({ path: fileURLToPath(new URL('level10-desktop.png', output)), fullPage: true });
  await page.locator('#reset').click(); await page.locator('#confirm-action').click();
  assert.ok(await page.evaluate(() => Object.values(window.__gameTest.game.progress).every(n => n === 0)));
  check('複合障害物表示・レベルのリセット');
  await page.locator('#settings').click(); await page.locator('#motion-setting').uncheck(); await page.locator('#close-modal').click();
  await page.evaluate(() => { const t = window.__gameTest, s = t.state(); s.board[2].special = 'rainbow'; s.board[3].special = 'rainbow'; t.inject(s.board); });
  await page.locator('.cell').nth(2).click(); await page.locator('.cell').nth(3).click();
  await page.waitForFunction(() => document.getElementById('celebration').textContent.includes('Festival'));
  await page.screenshot({ path: fileURLToPath(new URL('rainbow-effect.png', output)), fullPage: true });
  await page.waitForFunction(() => !window.__gameTest.busy);
  check('モーション有効の虹×虹演出・光輪・完了までの入力ロック');
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await mobile.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:4173/?test=1'); await p.waitForFunction(() => !!window.__gameTest);
  await p.screenshot({ path: fileURLToPath(new URL('mobile.png', output)), fullPage: true });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const m = await p.evaluate(() => window.__gameTest.validMoves()[0]);
  const from = await p.locator('.cell').nth(m[0]).boundingBox(), to = await p.locator('.cell').nth(m[1]).boundingBox();
  const session = await mobile.newCDPSession(p);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x + to.width / 2, y: to.y + to.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForFunction(() => !window.__gameTest.busy && Object.values(window.__gameTest.game.progress).some(n => n > 0));
  check('スマホ実タッチスワイプ・表示幅・スクリーンショット');
  await p.evaluate(() => window.__gameTest.start(10));
  await p.screenshot({ path: fileURLToPath(new URL('level10-mobile.png', output)), fullPage: true });
  for (const width of [320, 360, 640, 768, 1024]) {
    await p.setViewportSize({ width, height: 900 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`);
  }
  check('320 / 360 / 640 / 768 / 1024pxで横あふれなし');
  await mobile.close();

  const broken = await browser.newContext(); const bp = await broken.newPage();
  await bp.addInitScript(() => localStorage.setItem('fruitful-save-v1', '{broken'));
  await bp.goto('http://localhost:4173/?test=1'); await bp.waitForFunction(() => !!window.__gameTest);
  assert.equal(await bp.evaluate(() => window.__gameTest.saved.highest), 1);
  check('破損セーブでも起動'); await broken.close();
  assert.deepEqual(errors, []);
  check('JavaScript・ブラウザコンソールエラーなし');
  await writeFile(new URL('browser-report.json', output), JSON.stringify({ date: new Date().toISOString(), browser: await browser.version(), passed: report, errors }, null, 2));
} finally { await browser.close(); }

