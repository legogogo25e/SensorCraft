/* 补光灯：先实际读取 track.getCapabilities().torch 再决定是否显示开关，不伪造成功。 */
(function (SC) {
  'use strict';

  SC.registerSensor({
    id: 'torch',
    name: '补光灯',
    en: 'TORCH',
    group: '影像与声音',
    icon: 'torch',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: '补光灯检测需要 HTTPS 或 localhost。' };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持摄像头 API，无法控制补光灯。' };
      }
      return {
        status: 'partial',
        reason: 'iPhone 对网页补光灯支持不稳定，打开模块后会实际检测。'
      };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-torch">' +
        '<div class="big-icon-stage"><div class="big-icon" id="torch-icon">' +
        SC.ui.icons.torch +
        '</div></div>' +
        '<div id="torch-extra"></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="torch-toggle" disabled>打开补光灯</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="torch-note">正在检测…</span>' +
        '</div></div>';

      var icon = ctx.root.querySelector('#torch-icon');
      var toggleBtn = ctx.root.querySelector('#torch-toggle');
      var note = ctx.root.querySelector('#torch-note');
      var extra = ctx.root.querySelector('#torch-extra');
      var stream = null;
      var track = null;
      var on = false;

      ctx.setReadout(
        '<div class="readout-title"><span>萤石灯</span><span>GLOWSTONE</span></div>' +
          '<div class="readout-row"><span class="readout-label">能力</span><span class="readout-value" id="torch-r-support">检测中</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="torch-r-state">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">轨道</span><span class="readout-value" id="torch-r-track">--</span></div>' +
          '<div class="module-note">只有相机轨道暴露 <span class="inline-code">torch</span> 能力时，网页才能控制补光灯。iPhone Safari 通常不开放。</div>'
      );

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function render() {
        icon.classList.toggle('is-on', on);
        setReadout('#torch-r-state', on ? '开启' : '关闭');
        toggleBtn.textContent = on ? '关闭补光灯' : '打开补光灯';
      }

      async function detect() {
        try {
          stream = await ctx.ensureStream({
            audio: false,
            video: { facingMode: 'environment' }
          });
          track = stream.getVideoTracks()[0];
          var video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
          document.body.appendChild(video);
          video.srcObject = stream;
          ctx.onCleanup(function () {
            if (video.parentNode) video.parentNode.removeChild(video);
          });

          var caps = track && track.getCapabilities ? track.getCapabilities() : {};
          var supported = !!(caps && 'torch' in caps);
          setReadout('#torch-r-support', supported ? '支持 torch' : '不支持 torch');
          setReadout('#torch-r-track', track ? track.label || 'camera' : '--');
          if (supported) {
            toggleBtn.disabled = false;
            note.textContent = '当前设备允许网页控制补光灯。';
            ctx.setStatus('READY', '');
            if (caps.torchStrength && typeof caps.torchStrength === 'object') {
              var row = document.createElement('div');
              row.className = 'slider-row';
              row.innerHTML =
                '<label for="torch-strength">亮度</label>' +
                '<input id="torch-strength" type="range" min="' + caps.torchStrength.min + '" max="' + caps.torchStrength.max + '" step="' + (caps.torchStrength.step || 0.1) + '" value="' + caps.torchStrength.min + '">' +
                '<span class="slider-value">' + caps.torchStrength.min + '</span>';
              var input = row.querySelector('input');
              var value = row.querySelector('.slider-value');
              input.addEventListener('input', function () {
                value.textContent = input.value;
                if (track) {
                  track.applyConstraints({ advanced: [{ torchStrength: Number(input.value) }] }).catch(function () {});
                }
              });
              extra.appendChild(row);
            }
          } else {
            note.textContent = '当前设备/浏览器没有暴露补光灯能力。';
            ctx.setStatus('LIMITED', 'partial');
          }
          render();
        } catch (error) {
          note.textContent = '无法访问摄像头，补光灯不可用。';
          setReadout('#torch-r-support', '无法检测');
          setReadout('#torch-r-track', error && error.name ? error.name : '--');
          ctx.setStatus('LIMITED', 'partial');
        }
      }

      toggleBtn.addEventListener('click', async function () {
        if (!track) return;
        on = !on;
        try {
          await track.applyConstraints({ advanced: [{ torch: on }] });
          note.textContent = on ? '补光灯已打开。' : '补光灯已关闭。';
        } catch (error) {
          on = false;
          note.textContent = '切换失败：' + (error && error.message ? error.message : '设备拒绝');
        }
        render();
      });

      render();
      detect();
    }
  });
})(window.SC = window.SC || {});
