/* 手动相机：读取真实 getCapabilities()，提供变焦、曝光、对焦、白平衡和补光灯控制；不支持就明说。 */
(function (SC) {
  'use strict';

  var MODE_LABELS = {
    none: '无',
    manual: '手动',
    'single-shot': '单次自动',
    continuous: '连续自动',
    auto: '自动',
    'locked': '锁定'
  };

  function modeLabel(mode) {
    return MODE_LABELS[mode] || mode;
  }

  SC.registerSensor({
    id: 'camera-manual',
    name: '手动相机控制',
    en: 'MANUAL CAMERA',
    group: '计算与身份',
    icon: 'cameraManual',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: '相机控制需要 HTTPS 或 localhost。' };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持 getUserMedia。' };
      }
      return {
        status: 'partial',
        reason: 'iOS Safari 基本不开放变焦/对焦/曝光控制；Android Chrome 支持更好。'
      };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-manual">' +
        '<div class="stage-frame ratio-4x3"><video id="manual-video" autoplay playsinline muted></video>' +
        '<div class="frame-hud"><span class="hud-chip">MANUAL</span><span class="hud-chip" id="manual-chip">检测中</span></div></div>' +
        '<div id="manual-controls"></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn danger" type="button" id="manual-stop">停止相机</button>' +
        '<button class="mc-btn" type="button" id="manual-reset">重置控制</button>' +
        '<button class="mc-btn" type="button" id="manual-copy">复制能力</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="manual-note">读取真实的 getCapabilities()，不伪造控制。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>红石相机</span><span>COMPARATOR</span></div>' +
          '<div class="readout-row"><span class="readout-label">变焦</span><span class="readout-value" id="manual-r-zoom">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">对焦</span><span class="readout-value" id="manual-r-focus">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">曝光</span><span class="readout-value" id="manual-r-exposure">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">白平衡</span><span class="readout-value" id="manual-r-wb">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">补光灯</span><span class="readout-value" id="manual-r-torch">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="manual-r-status">检测中</span></div>'
      );

      var video = ctx.root.querySelector('#manual-video');
      var controls = ctx.root.querySelector('#manual-controls');
      var chip = ctx.root.querySelector('#manual-chip');
      var note = ctx.root.querySelector('#manual-note');
      var stopBtn = ctx.root.querySelector('#manual-stop');
      var resetBtn = ctx.root.querySelector('#manual-reset');
      var copyBtn = ctx.root.querySelector('#manual-copy');
      var stream = null;
      var track = null;
      var caps = {};
      var manualStarted = false;
      var torchOn = false;
      var sliderSeq = 0;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function slider(label, min, max, step, apply) {
        var row = document.createElement('div');
        row.className = 'slider-row';
        var id = 'manual-slider-' + (++sliderSeq);
        row.innerHTML =
          '<label for="' + id + '">' + label + '</label>' +
          '<input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + min + '">' +
          '<span class="slider-value">' + min + '</span>';
        var input = row.querySelector('input');
        var value = row.querySelector('.slider-value');
        input.addEventListener('input', function () {
          value.textContent = input.value;
          apply(Number(input.value));
        });
        controls.appendChild(row);
        return input;
      }

      function modeButtons(label, modes, apply) {
        var wrap = document.createElement('div');
        wrap.className = 'module-toolbar';
        wrap.style.marginTop = '6px';
        var title = document.createElement('span');
        title.className = 'module-note';
        title.textContent = label + '：';
        wrap.appendChild(title);
        modes.forEach(function (mode) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'mc-btn tiny';
          button.textContent = modeLabel(mode);
          button.addEventListener('click', function () {
            Array.prototype.forEach.call(wrap.querySelectorAll('button'), function (item) {
              item.setAttribute('aria-pressed', String(item === button));
            });
            apply(mode);
          });
          wrap.appendChild(button);
        });
        controls.appendChild(wrap);
      }

      async function applyConstraint(constraint) {
        if (!track) return;
        try {
          await track.applyConstraints({ advanced: [constraint] });
          note.textContent = '已应用：' + JSON.stringify(constraint);
          if (!manualStarted) {
            manualStarted = true;
            ctx.toast({ icon: 'cameraManual', title: '成就达成！', subtitle: '红石工程师：第一次手动控制相机' });
          }
          SC.core.log.add('手动相机约束：' + JSON.stringify(constraint));
        } catch (error) {
          note.textContent = '应用失败：' + (error && error.message ? error.message : '设备拒绝');
        }
      }

      function detect() {
        controls.innerHTML = '';
        if (!track || !track.getCapabilities) {
          setReadout('#manual-r-status', '不支持');
          note.textContent = '当前浏览器没有 track.getCapabilities()。';
          return;
        }
        caps = track.getCapabilities();
        setReadout('#manual-r-zoom', caps.zoom ? caps.zoom.min + ' – ' + caps.zoom.max : '不支持');
        setReadout('#manual-r-focus', caps.focusMode ? caps.focusMode.map(modeLabel).join(' / ') : '不支持');
        setReadout('#manual-r-exposure', caps.exposureMode ? caps.exposureMode.map(modeLabel).join(' / ') : '不支持');
        setReadout('#manual-r-wb', caps.whiteBalanceMode ? caps.whiteBalanceMode.map(modeLabel).join(' / ') : '不支持');
        setReadout('#manual-r-torch', 'torch' in caps ? '支持' : '不支持');
        chip.textContent = caps.zoom || caps.focusMode || caps.exposureMode || caps.whiteBalanceMode ? 'CAPABILITIES' : 'LIMITED';

        if (caps.zoom) {
          slider('变焦', caps.zoom.min, caps.zoom.max, caps.zoom.step || 0.1, function (value) {
            applyConstraint({ zoom: value });
          });
        }
        if (caps.exposureCompensation) {
          var ec = caps.exposureCompensation;
          slider('曝光补偿', ec.min, ec.max, ec.step || 1, function (value) {
            applyConstraint({ exposureCompensation: value });
          });
        }
        if (caps.focusMode && caps.focusMode.length > 1) {
          modeButtons('对焦模式', caps.focusMode, function (mode) {
            applyConstraint({ focusMode: mode });
          });
        }
        if (caps.exposureMode && caps.exposureMode.length > 1) {
          modeButtons('曝光模式', caps.exposureMode, function (mode) {
            applyConstraint({ exposureMode: mode });
          });
        }
        if (caps.whiteBalanceMode && caps.whiteBalanceMode.length > 1) {
          modeButtons('白平衡', caps.whiteBalanceMode, function (mode) {
            applyConstraint({ whiteBalanceMode: mode });
          });
        }
        if ('torch' in caps) {
          var torchWrap = document.createElement('div');
          torchWrap.className = 'module-toolbar';
          torchWrap.style.marginTop = '6px';
          var torchLever = document.createElement('button');
          torchLever.type = 'button';
          torchLever.className = 'lever';
          torchLever.setAttribute('aria-pressed', 'false');
          torchLever.innerHTML = '<span class="lever-base"><span class="lever-knob"></span></span><span class="lever-label">补光灯</span>';
          torchLever.addEventListener('click', function () {
            torchOn = !torchOn;
            torchLever.setAttribute('aria-pressed', String(torchOn));
            applyConstraint({ torch: torchOn });
          });
          torchWrap.appendChild(torchLever);
          controls.appendChild(torchWrap);
        }

        if (!caps.zoom && !caps.focusMode && !caps.exposureMode && !caps.exposureCompensation && !caps.whiteBalanceMode && !('torch' in caps)) {
          note.textContent = '设备没有暴露变焦/对焦/曝光能力。iOS Safari 通常只给基本取景。';
          setReadout('#manual-r-status', '受限');
          ctx.setStatus('LIMITED', 'partial');
        } else {
          note.textContent = '可以尝试下面的真实控制。';
          setReadout('#manual-r-status', '可用');
          ctx.setStatus('READY', '');
        }
      }

      async function start() {
        try {
          stream = await ctx.ensureStream({
            audio: false,
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          track = stream.getVideoTracks()[0];
          video.srcObject = stream;
          await video.play().catch(function () {});
          detect();
        } catch (error) {
          ctx.showError(error, error && error.name);
        }
      }

      resetBtn.addEventListener('click', function () {
        if (!track) {
          ctx.toast({ icon: 'cameraManual', title: '相机未启动', subtitle: '先等相机画面出现' });
          return;
        }
        var defaults = {};
        if (caps.zoom) defaults.zoom = caps.zoom.min;
        if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) defaults.focusMode = 'continuous';
        if (caps.exposureMode && caps.exposureMode.indexOf('continuous') >= 0) defaults.exposureMode = 'continuous';
        if (caps.whiteBalanceMode && caps.whiteBalanceMode.indexOf('continuous') >= 0) defaults.whiteBalanceMode = 'continuous';
        if ('torch' in caps) defaults.torch = false;
        torchOn = false;
        applyConstraint(defaults);
        controls.innerHTML = '';
        detect();
        ctx.toast({ icon: 'cameraManual', title: '控制已重置', subtitle: '变焦/对焦/曝光/白平衡恢复默认' });
      });

      copyBtn.addEventListener('click', function () {
        if (!track || !caps) {
          ctx.toast({ icon: 'barrier', title: '没有能力信息', subtitle: '先等相机启动' });
          return;
        }
        dom.copyText(JSON.stringify(caps, null, 2)).then(function () {
          ctx.toast({ icon: 'cameraManual', title: '能力已复制', subtitle: 'getCapabilities() JSON' });
        }).catch(function () {
          ctx.toast({ icon: 'barrier', title: '复制失败', subtitle: '浏览器拒绝剪贴板写入' });
        });
      });

      stopBtn.addEventListener('click', function () {
        if (stream) {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          stream = null;
          track = null;
        }
        video.srcObject = null;
        controls.innerHTML = '';
        note.textContent = '相机已停止。';
        setReadout('#manual-r-status', '已停止');
        ctx.setStatus('LIMITED', 'partial');
      });

      start();
    }
  });
})(window.SC = window.SC || {});
