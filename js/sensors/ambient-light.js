/* 环境光传感器：读 AmbientLightSensor，显示照度（lux）。
 * iOS 不暴露；Android Chrome 需在 chrome://flags 打开 Generic Sensor 实验特性。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'ambient-light',
    name: '环境光传感器',
    en: 'AMBIENT LIGHT',
    group: '运动与环境',
    icon: 'ambientLight',
    probe: function (feature) {
      if (!feature.ambientLight) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS 不暴露环境光传感器，网页读不到照度。' };
        }
        return { status: 'locked', reason: '当前浏览器没有暴露 AmbientLightSensor；Android Chrome 需在 chrome://flags 打开 Generic Sensor 实验特性。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-ambient-light">' +
        '<div class="big-icon-stage"><div class="big-icon" id="al-icon">' +
        SC.ui.icons.ambientLight +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="al-start">开始测量</button>' +
        '<button class="mc-btn" type="button" id="al-stop" disabled>停止</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="al-note">还没开始：点「开始测量」，传感器会实时报照度。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>光线</span><span>LIGHT</span></div>' +
          '<div class="readout-row"><span class="readout-label">照度</span><span class="readout-value" id="al-r-lux">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">亮度等级</span><span class="readout-value" id="al-r-level">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="al-r-state">未测量</span></div>' +
          '<div class="module-note">参考：月光约 0.1 lux，室内一般 100–500 lux，晴天户外可超过 10000 lux。</div>'
      );

      var startBtn = ctx.root.querySelector('#al-start');
      var stopBtn = ctx.root.querySelector('#al-stop');
      var note = ctx.root.querySelector('#al-note');
      var icon = ctx.root.querySelector('#al-icon');
      var sensor = null;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function levelFor(lux) {
        if (lux < 1) return '漆黑';
        if (lux < 50) return '很暗';
        if (lux < 200) return '偏暗';
        if (lux < 1000) return '室内明亮';
        if (lux < 10000) return '很亮';
        return '阳光直射';
      }

      function onReading() {
        if (!sensor) return;
        var lux = sensor.illuminance;
        setReadout('#al-r-lux', (lux == null ? '--' : String(lux) + ' lux'));
        setReadout('#al-r-level', lux == null ? '--' : levelFor(lux));
        setReadout('#al-r-state', '测量中');
      }

      function onError(event) {
        var message = (event && event.error && event.error.message) || '传感器出错';
        setReadout('#al-r-state', '失败：' + message);
        note.textContent = '传感器出错：' + message + '。Android 上请确认已在 chrome://flags 打开 Generic Sensor。';
        ctx.toast({ icon: 'barrier', title: '环境光失败', subtitle: message });
      }

      function stop() {
        if (sensor) {
          try { sensor.removeEventListener('reading', onReading); } catch (e) { /* 已移除 */ }
          try { sensor.removeEventListener('error', onError); } catch (e) { /* 已移除 */ }
          try { sensor.stop(); } catch (e) { /* 已停止 */ }
          sensor = null;
        }
        icon.classList.remove('is-on');
        stopBtn.disabled = true;
        startBtn.disabled = false;
        setReadout('#al-r-state', '已停止');
        note.textContent = '已停止。点「开始测量」可以再测。';
      }

      startBtn.addEventListener('click', function () {
        if (typeof AmbientLightSensor === 'undefined') {
          setReadout('#al-r-state', '失败：不支持');
          note.textContent = '当前浏览器没有 AmbientLightSensor。Android Chrome 需在 chrome://flags 打开 Generic Sensor 实验特性。';
          ctx.toast({ icon: 'barrier', title: '不可用', subtitle: '当前浏览器不支持环境光传感器' });
          return;
        }
        try {
          sensor = new AmbientLightSensor();
        } catch (error) {
          setReadout('#al-r-state', '失败：' + (error && error.name ? error.name : '创建失败'));
          note.textContent = '创建传感器失败：' + (error && error.message ? error.message : '未知错误');
          ctx.toast({ icon: 'barrier', title: '创建失败', subtitle: error && error.message ? error.message : '未知错误' });
          return;
        }
        sensor.addEventListener('reading', onReading);
        sensor.addEventListener('error', onError);
        try {
          sensor.start();
        } catch (error) {
          stop();
          setReadout('#al-r-state', '失败：' + (error && error.name ? error.name : '启动失败'));
          note.textContent = '启动传感器失败：' + (error && error.message ? error.message : '未知错误') + '。Android 上请确认已在 chrome://flags 打开 Generic Sensor。';
          ctx.toast({ icon: 'barrier', title: '启动失败', subtitle: error && error.message ? error.message : '未知错误' });
          return;
        }
        icon.classList.add('is-on');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setReadout('#al-r-state', '测量中');
        note.textContent = '测量中：照度会实时更新，把手机拿到亮处、暗处试试。';
        ctx.toast({ icon: 'ambientLight', title: '成就达成！', subtitle: '环境光测量已开始' });
      });

      stopBtn.addEventListener('click', function () {
        stop();
      });

      ctx.onCleanup(function () {
        if (sensor) {
          try { sensor.removeEventListener('reading', onReading); } catch (e) { /* 已移除 */ }
          try { sensor.removeEventListener('error', onError); } catch (e) { /* 已移除 */ }
          try { sensor.stop(); } catch (e) { /* 已停止 */ }
          sensor = null;
        }
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
