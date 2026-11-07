/* 传感器说明内容单测：29 条全在、字段齐全、SVG 配图合规。
 * node tests/sensor-info.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'js/ui/sensor-info-data.js');

const USABLE = [
  'accelerometer', 'biometrics', 'camera-manual', 'camera', 'face-detect',
  'gamepad', 'geolocation', 'gyroscope', 'microphone', 'multitouch',
  'orientation', 'reaction-time', 'speaker', 'torch', 'wakelock', 'webgpu',
  'yolo-detect'
];
const LOCKED = [
  'ambient-light', 'magnetometer', 'barometer', 'proximity', 'lidar',
  'bluetooth', 'nfc', 'serial', 'vibration', 'battery', 'healthkit',
  'background'
];

let failures = 0;
function check(ok, label) {
  if (ok) console.log('ok  -', label);
  else {
    failures += 1;
    console.log('FAIL -', label);
  }
}

const code = fs.readFileSync(DATA, 'utf8');
const sandbox = { window: { SC: { core: {} } } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const info = sandbox.window.SC.core && sandbox.window.SC.core.sensorInfoData;
check(info && typeof info === 'object', 'sensorInfoData 已导出');

const ids = Object.keys(info || {});
check(ids.length === 29, '共 29 条（实际 ' + ids.length + ' 条）');
USABLE.concat(LOCKED).forEach(function (id) {
  check(Object.prototype.hasOwnProperty.call(info, id), '有条目：' + id);
});

Object.keys(info).forEach(function (id) {
  const e = info[id];
  check(typeof e.intro === 'string' && e.intro.length >= 8, id + ' intro 非空');
  check(Array.isArray(e.principle) && e.principle.length >= 2, id + ' principle ≥2 段');
  e.principle.forEach(function (p, i) {
    check(typeof p === 'string' && p.length >= 10, id + ' principle[' + i + '] 非空');
  });
  check(Array.isArray(e.uses) && e.uses.length >= 3, id + ' uses ≥3 条');
  check(Array.isArray(e.data) && e.data.length >= 3, id + ' data ≥3 行');
  e.data.forEach(function (row, i) {
    check(
      row && typeof row.field === 'string' && row.field.length > 0 &&
        typeof row.meaning === 'string' && row.meaning.length > 0 &&
        typeof row.example === 'string' && row.example.length > 0,
      id + ' data[' + i + '] 字段/含义/例子齐全'
    );
  });
  check(typeof e.tryIt === 'string' && e.tryIt.length >= 8, id + ' tryIt 非空');
  check(
    typeof e.diagram === 'string' &&
      e.diagram.indexOf('<svg') === 0 &&
      e.diagram.indexOf('viewBox="0 0 320 180"') >= 0,
    id + ' diagram 为 320x180 SVG'
  );
  check((e.diagram.match(/[\u4e00-\u9fff]/g) || []).length >= 4, id + ' diagram 含中文标签');
});
LOCKED.forEach(function (id) {
  check(typeof info[id].note === 'string' && info[id].note.length >= 8, id + ' 有 note（为什么拿不到）');
});

if (failures) {
  console.log('\n' + failures + ' 项失败');
  process.exit(1);
}
console.log('\nall sensor-info content tests passed');
