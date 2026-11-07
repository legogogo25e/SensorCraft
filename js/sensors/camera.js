/* 摄像头：前后切换、暂停/继续、拍照、中心取色、实时亮度。暂停会释放摄像头轨道。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  function friendlyError(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return '摄像头权限被拒绝。请在 Safari 的网站设置里允许摄像头，或重新点击开始。';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return '没有找到可用的摄像头。';
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return '摄像头被其他 App 占用，先关闭相机/视频通话再试。';
    }
    return (error && error.message) || '无法启动摄像头。';
  }

  function readoutHtml(state) {
    return (
      '<div class="readout-title"><span>观察者之眼</span><span>OBSERVER</span></div>' +
      '<div class="readout-row"><span class="readout-label">分辨率</span><span class="readout-value">' +
      state.resolution +
      '</span></div>' +
      '<div class="readout-row"><span class="readout-label">帧率</span><span class="readout-value">' +
      state.fps +
      ' fps</span></div>' +
      '<div class="readout-row"><span class="readout-label">镜头</span><span class="readout-value">' +
      (state.facing === 'user' ? '前置' : '后置') +
      '</span></div>' +
      '<div class="readout-row"><span class="readout-label">中心颜色</span><span class="readout-value"><span class="color-swatch" style="background:' +
      state.hex +
      '"></span> ' +
      state.hex +
      '</span></div>' +
      '<div class="readout-row"><span class="readout-label">亮度</span><span class="readout-value">' +
      state.brightness +
      ' / 100</span></div>' +
      '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">' +
      state.status +
      '</span></div>'
    );
  }

  SC.registerSensor({
    id: 'camera',
    name: '摄像头',
    en: 'CAMERA',
    group: '影像与声音',
    icon: 'camera',
    probe: function (feature) {
      if (!feature.secure) {
        return {
          status: 'locked',
          reason: '摄像头需要 HTTPS 或 localhost，当前不是安全上下文。'
        };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持 getUserMedia。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      var state = {
        facing: 'environment',
        fps: 0,
        resolution: '--',
        hex: '#000000',
        brightness: 0,
        status: '等待授权'
      };
      var stream = null;
      var streamGeneration = 0;
      var firstFrame = false;
      var firstShot = false;
      var paused = false;
      var sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 16;
      sampleCanvas.height = 16;
      var sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

      ctx.root.innerHTML =
        '<div class="module module-camera">' +
        '<div class="stage-frame ratio-4x3">' +
        '<div class="cam-viewport"><video id="cam-video" autoplay playsinline muted></video>' +
        '<div class="cam-crosshair"></div><div class="cam-flash" id="cam-flash"></div></div>' +
        '<div class="frame-hud"><span class="hud-chip" id="cam-res">--</span>' +
        '<span class="hud-chip"><span class="rec-dot"></span> REC</span></div>' +
        '<div class="frame-corners"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>' +
        '<div class="stage-overlay" id="cam-paused" hidden>已暂停<br><span>点击「继续」重新打开摄像头</span></div>' +
        '</div>' +
        '<div class="axis-row" style="margin-top:8px"><span class="axis-name">LIGHT</span><div class="meter"><div class="meter-fill gold" id="cam-light-bar"></div></div><span class="axis-num" id="cam-light-val">0</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="cam-switch">切换镜头</button>' +
        '<button class="mc-btn primary" type="button" id="cam-shot">拍照</button>' +
        '<button class="mc-btn" type="button" id="cam-copy">复制色值</button>' +
        '<button class="mc-btn danger" type="button" id="cam-pause">暂停</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="cam-note">正在申请摄像头…</span>' +
        '</div></div>';

      var video = ctx.root.querySelector('#cam-video');
      var flash = ctx.root.querySelector('#cam-flash');
      var note = ctx.root.querySelector('#cam-note');
      var resChip = ctx.root.querySelector('#cam-res');
      var switchBtn = ctx.root.querySelector('#cam-switch');
      var shotBtn = ctx.root.querySelector('#cam-shot');
      var pauseBtn = ctx.root.querySelector('#cam-pause');
      var copyBtn = ctx.root.querySelector('#cam-copy');
      var pausedOverlay = ctx.root.querySelector('#cam-paused');
      var lightBar = ctx.root.querySelector('#cam-light-bar');
      var lightVal = ctx.root.querySelector('#cam-light-val');

      function refreshReadout() {
        ctx.setReadout(readoutHtml(state));
        resChip.textContent = state.resolution + ' · ' + state.fps + 'fps';
      }

      function stopStream() {
        if (stream) {
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
          stream = null;
        }
        video.srcObject = null;
      }

      async function start() {
        var generation = ++streamGeneration;
        stopStream();
        state.status = '申请中';
        refreshReadout();
        note.textContent = '正在申请摄像头…';
        try {
          var next = await ctx.ensureStream({
            audio: false,
            video: {
              facingMode: state.facing,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          if (!ctx.isActive() || generation !== streamGeneration) {
            next.getTracks().forEach(function (track) {
              track.stop();
            });
            return;
          }
          stream = next;
          video.srcObject = stream;
          await video.play().catch(function () {});
          paused = false;
          pausedOverlay.hidden = true;
          pauseBtn.textContent = '暂停';
          state.resolution = video.videoWidth + '×' + video.videoHeight;
          state.status = '运行中';
          note.textContent = '画面正常';
          refreshReadout();
          if (!firstFrame) {
            firstFrame = true;
            ctx.toast({ icon: 'camera', title: '成就达成！', subtitle: '睁眼看世界：第一次看到摄像头画面' });
          }
          SC.core.log.add('摄像头已启动（' + (state.facing === 'user' ? '前置' : '后置') + '）');
        } catch (error) {
          if (!ctx.isActive()) return;
          state.status = '失败';
          note.textContent = '无法启动';
          refreshReadout();
          ctx.showError(new Error(friendlyError(error)), error && error.name);
        }
      }

      function sample() {
        if (!stream || !video.videoWidth) return;
        // 每 250ms 采样画面中心 4x4 像素，得到平均色和亮度；不读取整帧，避免耗电。
        sampleCtx.drawImage(video, 0, 0, 16, 16);
        var data = sampleCtx.getImageData(6, 6, 4, 4).data;
        var r = 0;
        var g = 0;
        var b = 0;
        var count = 0;
        for (var i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        state.hex = '#' + [r, g, b].map(function (v) {
          return v.toString(16).padStart(2, '0');
        }).join('');
        state.brightness = Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 100);
        state.fps = Math.round(videoFps);
        lightBar.style.width = state.brightness + '%';
        lightVal.textContent = state.brightness;
        refreshReadout();
      }

      var videoFps = 0;
      var frameCount = 0;
      var frameLast = performance.now();
      function updateFps(now) {
        frameCount += 1;
        if (now - frameLast >= 1000) {
          videoFps = (frameCount * 1000) / (now - frameLast);
          frameCount = 0;
          frameLast = now;
        }
      }
      // 用 requestVideoFrameCallback 统计真实视频帧率；不支持时退回 rAF。
      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        var onVideoFrame = function (now) {
          if (!ctx.isActive()) return;
          updateFps(now);
          if (video.srcObject) video.requestVideoFrameCallback(onVideoFrame);
        };
        video.requestVideoFrameCallback(onVideoFrame);
      } else {
        ctx.raf(function (now) {
          if (video.srcObject) updateFps(now);
        });
      }

      switchBtn.addEventListener('click', function () {
        state.facing = state.facing === 'environment' ? 'user' : 'environment';
        start();
      });

      shotBtn.addEventListener('click', function () {
        if (!video.videoWidth) {
          ctx.toast({ icon: 'barrier', title: '还没有画面', subtitle: '等摄像头启动后再拍照' });
          return;
        }
        var canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        flash.classList.remove('is-flash');
        void flash.offsetWidth;
        flash.classList.add('is-flash');
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'sensorcraft-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 3000);
          if (!firstShot) {
            firstShot = true;
            ctx.toast({ icon: 'map', title: '成就达成！', subtitle: '记录者：拍下第一张传感器照片' });
          }
          SC.core.log.add('已拍照 ' + canvas.width + '×' + canvas.height);
        }, 'image/png');
      });

      // 暂停会真正停止 track 并清空 video.srcObject，确保 iPhone 摄像头指示灯熄灭。
      pauseBtn.addEventListener('click', function () {
        if (paused) {
          start();
          SC.core.log.add('摄像头已继续');
        } else {
          streamGeneration += 1;
          stopStream();
          paused = true;
          state.status = '已暂停';
          note.textContent = '已暂停，摄像头已释放';
          pauseBtn.textContent = '继续';
          pausedOverlay.hidden = false;
          refreshReadout();
          SC.core.log.add('摄像头已暂停');
        }
      });

      copyBtn.addEventListener('click', function () {
        dom.copyText(state.hex).then(function () {
          ctx.toast({ icon: 'camera', title: '已复制色值', subtitle: state.hex });
        }).catch(function () {
          ctx.toast({ icon: 'barrier', title: '复制失败', subtitle: '请手动长按选择色值' });
        });
      });

      ctx.interval(sample, 250);
      refreshReadout();
      start();
    }
  });
})(window.SC = window.SC || {});
