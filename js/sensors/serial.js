/* Web Serial：用 USB 串口连 Arduino / micro:bit，读回传感器数据。
 * iOS 不提供 Web Serial；桌面 Chrome 支持，Android Chrome 不支持。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'serial',
    name: 'USB / 串口',
    en: 'WEB SERIAL',
    group: '连接与传输',
    icon: 'serial',
    probe: function (feature) {
      if (!feature.serial) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS 不支持 Web Serial，网页不能直连 Arduino / micro:bit。' };
        }
        return { status: 'locked', reason: '当前浏览器不支持 Web Serial（桌面 Chrome 支持）。' };
      }
      return { status: 'partial', reason: '点「选择串口」，在系统弹窗里选一个已接上的设备。' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-serial">' +
        '<div class="big-icon-stage"><div class="big-icon" id="ser-icon">' +
        SC.ui.icons.serial +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="ser-pick">选择串口</button>' +
        '<button class="mc-btn" type="button" id="ser-disconnect" disabled>断开</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="ser-note">还没开始：先用 USB 线接好 Arduino / micro:bit，再点「选择串口」。</span>' +
        '</div>' +
        '<div class="module-note">收到的原始数据：</div>' +
        '<div class="log-box" id="ser-log" style="max-height:120px;overflow:auto;white-space:pre-wrap;">（暂无数据）</div>' +
        '</div>';

      ctx.setReadout(
        '<div class="readout-title"><span>串口电报机</span><span>SERIAL</span></div>' +
          '<div class="readout-row"><span class="readout-label">端口</span><span class="readout-value" id="ser-r-port">未连接</span></div>' +
          '<div class="readout-row"><span class="readout-label">波特率</span><span class="readout-value" id="ser-r-baud">9600 bps</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="ser-r-state">未连接</span></div>' +
          '<div class="readout-row"><span class="readout-label">最近数据</span><span class="readout-value" id="ser-r-data">--</span></div>' +
          '<div class="module-note">波特率固定 9600，和大多数 Arduino 示例程序一致；设备发来的每行都会显示在左边的框里。</div>'
      );

      var pickBtn = ctx.root.querySelector('#ser-pick');
      var disconnectBtn = ctx.root.querySelector('#ser-disconnect');
      var note = ctx.root.querySelector('#ser-note');
      var logBox = ctx.root.querySelector('#ser-log');
      var icon = ctx.root.querySelector('#ser-icon');
      var port = null;
      var reader = null;
      var reading = false;
      var closed = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function fail(message) {
        setReadout('#ser-r-state', '失败：' + message);
        note.textContent = message;
        ctx.toast({ icon: 'barrier', title: '串口失败', subtitle: message });
        SC.core.log.add('串口失败：' + message);
      }

      function appendLog(text) {
        if (logBox.textContent === '（暂无数据）') logBox.textContent = '';
        logBox.textContent += text;
        logBox.scrollTop = logBox.scrollHeight;
      }

      async function readLoop() {
        var decoder = new TextDecoder();
        try {
          while (port && port.readable && !closed) {
            reader = port.readable.getReader();
            try {
              for (;;) {
                var result = await reader.read();
                if (result.done) break;
                var text = decoder.decode(result.value, { stream: true });
                if (text) {
                  setReadout('#ser-r-data', text.slice(-80));
                  appendLog(text);
                }
              }
            } catch (error) {
              if (!closed) fail('读取中断：' + (error && error.message ? error.message : '未知错误'));
              break;
            } finally {
              try { reader.releaseLock(); } catch (e) { /* 已释放 */ }
              reader = null;
            }
          }
        } catch (error) {
          if (!closed) fail('读取失败：' + (error && error.message ? error.message : '未知错误'));
        }
      }

      async function disconnect() {
        closed = true;
        try {
          if (reader) {
            try { await reader.cancel(); } catch (e) { /* 已取消 */ }
          }
        } catch (error) {
          /* 尽力取消 */
        }
        try {
          if (port) await port.close();
        } catch (error) {
          SC.core.log.add('串口关闭失败：' + (error && error.message ? error.message : error));
        }
        port = null;
        reader = null;
        reading = false;
        icon.classList.remove('is-on');
        disconnectBtn.disabled = true;
        pickBtn.disabled = false;
        setReadout('#ser-r-port', '未连接');
        setReadout('#ser-r-state', '已断开');
        setReadout('#ser-r-data', '--');
        note.textContent = '已断开。点「选择串口」可以再连一个设备。';
      }

      pickBtn.addEventListener('click', async function () {
        if (!navigator.serial) {
          fail('当前浏览器不支持 Web Serial。');
          return;
        }
        pickBtn.disabled = true;
        note.textContent = '正在等你在系统弹窗里选串口…';
        try {
          port = await navigator.serial.requestPort();
        } catch (error) {
          pickBtn.disabled = false;
          if (error && error.name === 'NotFoundError') {
            note.textContent = '你取消了选择，没有连上任何串口。';
            return;
          }
          fail(error && error.message ? error.message : '选择串口失败。');
          return;
        }
        try {
          await port.open({ baudRate: 9600 });
        } catch (error) {
          port = null;
          pickBtn.disabled = false;
          fail('打开串口失败：' + (error && error.message ? error.message : '未知错误'));
          return;
        }
        closed = false;
        reading = true;
        icon.classList.add('is-on');
        disconnectBtn.disabled = false;
        var info = port.getInfo ? port.getInfo() : {};
        setReadout('#ser-r-port', 'USB ' + (info.usbVendorId ? '0x' + info.usbVendorId.toString(16) : '设备'));
        setReadout('#ser-r-state', '已连接');
        note.textContent = '已连接，波特率 9600，正在等设备发数据…';
        ctx.toast({ icon: 'serial', title: '成就达成！', subtitle: '串口已连接，波特率 9600' });
        readLoop();
      });

      disconnectBtn.addEventListener('click', function () {
        disconnect();
      });

      ctx.onCleanup(function () {
        closed = true;
        try {
          if (reader) reader.cancel().catch(function () { /* 已取消 */ });
        } catch (error) {
          /* 离开卡片时尽力取消 */
        }
        try {
          if (port) port.close().catch(function () { /* 已关闭 */ });
        } catch (error) {
          /* 离开卡片时尽力关闭 */
        }
        port = null;
        reader = null;
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
