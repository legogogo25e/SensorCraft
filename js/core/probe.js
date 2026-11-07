/* 启动时做一次能力探测。probe() 的结果决定卡片是 READY / LIMITED / LOCKED / INFO。 */
(function (SC) {
  'use strict';
  var probe = (SC.core.probe = {
    snapshot: {},
    feature: {},
    scan: function () {
      var f = {
        secure: window.isSecureContext !== false,
        media: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        motion: typeof DeviceMotionEvent !== 'undefined',
        orientation: typeof DeviceOrientationEvent !== 'undefined',
        motionPermission:
          typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function',
        orientationPermission:
          typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function',
        geolocation: !!navigator.geolocation,
        pointer: 'PointerEvent' in window,
        touch: 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0,
        speechSynthesis: 'speechSynthesis' in window,
        speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
        gamepad: typeof navigator.getGamepads === 'function',
        wakeLock: 'wakeLock' in navigator,
        webgpu: !!navigator.gpu,
        bluetooth: 'bluetooth' in navigator,
        nfc: 'NDEFReader' in window,
        serial: 'serial' in navigator,
        vibration: typeof navigator.vibrate === 'function',
        battery: typeof navigator.getBattery === 'function',
        ambientLight: 'AmbientLightSensor' in window,
        magnetometer: 'Magnetometer' in window,
        barometer: false,
        lidar: false,
        healthkit: false,
        background: false,
        torch: false,
        manualCamera: false
      };
      probe.feature = f;
      return f;
    },
    run: function (modules) {
      var result = {};
      modules.forEach(function (module) {
        var item;
        try {
          item = typeof module.probe === 'function' ? module.probe(probe.feature) : { status: 'ready' };
        } catch (error) {
          item = { status: 'locked', reason: '能力检测失败：' + (error && error.message ? error.message : error) };
        }
        if (!item || !item.status) item = { status: 'ready' };
        result[module.id] = item;
      });
      probe.snapshot = result;
      return result;
    },
    get: function (id) {
      return probe.snapshot[id] || { status: 'locked', reason: '尚未检测该模块。' };
    },
    summary: function () {
      var counts = { ready: 0, partial: 0, info: 0, locked: 0, total: 0 };
      Object.keys(probe.snapshot).forEach(function (id) {
        var status = probe.snapshot[id].status || 'locked';
        counts.total += 1;
        if (counts[status] != null) counts[status] += 1;
        else counts.locked += 1;
      });
      return counts;
    }
  });
})(window.SC = window.SC || {});
