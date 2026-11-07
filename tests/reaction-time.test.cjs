/* 反应时间卡纯函数单测：node tests/reaction-time.test.cjs
 * 只测不依赖 DOM 的部分（中位 / 四分位 / 计分汇总），
 * 插件与 jsPsych 流程用浏览器手动清单验证。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sensorPath = path.resolve(__dirname, '..', 'js', 'sensors', 'reaction-time.js');

let registered = null;
const sandbox = {
  window: {},
  console,
  performance,
  document: { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' },
};
sandbox.window.SC = {
  core: { dom: {}, log: { add() {} } },
  registerSensor(m) { registered = m; },
};
sandbox.SC = sandbox.window.SC;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sensorPath, 'utf8'), sandbox);

const T = sandbox.window.SC._reactionTimeTest;
let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('ok  -', name);
  } else {
    failures += 1;
    console.log('FAIL -', name, '\n  actual:  ', a, '\n  expected:', e);
  }
}

check('registered id', registered && registered.id, 'reaction-time');
check('registered group', registered && registered.group, '生物医学');
check('constants', [T.PRACTICE_TRIALS, T.SCORED_TRIALS, T.MIN_VALID_SCORED], [3, 15, 12]);

check('median odd', T.medianOf([300, 210, 250]), 250);
check('median even', T.medianOf([200, 240, 260, 300]), 250);
check('median empty', T.medianOf([]), null);
check('median single', T.medianOf([187]), 187);

check('quartiles', T.quartilesOf([180, 200, 220, 240, 260, 280, 300, 320]),
  { q1: 210, median: 250, q3: 290 });
check('quartiles empty', T.quartilesOf([]), { q1: null, median: null, q3: null });

function scored(validRts, reasons) {
  const trials = validRts.map((rt) => ({ valid: true, reason: null, rt }));
  (reasons || []).forEach((r) => trials.push({ valid: false, reason: r, rt: null }));
  return trials;
}

const full = T.summarizeScored(scored(
  [210, 230, 190, 250, 220, 240, 200, 260, 215, 235, 225, 245, 205, 255, 195], []
));
check('15 valid comparable', full.comparable, true);
check('15 valid median', full.median, 225);
check('15 valid min/max', [full.min, full.max], [190, 260]);
check('15 valid counts', [full.valid, full.anticipations, full.timeouts, full.frameStalls, full.interrupted],
  [15, 0, 0, 0, 0]);

const short = T.summarizeScored(scored(
  [210, 230, 190, 250, 220, 240, 200, 260, 215, 235, 225],
  ['anticipation', 'anticipation', 'timeout', 'frame-stall']
));
check('11 valid not comparable', short.comparable, false);
check('11 valid median', short.median, 225);
check('11 valid reason counts', [short.anticipations, short.timeouts, short.frameStalls, short.interrupted],
  [2, 1, 1, 0]);

const interrupted = T.summarizeScored(scored([200, 210], ['interrupted', 'interrupted', 'interrupted']));
check('interrupted counts', [interrupted.valid, interrupted.interrupted], [2, 3]);

const empty = T.summarizeScored([]);
check('empty summary', [empty.valid, empty.comparable, empty.median], [0, false, null]);

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nall reaction-time unit tests passed');
