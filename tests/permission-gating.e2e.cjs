/* 权限门控 E2E：进卡不请求权限，点了开启才请求。
 * 用 evaluateOnNewDocument 桩掉 getUserMedia / geolocation.watchPosition
 * （计数 + 模拟拒绝），验证：
 * 1) 打开 #camera / #microphone / #face-detect / #yolo-detect / #camera-manual /
 *    #torch，getUserMedia 调用都是 0 次，且开始屏可见；
 * 2) 点「开启」后调用恰好 1 次；拒绝后卡片显示友好提示、开始屏回来（可重新开启），
 *    不会整页报错、不会跳回背包；
 * 3) #geolocation 进卡不调用 watchPosition，点「开始定位」才调用 1 次。
 * node e2e.cjs [dist-path]
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

  // 桩：计数 + 一律模拟拒绝（NotAllowedError），不碰真硬件
  await page.evaluateOnNewDocument(() => {
    window.__gumCalls = 0;
    window.__watchCalls = 0;
    const md = navigator.mediaDevices || {};
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true });
    }
    md.getUserMedia = function () {
      window.__gumCalls += 1;
      const err = new Error('Permission denied (stub)');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    };
    if (navigator.geolocation && navigator.geolocation.watchPosition) {
      const orig = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = function () {
        window.__watchCalls += 1;
        return orig.apply(null, arguments);
      };
    }
  });

  async function openCard(hash) {
    await page.goto('file://' + DIST + hash, { waitUntil: 'load', timeout: 30000 });
    await sleep(1500);
    // 校准门只在首次加载出现；按钮即使藏在 hidden 的门里也能被 querySelector 找到，
    // 所以必须先确认门是可见的再点，否则会在隐藏按钮上点出「not clickable」。
    const gateVisible = await page.$eval('#gate', (el) => !el.hidden);
    if (!gateVisible) return;
    const later = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('#gate button'));
      return btns.find((b) => b.textContent.trim() === '稍后') || null;
    });
    if (later.asElement()) { await later.asElement().click(); await sleep(500); }
  }

  // 站内切卡：直接走 lifecycle.open；goto 只换 hash 时浏览器不重新加载，
  // app 也不会因此开卡（之前 info E2E 的 barometer 步骤踩过同一个坑）。
  async function switchCard(id) {
    await page.evaluate((cardId) => window.SC.core.lifecycle.open(cardId), id);
    await sleep(800);
  }

  async function gumCalls() {
    return page.evaluate(() => window.__gumCalls || 0);
  }

  async function assertStartOverlay(cardId, startBtnId) {
    const visible = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return !!el && !el.hidden && el.offsetParent !== null;
    }, cardId + '-start');
    if (!visible) fail(cardId + '：进卡后开始屏不可见');
    const btn = await page.$('#' + startBtnId);
    if (!btn) fail(cardId + '：开始按钮没找到 #' + startBtnId);
    return btn;
  }

  // 1) 摄像头：进卡 0 次调用
  await openCard('#camera');
  if ((await gumCalls()) !== 0) fail('camera：进卡就调了 getUserMedia');
  const camStart = await assertStartOverlay('cam', 'cam-start-btn');
  await camStart.click();
  await sleep(1200);
  if ((await gumCalls()) !== 1) fail('camera：点开启后 getUserMedia 不是 1 次，实际 ' + (await gumCalls()));
  const camNote = await page.$eval('#cam-note', (el) => el.textContent);
  if (!/权限被拒绝/.test(camNote)) fail('camera：拒绝后没有友好提示，实际：' + camNote);
  const camBack = await page.evaluate(() => {
    const el = document.getElementById('cam-start');
    return !!el && !el.hidden;
  });
  if (!camBack) fail('camera：拒绝后开始屏没有回来');
  const camBtnText = await page.$eval('#cam-start-btn', (el) => el.textContent);
  if (!/重新开启/.test(camBtnText)) fail('camera：拒绝后按钮不是「重新开启」，实际：' + camBtnText);
  const benchStillOpen = await page.$eval('#bench-view', (el) => !el.hidden);
  if (!benchStillOpen) fail('camera：拒绝后工作台被关了（不该跳回背包）');

  // 2) 麦克风（同文档内切卡，计数累计：进卡仍是 1 次，点开启后 2 次）
  await switchCard('microphone');
  if ((await gumCalls()) !== 1) fail('microphone：进卡就调了 getUserMedia，实际 ' + (await gumCalls()));
  await assertStartOverlay('mic', 'mic-start-btn');
  await (await page.$('#mic-start-btn')).click();
  await sleep(1200);
  if ((await gumCalls()) !== 2) fail('microphone：点开启后 getUserMedia 不是 2 次，实际 ' + (await gumCalls()));

  // 3) 人面识别：只验证进卡不请求（不点开启，避免下载 9.5MB 模型）
  await switchCard('face-detect');
  if ((await gumCalls()) !== 2) fail('face-detect：进卡就调了 getUserMedia，实际 ' + (await gumCalls()));
  await assertStartOverlay('face', 'face-start-btn');

  // 4) YOLO：同上，只验证进卡不请求
  await switchCard('yolo-detect');
  if ((await gumCalls()) !== 2) fail('yolo-detect：进卡就调了 getUserMedia，实际 ' + (await gumCalls()));
  await assertStartOverlay('yolo', 'yolo-start-btn');

  // 5) 手动相机
  await switchCard('camera-manual');
  if ((await gumCalls()) !== 2) fail('camera-manual：进卡就调了 getUserMedia，实际 ' + (await gumCalls()));
  await assertStartOverlay('manual', 'manual-start-btn');
  await (await page.$('#manual-start-btn')).click();
  await sleep(1200);
  if ((await gumCalls()) !== 3) fail('camera-manual：点开启后 getUserMedia 不是 3 次，实际 ' + (await gumCalls()));

  // 6) 补光灯：进卡不检测，点「检测补光灯」才调用
  await switchCard('torch');
  if ((await gumCalls()) !== 3) fail('torch：进卡就调了 getUserMedia，实际 ' + (await gumCalls()));
  await (await page.$('#torch-detect')).click();
  await sleep(1200);
  if ((await gumCalls()) !== 4) fail('torch：点检测后 getUserMedia 不是 4 次，实际 ' + (await gumCalls()));
  const torchNote = await page.$eval('#torch-note', (el) => el.textContent);
  if (!/无法访问摄像头/.test(torchNote)) fail('torch：拒绝后提示不对，实际：' + torchNote);

  // 7) GPS：进卡不定位，点「开始定位」才调用
  await switchCard('geolocation');
  const watchBefore = await page.evaluate(() => window.__watchCalls || 0);
  if (watchBefore !== 0) fail('geolocation：进卡就调了 watchPosition');
  const gpsBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.module-toolbar .mc-btn'));
    return btns.find((b) => /开始定位/.test(b.textContent)) || null;
  });
  if (!gpsBtn.asElement()) fail('geolocation：没找到「开始定位」按钮');
  await gpsBtn.asElement().click();
  await sleep(800);
  const watchAfter = await page.evaluate(() => window.__watchCalls || 0);
  if (watchAfter !== 1) fail('geolocation：点开始定位后 watchPosition 不是 1 次，实际 ' + watchAfter);

  await browser.close();
  if (errors.length) { console.log('页面错误：', errors); process.exit(1); }
  console.log('\nPERMISSION E2E 通过：6 张卡进卡 0 次权限请求，点开启才请求；拒绝后可重试、不跳回背包；GPS 同理。零页面错误');
})().catch((e) => { console.error('E2E 失败:', e.message); process.exit(1); });
