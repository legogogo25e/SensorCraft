/* SENSORCRAFT 全局命名空间与配置。所有模块只挂到 window.SC 下，避免污染全局。 */
(function (SC) {
  'use strict';
  SC.version = '1.0.0';
  SC.core = SC.core || {};
  SC.ui = SC.ui || {};
  SC.sensors = SC.sensors || {};

  SC.groups = ['影像与声音', '运动与环境', '交互与输出', '计算与身份', '未解锁图鉴'];

  SC.groupMeta = {
    '影像与声音': { icon: 'camera', label: 'VISION & AUDIO' },
    '运动与环境': { icon: 'compass', label: 'MOTION & WORLD' },
    '交互与输出': { icon: 'gamepad', label: 'INTERACT & OUTPUT' },
    '计算与身份': { icon: 'webgpu', label: 'COMPUTE & IDENTITY' },
    '未解锁图鉴': { icon: 'barrier', label: 'LOCKED CODEX' }
  };

  SC.config = {
    maxLogLines: 3,
    logFadeMs: 8000,
    readoutHz: 10,
    toastMs: 3000,
    issueUrl: 'https://github.com/legogogoagent/biomed-quest/issues/new',
    // 临时预填（2026-11-08）：方便当前测试，之后移除，恢复为空，改回用户手动填写。
    logEndpoint: 'https://sensorcraft-log.legogogo25e.workers.dev/logs'
  };
})(window.SC = window.SC || {});
