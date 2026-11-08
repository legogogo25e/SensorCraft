/* 震动反馈：用 Vibration API 让手机马达按指定节奏震动。
 * iOS Safari 会忽略这个调用；桌面 / Android Chrome 支持。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'vibration',
    name: '震动反馈',
    en: 'VIBRATION',
    group: '交互与输出',
    icon: 'vibration',
    probe: function (feature) {
      if (!feature.vibration) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS Safari 会忽略 Vibration API，网页叫不动震动马达。' };
        }
        return { status: 'locked', reason: '当前浏览器不支持 Vibration API（桌面 / Android Chrome 支持）。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-vibration">' +
        '<div class="big-icon-stage"><div class="big-icon" id="vib-icon">' +
        SC.ui.icons.vibration +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="vib-short">短震 100ms</button>' +
        '<button class="mc-btn" type="button" id="vib-long">长震 500ms</button>' +
        '<button class="mc-btn" type="button" id="vib-pattern">节奏震动</button>' +
        '<button class="mc-btn" type="button" id="vib-stop">停止</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="vib-note">点一个按钮试一试。桌面电脑没有马达，点了也不会震，但会显示调用结果。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>震动马达</span><span>VIBRATION</span></div>' +
          '<div class="readout-row"><span class="readout-label">支持</span><span class="readout-value" id="vib-r-support">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">上次模式</span><span class="readout-value" id="vib-r-last">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">调用结果</span><span class="readout-value" id="vib-r-result">--</span></div>' +
          '<div class="module-note">节奏是「震 100ms、停 100ms、震 200ms」；强度调不了，网页只能控制震多久、停多久。</div>'
      );

      var shortBtn = ctx.root.querySelector('#vib-short');
      var longBtn = ctx.root.querySelector('#vib-long');
      var patternBtn = ctx.root.querySelector('#vib-pattern');
      var stopBtn = ctx.root.querySelector('#vib-stop');
      var note = ctx.root.querySelector('#vib-note');
      var icon = ctx.root.querySelector('#vib-icon');
      var supported = typeof navigator.vibrate === 'function';

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      setReadout('#vib-r-support', supported ? '支持' : '不支持');

      function vibrate(pattern, label) {
        if (!supported) {
          setReadout('#vib-r-result', '不支持');
          note.textContent = '当前浏览器不支持 Vibration API。';
          ctx.toast({ icon: 'barrier', title: '不可用', subtitle: '当前浏览器不支持 Vibration API' });
          return;
        }
        var ok = false;
        try {
          ok = navigator.vibrate(pattern);
        } catch (error) {
          setReadout('#vib-r-result', '调用失败');
          note.textContent = '震动调用失败：' + (error && error.message ? error.message : '未知错误');
          ctx.toast({ icon: 'barrier', title: '震动失败', subtitle: error && error.message ? error.message : '未知错误' });
          return;
        }
        setReadout('#vib-r-last', label);
        setReadout('#vib-r-result', ok ? '已执行' : '被忽略');
        icon.classList.toggle('is-on', ok);
        note.textContent = ok ? label + '：已发出震动请求。' : label + '：浏览器接受了调用但没有执行（例如设备没有马达）。';
        if (ok) {
          ctx.toast({ icon: 'vibration', title: '成就达成！', subtitle: label + '已发出' });
          SC.core.log.add('震动：' + label);
        }
      }

      shortBtn.addEventListener('click', function () { vibrate(100, '短震 100ms'); });
      longBtn.addEventListener('click', function () { vibrate(500, '长震 500ms'); });
      patternBtn.addEventListener('click', function () { vibrate([100, 100, 200], '节奏 [100, 100, 200]'); });
      stopBtn.addEventListener('click', function () {
        if (supported) {
          try { navigator.vibrate(0); } catch (error) { /* 停止失败也不报错 */ }
        }
        icon.classList.remove('is-on');
        setReadout('#vib-r-last', '已停止');
        setReadout('#vib-r-result', '已停止');
        note.textContent = '已停止震动。';
      });

      ctx.onCleanup(function () {
        if (supported) {
          try { navigator.vibrate(0); } catch (error) { /* 离开时尽力停止 */ }
        }
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
