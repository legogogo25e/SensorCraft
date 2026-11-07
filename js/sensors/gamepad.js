/* 游戏手柄：轮询 Gamepad API，显示 16 键、双摇杆、LT/RT 扳机，并尝试震动测试。 */
(function (SC) {
  'use strict';
  var fmt = SC.core.format;

  SC.registerSensor({
    id: 'gamepad',
    name: '游戏手柄',
    en: 'GAMEPAD',
    group: '交互与输出',
    icon: 'gamepad',
    probe: function (feature) {
      if (!feature.gamepad) {
        return { status: 'locked', reason: '当前浏览器不支持 Gamepad API。' };
      }
      return {
        status: 'partial',
        reason: '先在系统蓝牙里连接 PS/Xbox 手柄，再按一下手柄按键唤醒。'
      };
    },
    mount: function (ctx) {
      var buttons = '';
      for (var i = 0; i < 16; i += 1) {
        buttons += '<div class="pad-key" data-button="' + i + '">' + i + '</div>';
      }

      ctx.root.innerHTML =
        '<div class="module module-gamepad">' +
        '<div class="pad-layout">' +
        '<div class="pad-grid" id="pad-grid">' + buttons + '</div>' +
        '<div>' +
        '<div class="pad-stick" id="pad-stick-0"><div class="pad-dot" id="pad-dot-0"></div></div>' +
        '<div class="pad-stick" id="pad-stick-1"><div class="pad-dot" id="pad-dot-1"></div></div>' +
        '<div class="empty-state" id="pad-empty" style="min-height:40px;margin-top:8px;padding:8px;font-size:11px">未连接手柄</div>' +
        '</div>' +
        '</div>' +
        '<div class="axis-list" style="margin-top:8px">' +
        '<div class="axis-row"><span class="axis-name">LT</span><div class="meter"><div class="meter-fill red" id="pad-lt"></div></div><span class="axis-num" id="pad-lt-val">0.00</span></div>' +
        '<div class="axis-row"><span class="axis-name">RT</span><div class="meter"><div class="meter-fill red" id="pad-rt"></div></div><span class="axis-num" id="pad-rt-val">0.00</span></div>' +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="pad-rumble">震动测试</button>' +
        '<span class="module-note" id="pad-note">连接手柄后按任意键。网页不直接控制蓝牙。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>命令方块控制器</span><span>COMMAND BLOCK</span></div>' +
          '<div class="readout-row"><span class="readout-label">名称</span><span class="readout-value" id="pad-r-name">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">ID</span><span class="readout-value" id="pad-r-id">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">按键 / 轴</span><span class="readout-value" id="pad-r-counts">-- / --</span></div>' +
          '<div class="readout-row"><span class="readout-label">震动</span><span class="readout-value" id="pad-r-rumble">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="pad-r-status">未连接</span></div>' +
          '<div class="module-note">摇杆值以红石信号 0–15 显示。</div>'
      );

      var grid = ctx.root.querySelector('#pad-grid');
      var dot0 = ctx.root.querySelector('#pad-dot-0');
      var dot1 = ctx.root.querySelector('#pad-dot-1');
      var ltBar = ctx.root.querySelector('#pad-lt');
      var ltVal = ctx.root.querySelector('#pad-lt-val');
      var rtBar = ctx.root.querySelector('#pad-rt');
      var rtVal = ctx.root.querySelector('#pad-rt-val');
      var empty = ctx.root.querySelector('#pad-empty');
      var note = ctx.root.querySelector('#pad-note');
      var rumbleBtn = ctx.root.querySelector('#pad-rumble');
      var currentPad = null;
      var connectedSeen = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function activeGamepad() {
        var pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (var i = 0; i < pads.length; i += 1) {
          if (pads[i]) return pads[i];
        }
        return null;
      }

      function render(pad) {
        currentPad = pad;
        var keys = grid.querySelectorAll('.pad-key');
        for (var i = 0; i < keys.length; i += 1) {
          var button = pad && pad.buttons[i];
          var on = !!button && (button.pressed || button.value > 0.5);
          keys[i].classList.toggle('is-on', on);
        }
        if (pad) {
          empty.style.display = 'none';
          var x = pad.axes[0] || 0;
          var y = pad.axes[1] || 0;
          var x2 = pad.axes[2] || 0;
          var y2 = pad.axes[3] || 0;
          dot0.style.transform = 'translate(' + x * 42 + 'px,' + y * 42 + 'px)';
          dot1.style.transform = 'translate(' + x2 * 42 + 'px,' + y2 * 42 + 'px)';
          var lt = pad.buttons[6] ? pad.buttons[6].value : 0;
          var rt = pad.buttons[7] ? pad.buttons[7].value : 0;
          ltBar.style.width = Math.round(lt * 100) + '%';
          rtBar.style.width = Math.round(rt * 100) + '%';
          ltVal.textContent = lt.toFixed(2);
          rtVal.textContent = rt.toFixed(2);
          note.textContent = '已连接：' + pad.id;
          setReadout('#pad-r-name', pad.id.split('(')[0].trim());
          setReadout('#pad-r-id', pad.id);
          setReadout('#pad-r-counts', pad.buttons.length + ' / ' + pad.axes.length);
          setReadout('#pad-r-rumble', pad.vibrationActuator ? '可用' : '不可用');
          setReadout('#pad-r-status', '已连接');
          if (!connectedSeen) {
            connectedSeen = true;
            ctx.toast({ icon: 'gamepad', title: '成就达成！', subtitle: '召唤坐骑：检测到游戏手柄' });
          }
        } else {
          empty.style.display = '';
          dot0.style.transform = 'translate(0px,0px)';
          dot1.style.transform = 'translate(0px,0px)';
          ltBar.style.width = '0%';
          rtBar.style.width = '0%';
          ltVal.textContent = '0.00';
          rtVal.textContent = '0.00';
          note.textContent = '未连接。先在系统蓝牙里连接 PS/Xbox 手柄，再按任意键。';
          setReadout('#pad-r-name', '--');
          setReadout('#pad-r-id', '--');
          setReadout('#pad-r-counts', '-- / --');
          setReadout('#pad-r-rumble', '--');
          setReadout('#pad-r-status', '未连接');
        }
      }

      ctx.raf(function () {
        render(activeGamepad());
      });

      ctx.listen(window, 'gamepadconnected', function (event) {
        ctx.toast({ icon: 'gamepad', title: '手柄已连接', subtitle: (event.gamepad && event.gamepad.id) || '' });
        SC.core.log.add('游戏手柄已连接');
      });
      ctx.listen(window, 'gamepaddisconnected', function () {
        connectedSeen = false;
        SC.core.log.add('游戏手柄已断开');
      });

      rumbleBtn.addEventListener('click', function () {
        if (!currentPad || !currentPad.vibrationActuator) {
          ctx.toast({ icon: 'gamepad', title: '震动不可用', subtitle: '此手柄或浏览器没有 vibrationActuator' });
          return;
        }
        var actuator = currentPad.vibrationActuator;
        var effect = { startDelay: 0, duration: 300, weakMagnitude: 1, strongMagnitude: 1 };
        var result = actuator.playEffect ? actuator.playEffect('dual-rumble', effect) : null;
        if (!result && actuator.pulse) result = actuator.pulse(1, 300);
        if (result && result.catch) {
          result.catch(function (error) {
            ctx.toast({ icon: 'gamepad', title: '震动失败', subtitle: error && error.message ? error.message : '设备拒绝' });
          });
        }
        ctx.toast({ icon: 'gamepad', title: '震动测试', subtitle: '如果手柄支持，会震动 300ms' });
      });

      render(activeGamepad());
    }
  });
})(window.SC = window.SC || {});
