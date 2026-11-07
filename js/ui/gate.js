/* 首次校准门：在用户手势里申请运动/方向权限和屏幕常亮，之后再进入背包。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var KEY = 'sensorcraft-gate-seen';

  var gate = (SC.ui.gate = {
    init: function () {
      var host = document.getElementById('gate');
      if (!host) return;
      var seen = false;
      try {
        seen = sessionStorage.getItem(KEY) === '1';
      } catch (error) {
        seen = false;
      }
      if (seen) {
        host.hidden = true;
        return;
      }
      gate.render(host);
    },
    render: function (host) {
      dom.clear(host);
      var panel = dom.el('div', { class: 'gate-panel', role: 'document' });
      panel.appendChild(dom.el('div', { class: 'gate-head', text: '开始冒险' }));

      var body = dom.el('div', { class: 'gate-body' });
      body.appendChild(
        dom.el('p', {
          html:
            '欢迎来到 <strong>SENSORCRAFT</strong>。这是一个把 iPhone 变成传感器工作台的网页。'
        })
      );
      var list = dom.el('ul', { class: 'gate-list' });
      [
        '运动与姿态权限：iOS 必须由你点一下才允许',
        '屏幕常亮：测量时防止锁屏',
        '摄像头、麦克风、定位：打开对应卡片时再申请'
      ].forEach(function (text) {
        list.appendChild(dom.el('li', { text: text }));
      });
      body.appendChild(list);
      body.appendChild(
        dom.el('p', {
          class: 'module-note',
          text: '拒绝也没关系：仍然可以进入背包，运动类卡片会显示「未授权」。'
        })
      );

      if (window.isSecureContext === false) {
        body.appendChild(
          dom.el('p', {
            class: 'warn-text',
            text: '注意：当前不是 HTTPS/localhost，摄像头、麦克风、定位会被浏览器拒绝。'
          })
        );
      }

      var actions = dom.el('div', { class: 'gate-actions' });
      var later = dom.el('button', { class: 'mc-btn', type: 'button', text: '稍后' });
      var start = dom.el('button', { class: 'mc-btn primary', type: 'button', text: '开始冒险' });
      actions.appendChild(later);
      actions.appendChild(start);
      panel.appendChild(body);
      panel.appendChild(actions);
      host.appendChild(panel);
      host.hidden = false;

      function close(message) {
        try {
          sessionStorage.setItem(KEY, '1');
        } catch (error) {
          /* ignore */
        }
        host.hidden = true;
        if (message) SC.core.log.add(message);
      }

      later.addEventListener('click', function () {
        close('已跳过校准，运动权限将在打开卡片时申请。');
      });

      start.addEventListener('click', async function () {
        start.disabled = true;
        start.textContent = '校准中…';
        var motionPromise = SC.core.permissions.requestMotion();
        var wakePromise = SC.core.wakeLock.request();
        var result = await motionPromise;
        await wakePromise;
        close();
        var ok = result.motion === 'granted' || result.motion === 'unsupported';
        SC.ui.toast.show({
          icon: ok ? 'compass' : 'barrier',
          title: ok ? '校准完成' : '部分权限未开启',
          subtitle: ok ? '运动与姿态传感器已就绪' : '可以稍后在卡片里重新申请'
        });
        SC.core.log.add(
          '校准：motion=' + result.motion + ' orientation=' + result.orientation + ' wake=' + (SC.core.wakeLock.enabled ? 'on' : 'off')
        );
      });

      setTimeout(function () {
        start.focus();
      }, 50);
    }
  });
})(window.SC = window.SC || {});
