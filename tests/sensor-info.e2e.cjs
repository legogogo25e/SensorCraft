/* 传感器说明弹窗 E2E：用真实 Chromium 跑。
 * node e2e.cjs [dist-path]
 * 1) 打开 #accelerometer，点标题栏「说明」，确认弹窗出现：
 *    标题含「加速度计」、有配图 SVG、有数据表（≥3 行）、有「试一试」；
 * 2) 按 Esc，确认弹窗关了、但工作台还在（没有一起关掉）；
 * 3) 再打开 #barometer（未解锁卡），点「说明」，确认有「为什么网页拿不到」；
 * 4) 点 ✕ 关闭，确认弹窗隐藏；全程零页面错误。
 */
'use strict';
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DIST = process.argv[2] ||
  '/home/hatch/workspace/biomed-quest/webapp/sensor-craft/dist/sensor-craft.html';

function fail(msg) {
  throw new Error(msg);
}

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: '/opt/meta-chromium/chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt',
      '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
      '--window-size=390,844'],
    defaultViewport: { width: 390, height: 844 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  async function openCard(hash) {
    await page.goto('file://' + DIST + hash, { waitUntil: 'load', timeout: 30000 });
    await sleep(1500);
    const later = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('#gate button'));
      return btns.find((b) => b.textContent.trim() === '稍后') || null;
    });
    if (later.asElement()) { await later.asElement().click(); await sleep(500); }
  }

  async function clickInfoButton() {
    const btn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('.bench-title-actions .mc-btn'));
      return btns.find((b) => b.textContent.indexOf('说明') >= 0) || null;
    });
    if (!btn.asElement()) fail('标题栏没找到「说明」按钮');
    await btn.asElement().click();
    await sleep(600);
    const visible = await page.$eval('#sensor-info', (el) => !el.hidden);
    if (!visible) fail('点说明后弹窗没有出现');
  }

  // 1) 加速度计
  await openCard('#accelerometer');
  await clickInfoButton();
  const title = await page.$eval('.info-panel h2', (el) => el.textContent);
  if (title.indexOf('加速度计') < 0) fail('弹窗标题不对：' + title);
  const svgCount = await page.evaluate(() => document.querySelectorAll('.info-diagram svg').length);
  if (svgCount !== 1) fail('配图 SVG 不是 1 个，实际 ' + svgCount);
  const rows = await page.evaluate(() => document.querySelectorAll('.info-data tbody tr').length);
  if (rows < 3) fail('数据表行数 <3，实际 ' + rows);
  const tryText = await page.$eval('.info-try', (el) => el.textContent);
  if (!/试一试/.test(tryText)) fail('没有「试一试」');

  // 2) Esc 只关弹窗，不关工作台
  await page.keyboard.press('Escape');
  await sleep(400);
  const stillHidden = await page.$eval('#sensor-info', (el) => el.hidden);
  if (!stillHidden) fail('按 Esc 后弹窗没关');
  const benchOpen = await page.$eval('#bench-view', (el) => !el.hidden);
  if (!benchOpen) fail('按 Esc 后工作台也被关了');
  const hash = await page.evaluate(() => location.hash);
  if (hash !== '#accelerometer') fail('按 Esc 后 URL 变了：' + hash);

  // 3) 未解锁卡：气压计（站内切换：直接走 lifecycle.open，不用 goto 换 hash，
  // goto 只换 hash 时浏览器不重新加载，app 也不会因此开卡）
  await page.evaluate(() => window.SC.core.lifecycle.open('barometer'));
  await sleep(800);
  await clickInfoButton();
  const note = await page.$eval('.info-note', (el) => el.textContent).catch(() => '');
  if (!/为什么网页拿不到/.test(note)) fail('未解锁卡说明里没有「为什么网页拿不到」');

  // 4) ✕ 关闭
  await page.$('.info-close').then((b) => b && b.click());
  await sleep(400);
  if (!(await page.$eval('#sensor-info', (el) => el.hidden))) fail('点 ✕ 后弹窗没关');

  await browser.close();
  if (errors.length) { console.log('页面错误：', errors); process.exit(1); }
  console.log('\nINFO E2E 通过：说明弹窗（可用卡 + 未解锁卡）、Esc 只关弹窗、✕ 关闭，零页面错误');
})().catch((e) => { console.error('E2E 失败:', e.message); process.exit(1); });
