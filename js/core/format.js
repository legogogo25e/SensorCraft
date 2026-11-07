/* 数值、单位、音名、中文方位格式化。所有显示都经过这里，避免 UI 里散落 NaN。 */
(function (SC) {
  'use strict';
  var format = (SC.core.format = {});

  format.num = function (value, digits) {
    if (value == null || !isFinite(value)) return '--';
    return Number(value).toFixed(digits == null ? 1 : digits);
  };

  format.int = function (value) {
    if (value == null || !isFinite(value)) return '--';
    return String(Math.round(value));
  };

  format.fixed = function (value, digits) {
    if (value == null || !isFinite(value)) return '--';
    return Number(value).toFixed(digits);
  };

  format.signed = function (value, digits) {
    if (value == null || !isFinite(value)) return '--';
    var n = Number(value);
    return (n > 0 ? '+' : '') + n.toFixed(digits == null ? 1 : digits);
  };

  format.pad2 = function (value) {
    return (value < 10 ? '0' : '') + value;
  };

  format.time = function (date) {
    var d = date || new Date();
    return format.pad2(d.getHours()) + ':' + format.pad2(d.getMinutes()) + ':' + format.pad2(d.getSeconds());
  };

  format.hz = function (value) {
    if (value == null || !isFinite(value)) return '-- Hz';
    if (value >= 1000) return (value / 1000).toFixed(2) + ' kHz';
    return Math.round(value) + ' Hz';
  };

  format.db = function (value) {
    if (value == null || !isFinite(value)) return '--';
    return Math.round(value);
  };

  format.distance = function (meters) {
    if (meters == null || !isFinite(meters)) return '-- m';
    if (Math.abs(meters) >= 1000) return (meters / 1000).toFixed(2) + ' km';
    return Math.round(meters) + ' m';
  };

  format.speed = function (mps) {
    if (mps == null || !isFinite(mps)) return '-- km/h';
    return (mps * 3.6).toFixed(1) + ' km/h';
  };

  format.accuracy = function (meters) {
    if (meters == null || !isFinite(meters)) return '-- m';
    return '±' + Math.round(meters) + ' m';
  };

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  format.note = function (freq) {
    if (freq == null || !isFinite(freq) || freq <= 0) return null;
    var midi = 69 + 12 * Math.log(freq / 440) / Math.LN2;
    var rounded = Math.round(midi);
    var note = NOTE_NAMES[((rounded % 12) + 12) % 12];
    var octave = Math.floor(rounded / 12) - 1;
    var target = 440 * Math.pow(2, (rounded - 69) / 12);
    var cents = Math.round(1200 * Math.log(freq / target) / Math.LN2);
    return { name: note, octave: octave, cents: cents, label: note + octave };
  };

  var COMPASS_8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  var COMPASS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  format.compass = function (deg) {
    if (deg == null || !isFinite(deg)) return { cn: '--', en: '--', deg: null };
    var normalized = ((deg % 360) + 360) % 360;
    var index = Math.round(normalized / 45) % 8;
    return { cn: COMPASS_8[index], en: COMPASS_EN[index], deg: normalized };
  };

  format.ms = function (value) {
    if (value == null || !isFinite(value)) return '--';
    return Math.round(value) + ' ms';
  };

  format.temperatureC = function (value) {
    if (value == null || !isFinite(value)) return '-- °C';
    return value.toFixed(1) + ' °C';
  };
})(window.SC = window.SC || {});
