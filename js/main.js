/* 启动顺序：日志 → 能力探测 → HUD → 背包 → 权限门 → 调试面板 → 生命周期。 */
(function (SC) {
  'use strict';

  function boot() {
    SC.core.log.init();
    SC.core.probe.scan();
    SC.core.probe.run(SC.core.registry.all());

    SC.ui.hud.init();
    SC.ui.hud.setSecureBanner();
    SC.ui.bag.render();
    SC.ui.gate.init();
    SC.ui.debug.init();
    SC.core.lifecycle.init();

    var summary = SC.core.probe.summary();
    SC.core.log.add(
      '世界已加载：' + summary.ready + ' 可用 / ' + summary.partial + ' 受限 / ' + summary.locked + ' 未解锁'
    );

    if (!window.isSecureContext) {
      SC.core.log.add('非安全上下文：摄像头、麦克风、定位会被浏览器拒绝。');
    }

    window.SENSORCRAFT = SC;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window.SC = window.SC || {});
