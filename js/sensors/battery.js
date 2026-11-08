/* 电池电量：读 Battery Status API，显示电量、充电状态与充放电时间。
 * iOS Safari 不提供；桌面 / Android Chrome 支持。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'battery',
    name: '电池电量',
    en: 'BATTERY',
    group: '交互与输出',
    icon: 'battery',
    probe: function (feature) {
      if (!feature.battery) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS Safari 不提供 Battery Status API，看电量只能看系统状态栏。' };
        }
        return { status: 'locked', reason: '当前浏览器不支持 Battery Status API（桌面 / Android Chrome 支持）。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-battery">' +
        '<div class="big-icon-stage"><div class="big-icon" id="bat-icon">' +
        SC.ui.icons.battery +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="bat-refresh">刷新电量</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="bat-note">正在读取电池状态…</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>电池</span><span>BATTERY</span></div>' +
          '<div class="readout-row"><span class="readout-label">电量</span><span class="readout-value" id="bat-r-level">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">充电状态</span><span class="readout-value" id="bat-r-charging">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">充满时间</span><span class="readout-value" id="bat-r-charge-time">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">可用时间</span><span class="readout-value" id="bat-r-discharge-time">--</span></div>' +
          '<div class="module-note">只能读到电量和充放电状态，读不到电池健康度；健康度要看系统设置。</div>'
      );

      var refreshBtn = ctx.root.querySelector('#bat-refresh');
      var note = ctx.root.querySelector('#bat-note');
      var icon = ctx.root.querySelector('#bat-icon');
      var battery = null;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function formatMinutes(seconds) {
        if (seconds === Infinity || seconds == null || isNaN(seconds)) return '—';
        return String(Math.round(seconds / 60)) + ' 分钟';
      }

      function render() {
        if (!battery) return;
        setReadout('#bat-r-level', Math.round(battery.level * 100) + '%');
        setReadout('#bat-r-charging', battery.charging ? '充电中' : '未充电');
        setReadout('#bat-r-charge-time', battery.charging ? formatMinutes(battery.chargingTime) : '—');
        setReadout('#bat-r-discharge-time', battery.charging ? '—' : formatMinutes(battery.dischargingTime));
        icon.classList.toggle('is-on', battery.charging);
        note.textContent = battery.charging
          ? '正在充电，电量 ' + Math.round(battery.level * 100) + '%。'
          : '未充电，电量 ' + Math.round(battery.level * 100) + '%。';
      }

      function onChange() {
        render();
        SC.core.log.add('电池变化：电量 ' + Math.round(battery.level * 100) + '%，' + (battery.charging ? '充电中' : '未充电'));
      }

      refreshBtn.addEventListener('click', function () {
        if (battery) {
          render();
          ctx.toast({ icon: 'battery', title: '已刷新', subtitle: '电量 ' + Math.round(battery.level * 100) + '%' });
        }
      });

      if (typeof navigator.getBattery !== 'function') {
        setReadout('#bat-r-level', '不支持');
        note.textContent = '当前浏览器不支持 Battery Status API。';
        ctx.toast({ icon: 'barrier', title: '不可用', subtitle: '当前浏览器不支持 Battery Status API' });
      } else {
        navigator.getBattery().then(function (manager) {
          battery = manager;
          battery.addEventListener('chargingchange', onChange);
          battery.addEventListener('levelchange', onChange);
          battery.addEventListener('chargingtimechange', onChange);
          battery.addEventListener('dischargingtimechange', onChange);
          render();
        }).catch(function (error) {
          setReadout('#bat-r-level', '读取失败');
          note.textContent = '读取电池失败：' + (error && error.message ? error.message : '未知错误');
          ctx.toast({ icon: 'barrier', title: '读取失败', subtitle: error && error.message ? error.message : '未知错误' });
        });
      }

      ctx.onCleanup(function () {
        if (battery) {
          battery.removeEventListener('chargingchange', onChange);
          battery.removeEventListener('levelchange', onChange);
          battery.removeEventListener('chargingtimechange', onChange);
          battery.removeEventListener('dischargingtimechange', onChange);
        }
        battery = null;
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
