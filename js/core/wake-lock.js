/* 屏幕常亮服务。全局共享，页面重新可见时自动重新申请，避免测量时锁屏。 */
(function (SC) {
  'use strict';
  var wakeLock = (SC.core.wakeLock = {
    supported: 'wakeLock' in navigator,
    sentinel: null,
    enabled: false,
    listeners: [],
    lastError: '',
    onChange: function (fn) {
      if (typeof fn === 'function') wakeLock.listeners.push(fn);
      return function () {
        var index = wakeLock.listeners.indexOf(fn);
        if (index >= 0) wakeLock.listeners.splice(index, 1);
      };
    },
    emit: function () {
      wakeLock.listeners.slice().forEach(function (fn) {
        try {
          fn({ enabled: wakeLock.enabled, supported: wakeLock.supported, error: wakeLock.lastError });
        } catch (error) {
          /* ignore listener errors */
        }
      });
    },
    request: async function () {
      wakeLock.lastError = '';
      if (!wakeLock.supported) {
        wakeLock.enabled = false;
        wakeLock.lastError = '此浏览器不支持 Wake Lock API';
        wakeLock.emit();
        return false;
      }
      try {
        wakeLock.sentinel = await navigator.wakeLock.request('screen');
        wakeLock.enabled = true;
        wakeLock.sentinel.addEventListener('release', function () {
          wakeLock.sentinel = null;
          if (wakeLock.enabled) wakeLock.emit();
        });
      } catch (error) {
        wakeLock.sentinel = null;
        wakeLock.enabled = false;
        wakeLock.lastError = error && error.message ? error.message : '屏幕常亮申请被拒绝';
      }
      wakeLock.emit();
      return wakeLock.enabled;
    },
    release: async function () {
      wakeLock.enabled = false;
      if (wakeLock.sentinel) {
        try {
          await wakeLock.sentinel.release();
        } catch (error) {
          /* ignore */
        }
      }
      wakeLock.sentinel = null;
      wakeLock.emit();
    },
    toggle: async function () {
      if (wakeLock.enabled) {
        await wakeLock.release();
        return false;
      }
      return wakeLock.request();
    },
    init: function () {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && wakeLock.enabled && !wakeLock.sentinel) {
          wakeLock.request();
        }
      });
    }
  });
})(window.SC = window.SC || {});
