/* 屏幕常亮卡片：包装全局 wakeLock 服务，展示真实申请状态。 */
(function (SC) {
  'use strict';

  SC.registerSensor({
    id: 'wakelock',
    name: '屏幕常亮',
    en: 'WAKE LOCK',
    group: '交互与输出',
    icon: 'wakelock',
    probe: function (feature) {
      if (!feature.wakeLock) {
        return { status: 'locked', reason: '当前浏览器不支持 Wake Lock API（iOS 16.4+ 且需要 HTTPS）。' };
      }
      if (!feature.secure) {
        return { status: 'locked', reason: '屏幕常亮需要 HTTPS 或 localhost。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-wakelock">' +
        '<div class="big-icon-stage"><div class="big-icon" id="campfire">' +
        SC.ui.icons.wakelock +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="lever" type="button" id="wl-lever" aria-pressed="false">' +
        '<span class="lever-base"><span class="lever-knob"></span></span>' +
        '<span class="lever-label">屏幕常亮</span>' +
        '</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="wl-note"></span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>不灭之火</span><span>CAMPFIRE</span></div>' +
          '<div class="readout-row"><span class="readout-label">API</span><span class="readout-value" id="wl-r-api">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="wl-r-state">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">安全上下文</span><span class="readout-value" id="wl-r-secure">--</span></div>' +
          '<div class="module-note">开启后，测量时屏幕不会自动熄灭。离开页面后系统可能自动释放，回到页面会重新申请。</div>'
      );

      var lever = ctx.root.querySelector('#wl-lever');
      var campfire = ctx.root.querySelector('#campfire');
      var note = ctx.root.querySelector('#wl-note');

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function render(state) {
        lever.setAttribute('aria-pressed', String(state.enabled));
        campfire.classList.toggle('is-on', state.enabled);
        note.textContent = state.error
          ? state.error
          : state.enabled
            ? '篝火燃烧中：屏幕保持常亮。'
            : '点击拉杆点燃篝火。';
        setReadout('#wl-r-api', SC.core.wakeLock.supported ? 'wakeLock 可用' : '不支持');
        setReadout('#wl-r-state', state.enabled ? '开启' : '关闭');
        setReadout('#wl-r-secure', window.isSecureContext !== false ? 'YES' : 'NO');
      }

      var off = SC.core.wakeLock.onChange(render);
      ctx.onCleanup(off);

      lever.addEventListener('click', async function () {
        var wasOn = SC.core.wakeLock.enabled;
        await SC.core.wakeLock.toggle();
        if (!wasOn && SC.core.wakeLock.enabled) {
          ctx.toast({ icon: 'wakelock', title: '成就达成！', subtitle: '不灭之火：屏幕常亮已开启' });
        }
        if (!SC.core.wakeLock.supported && SC.core.wakeLock.lastError) {
          ctx.toast({ icon: 'barrier', title: '不可用', subtitle: SC.core.wakeLock.lastError });
        }
      });

      render({
        enabled: SC.core.wakeLock.enabled,
        supported: SC.core.wakeLock.supported,
        error: ''
      });
    }
  });
})(window.SC = window.SC || {});
