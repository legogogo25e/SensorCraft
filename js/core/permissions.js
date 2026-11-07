/* iOS 的 motion/orientation 权限必须由用户手势触发；这里集中处理，避免各模块重复写兼容代码。 */
(function (SC) {
  'use strict';
  var permissions = (SC.core.permissions = {
    state: { motion: 'unknown', orientation: 'unknown' },
    async requestMotion() {
      var result = { motion: 'unsupported', orientation: 'unsupported' };
      var motionPromise = null;
      var orientationPromise = null;

      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        motionPromise = DeviceMotionEvent.requestPermission();
      } else if (typeof DeviceMotionEvent !== 'undefined') {
        result.motion = 'granted';
      }

      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        orientationPromise = DeviceOrientationEvent.requestPermission();
      } else if (typeof DeviceOrientationEvent !== 'undefined') {
        result.orientation = 'granted';
      }

      if (motionPromise) {
        result.motion = await motionPromise.catch(function () {
          return 'error';
        });
      }
      if (orientationPromise) {
        result.orientation = await orientationPromise.catch(function () {
          return 'error';
        });
      }
      permissions.state = result;
      return result;
    },
    async requestMotionIfNeeded() {
      var result = { motion: 'granted', orientation: 'granted' };
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function' &&
        permissions.state.motion === 'unknown'
      ) {
        result.motion = await DeviceMotionEvent.requestPermission().catch(function () {
          return 'error';
        });
      }
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function' &&
        permissions.state.orientation === 'unknown'
      ) {
        result.orientation = await DeviceOrientationEvent.requestPermission().catch(function () {
          return 'error';
        });
      }
      permissions.state = result;
      return result;
    },
    cameraHint() {
      if (!window.isSecureContext) {
        return '当前页面不是 HTTPS/localhost，浏览器会拒绝摄像头与麦克风。';
      }
      return '';
    }
  });
})(window.SC = window.SC || {});
