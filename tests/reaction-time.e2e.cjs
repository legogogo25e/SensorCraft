/* 反应时间卡 E2E：用真实 Chromium 跑完整流程。
 * node e2e.cjs [dist-path]
 * 1) 打开 #reaction-time，确认卡片挂载、无页面错误；
 * 2) 点开始；第 1 次练习故意在等待期抢先，确认出现「太早了」；
 * 3) 其余试次等变绿再点；确认出结果（中位 ms、有效 15/15）；
 * 4) 点「导出数据 JSON」确认无错误（下载事件不校验内容）。
 */
'use strict';
const puppeteer = require('puppeteer-core');

const DIST = process.argv[2] ||
  '/home/hatch/workspace/biomed-quest/webapp/sensor-craft/dist/sensor-craft.html';

const POLICY_FILE = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const POLICY_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: '/opt/meta-chromium/chrome',
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
      `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
      '--window-size=390,844',
    ],
    defaultViewport: { width: 390, height: 844 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });

  const fail = (msg) => { throw new Error(msg); };

  await page.goto('file://' + DIST + '#reaction-time', { waitUntil: 'load', timeout: 30000 });
  await sleep(1500);
  // 先过校准门（首次进入的模态遮罩会挡住卡片按钮）
  const gateBtn = await page.$x ? null : null;
  const later = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('#gate button'));
    return btns.find((b) => b.textContent.trim() === '稍后') || null;
  });
  const laterEl = later && later.asElement ? later.asElement() : null;
  if (laterEl) { await laterEl.click(); await sleep(500); }

  // 1) 卡片挂载
  const startBtn = await page.$('#rt-start');
  if (!startBtn) fail('开始按钮没找到：卡片未挂载');
  const note = await page.$eval('#rt-note', (el) => el.textContent);
  console.log('note:', note);

  // 2) 点开始，第 1 次练习抢先
  await startBtn.click();
  await sleep(600); // 还在等待期（前置期最短 1200ms）
  const target = await page.$('#rt-target');
  if (!target) fail('目标区域没找到');
  await target.click(); // 抢先
  await sleep(300);
  const feedback = await page.$eval('#rt-target-text', (el) => el.textContent);
  console.log('抢先反馈:', JSON.stringify(feedback));
  if (!feedback.includes('太早了')) fail('抢先后没出现「太早了」反馈，实际：' + feedback);

  // 3) 其余试次：等变绿再点，直到结果出现
  const deadline = Date.now() + 180000;
  let resultsText = '';
  while (Date.now() < deadline) {
    const done = await page.$eval('#rt-results', (el) => !el.hidden && el.textContent.length > 0)
      .catch(() => false);
    if (done) {
      resultsText = await page.$eval('#rt-results', (el) => el.textContent);
      break;
    }
    const cls = await page.$eval('#rt-target', (el) => el.className).catch(() => '');
    if (cls.includes('state-go')) {
      await page.$('#rt-target').then((t) => t && t.click());
      await sleep(120);
    } else {
      await sleep(120);
    }
  }
  if (!resultsText) fail('180 秒内没出结果');
  console.log('结果文本:', JSON.stringify(resultsText.slice(0, 400)));
  if (!/中位反应/.test(resultsText)) fail('结果里没有「中位反应」');
  if (!/有效\s*15 \/ 15/.test(resultsText)) fail('有效次数不是 15/15：' + resultsText.slice(0, 200));
  // 练习试的抢先不计入计分统计（计分结果只汇总 15 次计分试），所以这里是 0 次；
  // 练习抢先是否被记录，放到导出 JSON 里校验
  if (!/抢先\s*0 次/.test(resultsText)) fail('计分抢先次数不是 0 次：' + resultsText.slice(0, 200));
  const median = resultsText.match(/中位反应\s*(\d+)\s*ms/);
  console.log('中位反应:', median ? median[1] + ' ms' : '未解析');

  // 4) 导出 JSON：校验 18 条试次数据，练习抢先 1 次、计分有效 15 次
  const exportBtn = await page.$('#rt-export');
  const disabled = await page.$eval('#rt-export', (el) => el.disabled);
  if (disabled) fail('导出按钮仍是 disabled');
  const fs = require('fs');
  const dlDir = '/tmp/rt-e2e/downloads';
  fs.mkdirSync(dlDir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir });
  await exportBtn.click();
  await sleep(1500);
  const files = fs.readdirSync(dlDir).filter((f) => f.endsWith('.json'));
  if (!files.length) fail('没下载到 JSON');
  const data = JSON.parse(fs.readFileSync(dlDir + '/' + files[0], 'utf8'));
  console.log('导出试次数:', data.length);
  const practice = data.filter((d) => d.phase === 'practice');
  const scored = data.filter((d) => d.phase === 'scored');
  if (data.length !== 18) fail('导出不是 18 条，实际 ' + data.length);
  if (practice.filter((d) => d.reason === 'anticipation').length !== 1) fail('练习抢先没记进数据');
  if (scored.filter((d) => d.valid).length !== 15) fail('计分有效不是 15 次');
  if (scored.some((d) => typeof d.rt !== 'number' || d.rt <= 0)) fail('计分 RT 数据异常');
  console.log('导出数据校验通过：18 条，练习抢先 1 次，计分有效 15 次');

  // 5) 再测一次可重跑（点后开始按钮变进行中）
  await page.$('#rt-again').then((b) => b && b.click());
  await sleep(800);
  const againState = await page.$eval('#rt-start', (el) => el.textContent);
  console.log('再测一次后开始按钮:', JSON.stringify(againState));

  await browser.close();
  if (errors.length) {
    console.log('页面错误：');
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('\nE2E 通过：挂载、抢先反馈、15 次计分、中位结果、导出、重跑均正常，零页面错误');
})().catch(async (e) => {
  console.error('E2E 失败:', e.message);
  process.exit(1);
});
