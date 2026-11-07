/* WebGPU：请求适配器并展示后端/特性/限制；支持高性能偏好、展开全部和复制信息。 */
(function (SC) {
  'use strict';

  SC.registerSensor({
    id: 'webgpu',
    name: 'WebGPU',
    en: 'WEBGPU',
    group: '计算与身份',
    icon: 'webgpu',
    probe: function (feature) {
      if (!feature.webgpu) {
        return {
          status: 'locked',
          reason: '当前浏览器没有 navigator.gpu。iOS 需要 26+，且可能要在 Safari 实验特性里开启。'
        };
      }
      if (!feature.secure) {
        return { status: 'locked', reason: 'WebGPU 需要 HTTPS 或 localhost。' };
      }
      return { status: 'partial', reason: '浏览器暴露了 WebGPU，但适配器可能仍不可用，需要实际请求。' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-webgpu">' +
        '<div class="big-icon-stage"><div class="big-icon" id="gpu-icon">' +
        SC.ui.icons.webgpu +
        '</div></div>' +
        '<div class="enchant-lines" id="gpu-lines"><div class="enchant-line">正在请求适配器…</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="gpu-retry">重新请求适配器</button>' +
        '<button class="mc-btn" type="button" id="gpu-expand">展开全部</button>' +
        '<button class="mc-btn" type="button" id="gpu-copy">复制信息</button>' +
        '<button class="lever" type="button" id="gpu-power" aria-pressed="false">' +
        '<span class="lever-base"><span class="lever-knob"></span></span>' +
        '<span class="lever-label">高性能</span></button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="gpu-note"></span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>附魔台</span><span>ENCHANTING</span></div>' +
          '<div class="readout-row"><span class="readout-label">navigator.gpu</span><span class="readout-value" id="gpu-r-api">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">适配器</span><span class="readout-value" id="gpu-r-adapter">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">后端</span><span class="readout-value" id="gpu-r-backend">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">特性数</span><span class="readout-value" id="gpu-r-features">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">电源偏好</span><span class="readout-value" id="gpu-r-power">低功耗</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="gpu-r-status">检测中</span></div>' +
          '<div class="module-note">这里只读取能力和限制，不进行渲染或计算。</div>'
      );

      var lines = ctx.root.querySelector('#gpu-lines');
      var note = ctx.root.querySelector('#gpu-note');
      var retry = ctx.root.querySelector('#gpu-retry');
      var expandBtn = ctx.root.querySelector('#gpu-expand');
      var copyBtn = ctx.root.querySelector('#gpu-copy');
      var powerLever = ctx.root.querySelector('#gpu-power');
      var allLines = [];
      var expanded = false;
      var highPerformance = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function renderLines() {
        lines.innerHTML = '';
        var items = expanded ? allLines : allLines.slice(0, 14);
        items.forEach(function (text) {
          var line = document.createElement('div');
          line.className = 'enchant-line';
          line.textContent = text;
          lines.appendChild(line);
        });
        if (!allLines.length) {
          var empty = document.createElement('div');
          empty.className = 'enchant-line';
          empty.textContent = '没有可显示的附魔。';
          lines.appendChild(empty);
        }
        if (allLines.length > 14) {
          expandBtn.hidden = false;
          expandBtn.textContent = expanded ? '收起' : '展开全部 (' + allLines.length + ')';
        } else {
          expandBtn.hidden = true;
        }
      }

      function setLines(items) {
        allLines = items;
        renderLines();
      }

      async function detect() {
        setReadout('#gpu-r-api', navigator.gpu ? '存在' : '不存在');
        setReadout('#gpu-r-power', highPerformance ? '高性能' : '低功耗');
        setReadout('#gpu-r-status', '请求中');
        note.textContent = '正在请求适配器…';
        if (!navigator.gpu) {
          setLines(['navigator.gpu 不存在', 'iOS 26+ 且需 HTTPS', '可能需要开启实验特性']);
          note.textContent = '当前浏览器没有 WebGPU。';
          setReadout('#gpu-r-status', '不可用');
          ctx.setStatus('LOCKED', 'locked');
          return;
        }
        try {
          var adapter = await navigator.gpu.requestAdapter({
            powerPreference: highPerformance ? 'high-performance' : 'low-power'
          });
          if (!adapter) {
            setLines(['requestAdapter() 返回 null', 'GPU 可能被系统关闭', '或设备不支持']);
            note.textContent = '浏览器有 WebGPU，但没有拿到适配器。';
            setReadout('#gpu-r-adapter', 'null');
            setReadout('#gpu-r-backend', '--');
            setReadout('#gpu-r-features', '0');
            setReadout('#gpu-r-status', '无适配器');
            ctx.setStatus('LIMITED', 'partial');
            return;
          }
          var info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
          var features = Array.from(adapter.features || []);
          var limits = adapter.limits || {};
          var name = info.description || info.device || info.vendor || 'GPU adapter';
          setReadout('#gpu-r-adapter', name);
          setReadout('#gpu-r-backend', info.architecture || info.vendor || '--');
          setReadout('#gpu-r-features', String(features.length));
          setReadout('#gpu-r-status', '可用');
          setLines(
            [
              'adapter: ' + name,
              'vendor: ' + (info.vendor || '--'),
              'architecture: ' + (info.architecture || '--'),
              'maxTextureDimension2D: ' + (limits.maxTextureDimension2D || '--'),
              'maxBufferSize: ' + (limits.maxBufferSize || '--'),
              'maxComputeWorkgroupSizeX: ' + (limits.maxComputeWorkgroupSizeX || '--')
            ].concat(features.map(function (feature) {
              return 'feature: ' + feature;
            }))
          );
          note.textContent = '附魔成功：WebGPU 适配器可用。';
          ctx.setStatus('READY', '');
          ctx.toast({ icon: 'webgpu', title: '成就达成！', subtitle: '附魔成功：拿到 WebGPU 适配器' });
          SC.core.log.add('WebGPU 适配器：' + name);
        } catch (error) {
          setLines(['请求适配器失败', error && error.message ? error.message : '未知错误']);
          note.textContent = '请求适配器失败：' + (error && error.message ? error.message : '未知错误');
          setReadout('#gpu-r-status', '失败');
          ctx.setStatus('LIMITED', 'partial');
        }
      }

      retry.addEventListener('click', detect);
      expandBtn.addEventListener('click', function () {
        expanded = !expanded;
        renderLines();
      });
      copyBtn.addEventListener('click', function () {
        if (!allLines.length) {
          ctx.toast({ icon: 'barrier', title: '没有可复制的信息', subtitle: '先请求一次适配器' });
          return;
        }
        dom.copyText(allLines.join('\n')).then(function () {
          ctx.toast({ icon: 'webgpu', title: '信息已复制', subtitle: allLines.length + ' 行适配器信息' });
        }).catch(function () {
          ctx.toast({ icon: 'barrier', title: '复制失败', subtitle: '浏览器拒绝剪贴板写入' });
        });
      });
      powerLever.addEventListener('click', function () {
        highPerformance = !highPerformance;
        powerLever.setAttribute('aria-pressed', String(highPerformance));
        setReadout('#gpu-r-power', highPerformance ? '高性能' : '低功耗');
        note.textContent = highPerformance ? '下次请求会优先高性能适配器。' : '下次请求会使用低功耗偏好。';
        detect();
      });
      detect();
    }
  });
})(window.SC = window.SC || {});
