import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.addInitScript(() => {
    localStorage.setItem('fruitful-save-v1', JSON.stringify({
      version: 2, highest: 1, cleared: [], stock: { delivery: 1, line: 1, rainbow: 0 },
      stageUses: {}, settings: { sound: true, reduced: true },
    }));
    window.__audioPlayCalls = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__audioPlayCalls.push({ src: this.src, volume: this.volume, currentTime: this.currentTime });
      return originalPlay.call(this).catch(() => {});
    };
  });
  const responses = [];
  page.on('response', response => { if (response.url().includes('fruit-clear.mp3')) responses.push(response); });
  await page.goto(`${process.env.GAME_URL || 'http://localhost:4173/'}?test=1`);
  await page.waitForFunction(() => !!window.__gameTest);
  const move = await page.evaluate(() => window.__gameTest.validMoves()[0]);
  await page.locator('.cell').nth(move[0]).click();
  await page.locator('.cell').nth(move[1]).click();
  await page.waitForFunction(() => !window.__gameTest.busy);
  const calls = await page.evaluate(() => window.__audioPlayCalls);
  assert.ok(calls.length >= 1, '消去波で音声が再生される');
  assert.ok(calls.every(call => call.src.endsWith('/assets/audio/fruit-clear.mp3')));
  assert.ok(calls.every(call => call.volume > 0 && call.volume <= .52));
  assert.ok(responses.some(response => response.ok() && response.headers()['content-type']?.includes('audio/mpeg')), 'MP3をaudio/mpegで取得');

  await page.evaluate(() => { window.__gameTest.saved.settings.sound = false; window.__audioPlayCalls.length = 0; });
  const next = await page.evaluate(() => window.__gameTest.validMoves()[0]);
  await page.locator('.cell').nth(next[0]).click();
  await page.locator('.cell').nth(next[1]).click();
  await page.waitForFunction(() => !window.__gameTest.busy);
  assert.equal(await page.evaluate(() => window.__audioPlayCalls.length), 0, '効果音OFFでは再生しない');
  console.log('PASS MP3取得・消去時再生・音量上限・効果音OFF');
} finally { await browser.close(); }
