/* Web Bluetooth：扫描并连接附近的蓝牙低功耗设备，列出服务。
 * iOS Safari 不提供 Web Bluetooth；桌面 / Android Chrome 支持。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'bluetooth',
    name: 'Web Bluetooth',
    en: 'BLUETOOTH',
    group: '连接与传输',
    icon: 'bluetooth',
    probe: function (feature) {
      if (!feature.bluetooth) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS Safari 不支持 Web Bluetooth，网页不能直接连接心率带或 Arduino。' };
        }
        return { status: 'locked', reason: '当前浏览器不支持 Web Bluetooth（桌面 / Android Chrome 支持）。' };
      }
      return { status: 'partial', reason: '点「扫描设备」，在系统弹窗里选一台蓝牙设备。' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-bluetooth">' +
        '<div class="big-icon-stage"><div class="big-icon" id="bt-icon">' +
        SC.ui.icons.bluetooth +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="bt-scan">扫描设备</button>' +
        '<button class="mc-btn" type="button" id="bt-disconnect" disabled>断开连接</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="bt-note">还没开始：点「扫描设备」，在系统弹窗里选一台蓝牙设备（如心率带、Arduino）。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>蓝牙电台</span><span>BLUETOOTH</span></div>' +
          '<div class="readout-row"><span class="readout-label">设备</span><span class="readout-value" id="bt-r-device">未连接</span></div>' +
          '<div class="readout-row"><span class="readout-label">设备 ID</span><span class="readout-value" id="bt-r-id">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">服务</span><span class="readout-value" id="bt-r-services">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="bt-r-state">未连接</span></div>' +
          '<div class="module-note">只列出设备提供的服务 UUID，不读具体数值；想读心率等数值，要在扫描时声明对应的服务。</div>'
      );

      var scanBtn = ctx.root.querySelector('#bt-scan');
      var disconnectBtn = ctx.root.querySelector('#bt-disconnect');
      var note = ctx.root.querySelector('#bt-note');
      var icon = ctx.root.querySelector('#bt-icon');
      var device = null;
      var connected = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function fail(message) {
        setReadout('#bt-r-state', '失败：' + message);
        note.textContent = message;
        ctx.toast({ icon: 'barrier', title: '蓝牙失败', subtitle: message });
        SC.core.log.add('蓝牙失败：' + message);
      }

      function onDisconnect() {
        connected = false;
        device = null;
        icon.classList.remove('is-on');
        disconnectBtn.disabled = true;
        setReadout('#bt-r-device', '未连接');
        setReadout('#bt-r-id', '--');
        setReadout('#bt-r-services', '--');
        setReadout('#bt-r-state', '已断开');
        note.textContent = '已断开。点「扫描设备」可以再连一台。';
      }

      scanBtn.addEventListener('click', async function () {
        if (!navigator.bluetooth) {
          fail('当前浏览器不支持 Web Bluetooth。');
          return;
        }
        scanBtn.disabled = true;
        note.textContent = '正在等你在系统弹窗里选设备…';
        try {
          device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
        } catch (error) {
          scanBtn.disabled = false;
          if (error && error.name === 'NotFoundError') {
            note.textContent = '你取消了选择，没有连上任何设备。';
            return;
          }
          fail(error && error.message ? error.message : '选择设备失败。');
          return;
        }
        setReadout('#bt-r-device', device.name || '(未命名设备)');
        setReadout('#bt-r-id', device.id || '--');
        setReadout('#bt-r-state', '已选设备，正在连接…');
        try {
          var server = await device.gatt.connect();
          connected = true;
          icon.classList.add('is-on');
          disconnectBtn.disabled = false;
          setReadout('#bt-r-state', '已连接');
          note.textContent = '已连接 ' + (device.name || '(未命名设备)') + '，正在读服务列表…';
          try {
            var services = await server.getPrimaryServices();
            var uuids = services.map(function (service) { return service.uuid; });
            setReadout('#bt-r-services', uuids.length ? uuids.join(', ') : '没有读到服务');
            note.textContent = '已连接。服务列表如右；读具体数值要在扫描时声明对应服务。';
          } catch (serviceError) {
            setReadout('#bt-r-services', '读不到（扫描时未声明服务）');
            note.textContent = '已连接，但服务列表读不到：要在 requestDevice 时声明 optionalServices 才能列出。';
            SC.core.log.add('蓝牙服务读取失败：' + (serviceError && serviceError.message ? serviceError.message : serviceError));
          }
          device.addEventListener('gattserverdisconnected', onDisconnect);
          ctx.toast({ icon: 'bluetooth', title: '成就达成！', subtitle: '蓝牙已连接：' + (device.name || '(未命名设备)') });
        } catch (error) {
          fail('连接失败：' + (error && error.message ? error.message : '未知错误'));
        }
        scanBtn.disabled = false;
      });

      disconnectBtn.addEventListener('click', function () {
        try {
          if (device && device.gatt && device.gatt.connected) device.gatt.disconnect();
        } catch (error) {
          SC.core.log.add('蓝牙断开失败：' + (error && error.message ? error.message : error));
        }
        onDisconnect();
      });

      ctx.onCleanup(function () {
        try {
          if (device && device.gatt && device.gatt.connected) device.gatt.disconnect();
        } catch (error) {
          /* 离开卡片时尽力断开，失败也不报错 */
        }
        device = null;
        connected = false;
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
