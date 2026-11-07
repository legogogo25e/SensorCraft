/* 顶部 F3 状态栏、全屏、屏幕常亮开关和底部 XP 条。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var hud = (SC.ui.hud = {
    f3Visible: false,
    mode: 'BAG',
    fps: 0,
    init: function () {
      var host = document.getElementById('hud');
      if (!host) return;
      var brand = dom.el('div', { class: 'hud-brand' });
      var cube = dom.el('span', { class: 'hud-cube', html: SC.ui.icons.pickaxe });
      brand.appendChild(cube);
      brand.appendChild(dom.el('span', { text: 'SENSORCRAFT' }));
      brand.appendChild(dom.el('span', { class: 'hud-version', text: 'v' + SC.version }));

      var actions = dom.el('div', { class: 'hud-actions' });
      var f3Btn = dom.el('button', {
        class: 'mc-btn tiny',
        type: 'button',
        id: 'f3-toggle',
        text: 'F3',
        'aria-pressed': 'false'
      });
      var fsBtn = dom.el('button', {
        class: 'mc-btn tiny',
        type: 'button',
        id: 'fullscreen-btn',
        text: '全屏'
      });
      var wakeBtn = dom.el('button', {
        class: 'mc-btn tiny',
        type: 'button',
        id: 'wake-btn',
        text: '常亮',
        'aria-pressed': 'false',
        title: '保持屏幕常亮'
      });
      actions.appendChild(f3Btn);
      actions.appendChild(fsBtn);
      actions.appendChild(wakeBtn);

      var inner = dom.el('div', { class: 'hud-inner' });
      inner.appendChild(brand);
      inner.appendChild(actions);
      host.appendChild(inner);

      var f3 = dom.el('div', { id: 'f3-panel', hidden: true });
      document.getElementById('app').appendChild(f3);

      f3Btn.addEventListener('click', function () {
        hud.f3Visible = !hud.f3Visible;
        f3.hidden = !hud.f3Visible;
        f3Btn.setAttribute('aria-pressed', String(hud.f3Visible));
        hud.updateF3();
      });

      fsBtn.addEventListener('click', function () {
        hud.toggleFullscreen(fsBtn);
      });

      wakeBtn.addEventListener('click', async function () {
        var ok = await SC.core.wakeLock.toggle();
        if (!ok && SC.core.wakeLock.lastError) {
          SC.ui.toast.show({
            icon: 'wakelock',
            title: '常亮不可用',
            subtitle: SC.core.wakeLock.lastError
          });
        }
      });

      SC.core.wakeLock.onChange(function (state) {
        wakeBtn.setAttribute('aria-pressed', String(state.enabled));
        wakeBtn.textContent = state.enabled ? '常亮:开' : '常亮';
        wakeBtn.title = state.supported
          ? state.enabled
            ? '屏幕常亮已开启'
            : '保持屏幕常亮'
          : '此浏览器不支持 Wake Lock';
      });
      SC.core.wakeLock.init();

      document.addEventListener('fullscreenchange', function () {
        fsBtn.textContent = document.fullscreenElement ? '退出' : '全屏';
      });

      hud.startFps();
      hud.updateF3();
      hud.setMode('BAG');
    },
    startFps: function () {
      var frames = 0;
      var last = performance.now();
      function tick(time) {
        frames += 1;
        if (time - last >= 600) {
          hud.fps = Math.round((frames * 1000) / (time - last));
          frames = 0;
          last = time;
          if (hud.f3Visible) hud.updateF3();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    },
    updateF3: function () {
      var f3 = document.getElementById('f3-panel');
      if (!f3) return;
      var summary = SC.core.probe.summary();
      var wake = SC.core.wakeLock.enabled ? 'ON' : 'OFF';
      var lines = [
        'SENSORCRAFT v' + SC.version,
        'secure: ' + (window.isSecureContext !== false ? 'YES' : 'NO'),
        'sensors: ' + summary.ready + ' ready / ' + summary.partial + ' partial / ' + summary.locked + ' locked',
        'total: ' + summary.total + ' cards',
        'view: ' + hud.mode,
        'fps: ' + hud.fps,
        'wake: ' + wake,
        'viewport: ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1)
      ];
      f3.textContent = lines.join('\n');
    },
    setMode: function (mode) {
      hud.mode = mode;
      if (hud.f3Visible) hud.updateF3();
    },
    setXp: function (percent, levelText) {
      var fill = document.getElementById('xp-fill');
      var level = document.getElementById('xp-level');
      if (fill) fill.style.width = dom.clamp(Number(percent) || 0, 0, 100) + '%';
      if (level && levelText) level.textContent = levelText;
    },
    setSecureBanner: function () {
      var banner = document.getElementById('secure-banner');
      if (!banner) return;
      if (window.isSecureContext === false) {
        banner.hidden = false;
        banner.textContent = '警告：当前不是安全上下文（HTTPS/localhost），摄像头、麦克风、定位将不可用。';
      } else {
        banner.hidden = true;
      }
    },
    toggleFullscreen: async function (button) {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          throw new Error('此浏览器不支持网页全屏');
        }
      } catch (error) {
        SC.ui.toast.show({
          icon: 'camera',
          title: '无法进入全屏',
          subtitle: error && error.message ? error.message : '请使用浏览器菜单'
        });
        if (button) button.textContent = '全屏';
      }
    }
  });
})(window.SC = window.SC || {});
