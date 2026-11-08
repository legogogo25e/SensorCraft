/* Web NFC：碰一碰读 NFC 标签（NDEF），显示标签号和文本记录。
 * iOS Safari 不提供 Web NFC；Android Chrome 支持。 */
(function (SC) {
  'use strict';

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'nfc',
    name: 'NFC',
    en: 'NFC',
    group: '连接与传输',
    icon: 'nfc',
    probe: function (feature) {
      if (!feature.nfc) {
        if (isIOS()) {
          return { status: 'locked', reason: 'iOS Safari 不支持 Web NFC，网页读不到碰一碰的标签。' };
        }
        return { status: 'locked', reason: '当前浏览器不支持 Web NFC（Android Chrome 支持）。' };
      }
      return { status: 'partial', reason: '点「开始扫描」，再把手机靠近一张 NFC 标签。' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-nfc">' +
        '<div class="big-icon-stage"><div class="big-icon" id="nfc-icon">' +
        SC.ui.icons.nfc +
        '</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="nfc-scan">开始扫描</button>' +
        '<button class="mc-btn" type="button" id="nfc-stop" disabled>停止扫描</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="nfc-note">还没开始：点「开始扫描」，再把手机背面靠近一张 NFC 标签（几厘米内）。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>碰一碰</span><span>NFC</span></div>' +
          '<div class="readout-row"><span class="readout-label">标签 ID</span><span class="readout-value" id="nfc-r-id">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">记录数</span><span class="readout-value" id="nfc-r-count">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">文本记录</span><span class="readout-value" id="nfc-r-text">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="nfc-r-state">未扫描</span></div>' +
          '<div class="module-note">只能读公开的 NDEF 标签；门禁卡、交通卡一般读不到内容，只能看到标签号。</div>'
      );

      var scanBtn = ctx.root.querySelector('#nfc-scan');
      var stopBtn = ctx.root.querySelector('#nfc-stop');
      var note = ctx.root.querySelector('#nfc-note');
      var icon = ctx.root.querySelector('#nfc-icon');
      var reader = null;
      var aborter = null;
      var scanning = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function fail(message) {
        setReadout('#nfc-r-state', '失败：' + message);
        note.textContent = message;
        ctx.toast({ icon: 'barrier', title: 'NFC 失败', subtitle: message });
        SC.core.log.add('NFC 失败：' + message);
      }

      function stopScan(silent) {
        scanning = false;
        icon.classList.remove('is-on');
        stopBtn.disabled = true;
        scanBtn.disabled = false;
        try {
          if (aborter) aborter.abort();
        } catch (error) {
          /* 已停止 */
        }
        aborter = null;
        if (!silent) {
          setReadout('#nfc-r-state', '已停止');
          note.textContent = '已停止扫描。点「开始扫描」可以再扫。';
        }
      }

      scanBtn.addEventListener('click', async function () {
        if (typeof NDEFReader === 'undefined') {
          fail('当前浏览器不支持 Web NFC。');
          return;
        }
        scanBtn.disabled = true;
        note.textContent = '正在启动扫描…';
        try {
          reader = new NDEFReader();
          aborter = new AbortController();
          reader.onreading = function (event) {
            setReadout('#nfc-r-id', event.serialNumber || '--');
            var records = event.message ? event.message.records : [];
            setReadout('#nfc-r-count', String(records.length));
            var texts = [];
            records.forEach(function (record) {
              if (record.recordType === 'text' && record.data) {
                try {
                  texts.push(new TextDecoder(record.encoding || 'utf-8').decode(record.data));
                } catch (error) {
                  texts.push('(解码失败)');
                }
              } else if (record.recordType === 'url' && record.data) {
                try {
                  texts.push(new TextDecoder().decode(record.data));
                } catch (error) {
                  texts.push('(解码失败)');
                }
              } else {
                texts.push('(' + record.recordType + ')');
              }
            });
            setReadout('#nfc-r-text', texts.length ? texts.join('；') : '（无文本记录）');
            setReadout('#nfc-r-state', '已读到标签');
            note.textContent = '读到标签 ' + (event.serialNumber || '') + '，再碰一张会更新。';
            ctx.toast({ icon: 'nfc', title: '成就达成！', subtitle: 'NFC 读到标签' });
          };
          reader.onreadingerror = function () {
            setReadout('#nfc-r-state', '读取出错');
            note.textContent = '标签靠得太远或读不出来，拿稳一点再试一次。';
            ctx.toast({ icon: 'barrier', title: 'NFC 读取出错', subtitle: '标签太远或无法读取' });
          };
          await reader.scan({ signal: aborter.signal });
          scanning = true;
          icon.classList.add('is-on');
          stopBtn.disabled = false;
          setReadout('#nfc-r-state', '扫描中…');
          note.textContent = '扫描中：把手机背面靠近一张 NFC 标签。';
        } catch (error) {
          scanning = false;
          scanBtn.disabled = false;
          if (error && error.name === 'AbortError') {
            note.textContent = '扫描已停止。';
            return;
          }
          if (error && error.name === 'NotAllowedError') {
            fail('NFC 权限被拒绝：请在浏览器设置里允许 NFC。');
            return;
          }
          fail(error && error.message ? error.message : '启动扫描失败。');
        }
      });

      stopBtn.addEventListener('click', function () {
        stopScan(false);
      });

      ctx.onCleanup(function () {
        scanning = false;
        try {
          if (aborter) aborter.abort();
        } catch (error) {
          /* 离开卡片时尽力停止 */
        }
        aborter = null;
        reader = null;
      });
      ctx.setStatus('READY', '');
    }
  });
})(window.SC = window.SC || {});
