/* 人面识别：MediaPipe BlazeFace（首选）+ 肤色检测（离线兜底）。
 *
 * 为什么换成 MediaPipe：
 * - 旧版是肤色 + 几何判断，不是神经网络，正脸光线好才稳，
 *   侧脸、暗光、多人、远处基本不行，用户实测反馈「太差了」。
 * - MediaPipe Tasks Vision FaceDetector 是专为人脸框选做的：
 *   BlazeFace short-range 模型约 230KB、Apache-2.0，用 WASM +
 *   WebGL 跑，不需要 WebGPU，在 iPhone Safari 上就能用，
 *   有专给摄像头用的 detectForVideo()，一次能框多张脸，
 *   还带 6 个关键点（左右眼、鼻尖、嘴、左右耳）。
 * - 版本固定为 @mediapipe/tasks-vision@0.10.14，不用 @latest，
 *   避免上游一更新就坏。模型地址也是固定版本：
 *   blaze_face_short_range float16，229,746 字节。
 * - 加载方式：运行时从 CDN 动态 import（jsDelivr + Google
 *   模型存储），首次打开需要联网。这是刻意取舍：快照推送
 *   只接受 UTF-8 文本，.tflite 和 .wasm 二进制推不上去；
 *   想完全自托管时，把下面三个常量改成本地路径即可，
 *   其余代码不用改。首次下载合计约 9.5MB（模型 230KB +
 *   WASM 运行时约 9MB），之后走浏览器缓存，不用每次下载。
 * - 全部本机运算，视频帧不上传、不保存；离开卡片即释放
 *   摄像头并关闭检测器。CDN 只下载代码和模型，不收视频。
 * - 兜底：如果 MediaPipe 加载失败（离线、CDN 被挡），
 *   自动回退到旧的肤色检测，至少还能用，并在读数里写明。
 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var MP_VERSION = '0.10.14';
  var MP_BUNDLE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/vision_bundle.mjs';
  var MP_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm';
  var MP_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

  var DET_W = 160;
  var DET_H = 120;
  var DET_N = DET_W * DET_H;
  var DETECT_MS = 100;

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

  /* ---- 离线兜底：旧的肤色 + 几何检测（MediaPipe 失败时才用） ---- */
  function isSkin(r, g, b, tol) {
    if (r < 40 || g < 25 || b < 15) return false;
    if (!(r > g && g > b)) return false;
    if (r - b < 18) return false;
    var y = 0.299 * r + 0.587 * g + 0.114 * b;
    var cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    var cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (y < 35) return false;
    return cb > 102 - 25 * tol && cb < 128 + 25 * tol && cr > 133 - 20 * tol && cr < 173 + 20 * tol;
  }

  function boxesFromMask(mask, lum, sensitivity) {
    var label = new Int32Array(DET_N);
    label.fill(-1);
    var boxes = [];
    var stack = new Int32Array(DET_N);
    for (var start = 0; start < DET_N; start += 1) {
      if (!mask[start] || label[start] !== -1) continue;
      var compId = boxes.length + 1000;
      var sp = 0;
      stack[sp++] = start;
      label[start] = compId;
      var minX = DET_W;
      var maxX = -1;
      var minY = DET_H;
      var maxY = -1;
      var area = 0;
      var darkUpper = 0;
      var upperCount = 0;
      while (sp > 0) {
        var p = stack[--sp];
        area += 1;
        var x = p % DET_W;
        var y = (p / DET_W) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        var np;
        if (x > 0) { np = p - 1; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (x < DET_W - 1) { np = p + 1; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (y > 0) { np = p - DET_W; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (y < DET_H - 1) { np = p + DET_W; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
      }
      if (area < 90 || area > Math.floor(DET_N * 0.6)) continue;
      var bw = maxX - minX + 1;
      var bh = maxY - minY + 1;
      if (bw < 18 || bh < 22 || bw > 132 || bh > 116) continue;
      var aspect = bw / bh;
      if (aspect < 0.62 || aspect > 1.5) continue;
      var fill = area / (bw * bh);
      if (fill < 0.38) continue;
      var midY = minY + Math.floor(bh * 0.45);
      for (var yy = minY; yy <= midY; yy += 1) {
        for (var xx = minX; xx <= maxX; xx += 1) {
          var idx = yy * DET_W + xx;
          if (!mask[idx]) continue;
          upperCount += 1;
          if (lum[idx] < 72) darkUpper += 1;
        }
      }
      var darkRatio = upperCount ? darkUpper / upperCount : 0;
      var score = 0.3 + fill * 0.35;
      if (aspect >= 0.75 && aspect <= 1.25) score += 0.15;
      else if (aspect >= 0.68 && aspect <= 1.4) score += 0.07;
      if (darkRatio >= 0.02 && darkRatio <= 0.32) score += 0.15;
      else if (darkRatio > 0.32 && darkRatio <= 0.45) score += 0.05;
      var widthFrac = bw / DET_W;
      if (widthFrac >= 0.15 && widthFrac <= 0.55) score += 0.1;
      else if (widthFrac > 0.55 && widthFrac <= 0.7) score += 0.04;
      score = Math.min(0.99, score);
      if (score < 0.52 + (1 - sensitivity) * 0.08) continue;
      boxes.push({ x: minX / DET_W, y: minY / DET_H, w: bw / DET_W, h: bh / DET_H, score: score, keypoints: null });
    }
    boxes.sort(function (a, b) { return b.score - a.score; });
    return boxes.slice(0, 3);
  }

  function cpuDetect(imageData, sensitivity) {
    var data = imageData.data;
    var mask = new Uint8Array(DET_N);
    var lum = new Uint8Array(DET_N);
    for (var i = 0; i < DET_N; i += 1) {
      var o = i * 4;
      var r = data[o];
      var g = data[o + 1];
      var b = data[o + 2];
      lum[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      mask[i] = isSkin(r, g, b, sensitivity) ? 1 : 0;
    }
    var cleaned = new Uint8Array(DET_N);
    for (var y = 0; y < DET_H; y += 1) {
      for (var x = 0; x < DET_W; x += 1) {
        var idx = y * DET_W + x;
        if (!mask[idx]) continue;
        var n = 0;
        for (var dy = -1; dy <= 1; dy += 1) {
          for (var dx = -1; dx <= 1; dx += 1) {
            var xx = x + dx;
            var yy = y + dy;
            if (xx < 0 || xx >= DET_W || yy < 0 || yy >= DET_H) continue;
            if (mask[yy * DET_W + xx]) n += 1;
          }
        }
        if (n >= 4) cleaned[idx] = 1;
      }
    }
    return boxesFromMask(cleaned, lum, sensitivity);
  }

  function readoutHtml(state) {
    return (
      '<div class="readout-title"><span>村民探测器</span><span>FACE DETECT</span></div>' +
      '<div class="readout-row"><span class="readout-label">引擎</span><span class="readout-value">' + state.engine + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">模型</span><span class="readout-value">' + state.model + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">人面数</span><span class="readout-value">' + state.faces + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">最大人面</span><span class="readout-value">' + state.biggest + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">检测速度</span><span class="readout-value">' + state.detFps + ' /秒</span></div>' +
      '<div class="readout-row"><span class="readout-label">镜头</span><span class="readout-value">' + (state.facing === 'user' ? '前置' : '后置') + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">' + state.status + '</span></div>' +
      '<div class="module-note">本机运算，不上传。MediaPipe BlazeFace：首次需联网下载模型 + WASM，之后走浏览器缓存。</div>'
    );
  }

  SC.registerSensor({
    id: 'face-detect',
    name: '人面识别',
    en: 'FACE DETECT',
    group: '影像与声音',
    icon: 'face',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: '人面识别需要 HTTPS 或 localhost，当前不是安全上下文。' };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持 getUserMedia。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      var state = {
        facing: 'user',
        engine: '未开始',
        model: 'BlazeFace short-range',
        faces: 0,
        biggest: '--',
        detFps: 0,
        status: '未开始'
      };
      var stream = null;
      var streamGeneration = 0;
      var paused = false;
      /* 置信度阈值：滑杆 0.3~0.8，默认 0.5。检测器本身用 0.3 创建，
         再在 JS 里按滑杆过滤，避免改阈值就要重建检测器。 */
      var threshold = 0.5;
      var showKeypoints = true;
      var tracked = [];
      var nextTrackId = 1;
      var firstFace = false;
      var firstFrame = false;
      var detCount = 0;
      var detLast = performance.now();
      var lastTimestamp = -1;
      var detectInFlight = false;

      var detector = null;
      var detectorDelegate = '';
      var detectorLoading = false;
      var detectorFailed = false;
      var detectorFailedLogged = false;

      var sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = DET_W;
      sampleCanvas.height = DET_H;
      var sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

      ctx.root.innerHTML =
        '<div class="module module-face-detect">' +
        '<div class="stage-frame ratio-4x3">' +
        '<div class="face-viewport"><video id="face-video" autoplay playsinline muted></video>' +
        '<canvas id="face-overlay"></canvas>' +
        '<div class="frame-corners"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>' +
        '<div class="stage-overlay" id="face-paused" hidden>已暂停<br><span>点击「继续」重新打开摄像头</span></div>' +
        '<div class="stage-overlay" id="face-start"><div class="start-box">' +
        '<div class="start-title">人面识别</div>' +
        '<div class="start-text">框出画面里的人面、标 6 个关键点。点「开启」后，先下载 AI 模型（约 9.5MB，首次需联网），再由浏览器申请摄像头权限；不点就不会问。</div>' +
        '<div class="start-actions"><button class="mc-btn primary" type="button" id="face-start-btn">开启人面识别</button>' +
        '<button class="mc-btn ghost" type="button" id="face-info-btn">先看看说明</button></div>' +
        '</div></div>' +
        '</div>' +
        '<div class="frame-hud"><span class="hud-chip" id="face-res">--</span>' +
        '<span class="hud-chip"><span class="rec-dot"></span> FACE</span>' +
        '<span class="hud-chip" id="face-count">0 张脸</span></div>' +
        '</div>' +
        '<div class="slider-row"><label for="face-sens">置信度</label>' +
        '<input type="range" id="face-sens" min="0.3" max="0.8" step="0.05" value="0.5">' +
        '<span class="slider-value" id="face-sens-val">0.50</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="face-switch" disabled>切换镜头</button>' +
        '<button class="mc-btn primary" type="button" id="face-shot" disabled>拍照带框</button>' +
        '<button class="mc-btn" type="button" id="face-kp-btn" aria-pressed="true" disabled>显示关键点</button>' +
        '<button class="mc-btn danger" type="button" id="face-pause" disabled>暂停</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="face-note">还没开始：点「开启」，先下载 AI 模型，再申请摄像头。</span>' +
        '</div>' +
        '<p class="module-note">MediaPipe BlazeFace：首次打开需联网下载模型 + WASM（合计约 9.5MB，之后走浏览器缓存）。视频只在本机处理，不上传、不保存。</p>' +
        '</div>';

      var video = ctx.root.querySelector('#face-video');
      var overlay = ctx.root.querySelector('#face-overlay');
      var overlayCtx = overlay.getContext('2d');
      var note = ctx.root.querySelector('#face-note');
      var resChip = ctx.root.querySelector('#face-res');
      var countChip = ctx.root.querySelector('#face-count');
      var switchBtn = ctx.root.querySelector('#face-switch');
      var shotBtn = ctx.root.querySelector('#face-shot');
      var kpBtn = ctx.root.querySelector('#face-kp-btn');
      var pauseBtn = ctx.root.querySelector('#face-pause');
      var pausedOverlay = ctx.root.querySelector('#face-paused');
      var startOverlay = ctx.root.querySelector('#face-start');
      var startBtn = ctx.root.querySelector('#face-start-btn');
      var infoBtn = ctx.root.querySelector('#face-info-btn');
      var sensInput = ctx.root.querySelector('#face-sens');
      var sensVal = ctx.root.querySelector('#face-sens-val');

      function setToolbarEnabled(enabled) {
        [switchBtn, shotBtn, kpBtn, pauseBtn].forEach(function (b) {
          b.disabled = !enabled;
        });
      }

      function refreshReadout() {
        ctx.setReadout(readoutHtml(state));
        resChip.textContent = (video.videoWidth || 0) + '×' + (video.videoHeight || 0);
        countChip.textContent = state.faces + ' 张脸';
      }

      function stopStream() {
        if (stream) {
          stream.getTracks().forEach(function (track) { track.stop(); });
          stream = null;
        }
        video.srcObject = null;
      }

      async function createDetector(delegate) {
        var mp = await import(MP_BUNDLE_URL);
        var vision = await mp.FilesetResolver.forVisionTasks(MP_WASM_URL);
        return mp.FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MP_MODEL_URL, delegate: delegate },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.3,
          minSuppressionThreshold: 0.3
        });
      }

      async function initDetector() {
        if (detector || detectorLoading || detectorFailed) return;
        detectorLoading = true;
        state.engine = '加载模型中…';
        note.textContent = '正在加载 AI 模型…（首次需联网）';
        refreshReadout();
        try {
          detector = await createDetector('GPU');
          detectorDelegate = 'GPU';
        } catch (eGpu) {
          try {
            detector = await createDetector('CPU');
            detectorDelegate = 'CPU';
          } catch (eCpu) {
            detectorFailed = true;
            detector = null;
            state.engine = '肤色兜底 (离线)';
            state.model = '肤色 + 几何（兜底）';
            note.textContent = 'MediaPipe 加载失败，已用离线肤色兜底：' + (eCpu && eCpu.message ? eCpu.message : '请检查网络后重开卡片');
            SC.core.log.add('MediaPipe 加载失败，已回退肤色兜底：' + (eCpu && eCpu.message ? eCpu.message : eCpu));
            refreshReadout();
            detectorLoading = false;
            return;
          }
        }
        detectorLoading = false;
        state.engine = 'MediaPipe BlazeFace (' + detectorDelegate + ')';
        state.model = 'BlazeFace short-range';
        note.textContent = '检测中：MediaPipe BlazeFace 已就绪';
        SC.core.log.add('人面识别模型已加载：MediaPipe BlazeFace (' + detectorDelegate + ')');
        refreshReadout();
      }

      function smoothBoxes(raw) {
        var now = performance.now();
        var next = [];
        raw.forEach(function (box) {
          var best = null;
          var bestDist = 1e9;
          tracked.forEach(function (t) {
            var dx = (box.x + box.w / 2) - (t.x + t.w / 2);
            var dy = (box.y + box.h / 2) - (t.y + t.h / 2);
            var d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; best = t; }
          });
          if (best && bestDist < 0.04) {
            next.push({
              id: best.id,
              x: best.x + (box.x - best.x) * 0.5,
              y: best.y + (box.y - best.y) * 0.5,
              w: best.w + (box.w - best.w) * 0.5,
              h: best.h + (box.h - best.h) * 0.5,
              score: box.score,
              keypoints: box.keypoints || best.keypoints || null,
              lastSeen: now
            });
          } else {
            next.push({ id: nextTrackId++, x: box.x, y: box.y, w: box.w, h: box.h, score: box.score, keypoints: box.keypoints || null, lastSeen: now });
          }
        });
        tracked.forEach(function (t) {
          if (now - t.lastSeen < 500 && !next.some(function (n) { return n.id === t.id; })) {
            next.push(t);
          }
        });
        tracked = next;
        return tracked;
      }

      function drawBoxes() {
        if (!video.videoWidth || overlay.width !== video.videoWidth) {
          overlay.width = video.videoWidth || 640;
          overlay.height = video.videoHeight || 480;
        }
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        tracked.forEach(function (box, idx) {
          var x = box.x * overlay.width;
          var y = box.y * overlay.height;
          var w = box.w * overlay.width;
          var h = box.h * overlay.height;
          overlayCtx.strokeStyle = '#7fff2a';
          overlayCtx.lineWidth = 3;
          overlayCtx.strokeRect(x, y, w, h);
          overlayCtx.strokeStyle = '#ffffff';
          overlayCtx.lineWidth = 2;
          var c = 14;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x, y + c); overlayCtx.lineTo(x, y); overlayCtx.lineTo(x + c, y);
          overlayCtx.moveTo(x + w - c, y); overlayCtx.lineTo(x + w, y); overlayCtx.lineTo(x + w, y + c);
          overlayCtx.moveTo(x, y + h - c); overlayCtx.lineTo(x, y + h); overlayCtx.lineTo(x + c, y + h);
          overlayCtx.moveTo(x + w - c, y + h); overlayCtx.lineTo(x + w, y + h); overlayCtx.lineTo(x + w, y + h - c);
          overlayCtx.stroke();
          if (showKeypoints && box.keypoints) {
            box.keypoints.forEach(function (kp, ki) {
              overlayCtx.fillStyle = ki < 2 ? '#55ffff' : (ki === 2 ? '#ffd700' : '#ff8c1a');
              overlayCtx.beginPath();
              overlayCtx.arc(kp.x * overlay.width, kp.y * overlay.height, 4, 0, Math.PI * 2);
              overlayCtx.fill();
            });
          }
          var label = 'FACE ' + (idx + 1) + ' · ' + Math.round(box.score * 100) + '%';
          overlayCtx.font = 'bold 13px monospace';
          var tw = overlayCtx.measureText(label).width;
          overlayCtx.fillStyle = '#7fff2a';
          overlayCtx.fillRect(x, Math.max(0, y - 20), tw + 10, 18);
          overlayCtx.fillStyle = '#1b1b1f';
          overlayCtx.fillText(label, x + 5, Math.max(13, y - 6));
        });
      }

      async function detectOnce() {
        if (!stream || paused || !video.videoWidth) return;
        if (detectInFlight) return;
        detectInFlight = true;
        try {
          await detectOnceInner();
        } finally {
          detectInFlight = false;
        }
      }

      async function detectOnceInner() {
        var boxes = null;
        if (detector) {
          try {
            var ts = Math.floor(performance.now());
            if (ts <= lastTimestamp) ts = lastTimestamp + 1;
            lastTimestamp = ts;
            var result = detector.detectForVideo(video, ts);
            boxes = (result.detections || []).map(function (d) {
              var b = d.boundingBox;
              var score = d.categories && d.categories[0] ? d.categories[0].score : 0.5;
              return {
                x: b.originX / video.videoWidth,
                y: b.originY / video.videoHeight,
                w: b.width / video.videoWidth,
                h: b.height / video.videoHeight,
                score: score,
                keypoints: d.keypoints || null
              };
            }).filter(function (b) { return b.score >= threshold; });
            state.engine = 'MediaPipe BlazeFace (' + detectorDelegate + ')';
          } catch (e) {
            if (!detectorFailedLogged) {
              detectorFailedLogged = true;
              SC.core.log.add('MediaPipe 检测出错，已回退肤色兜底：' + (e && e.message ? e.message : e));
            }
            detectorFailed = true;
            try { detector.close(); } catch (ignored) {}
            detector = null;
            state.engine = '肤色兜底 (离线)';
            state.model = '肤色 + 几何（兜底）';
            boxes = null;
          }
        }
        if (!boxes) {
          /* MediaPipe 还在加载时跳过这一拍；加载失败时用肤色兜底。 */
          if (!detectorFailed) return;
          try {
            sampleCtx.drawImage(video, 0, 0, DET_W, DET_H);
            var frame = sampleCtx.getImageData(0, 0, DET_W, DET_H);
            boxes = cpuDetect(frame, 1.0).filter(function (b) { return b.score >= threshold; });
          } catch (e2) { return; }
        }
        detCount += 1;
        var now = performance.now();
        if (now - detLast >= 1000) {
          state.detFps = Math.round((detCount * 1000) / (now - detLast));
          detCount = 0;
          detLast = now;
        }
        var smoothed = smoothBoxes(boxes);
        state.faces = smoothed.length;
        state.biggest = smoothed.length
          ? Math.round(Math.max.apply(null, smoothed.map(function (b) { return b.w * 100; }))) + '% 宽'
          : '--';
        if (smoothed.length && !firstFace) {
          firstFace = true;
          ctx.toast({ icon: 'face', title: '成就达成！', subtitle: '初见村民：第一次框到一张脸' });
          SC.core.log.add('人面识别：首次检测到人面');
        }
        refreshReadout();
      }

      async function start() {
        var generation = ++streamGeneration;
        stopStream();
        state.status = '申请中';
        refreshReadout();
        note.textContent = detector ? '正在申请摄像头…' : '正在加载 AI 模型…';
        try {
          var next = await ctx.ensureStream({
            audio: false,
            video: { facingMode: state.facing, width: { ideal: 640 }, height: { ideal: 480 } }
          });
          if (!ctx.isActive() || generation !== streamGeneration) {
            next.getTracks().forEach(function (track) { track.stop(); });
            return;
          }
          stream = next;
          video.srcObject = stream;
          await video.play().catch(function () {});
          paused = false;
          pausedOverlay.hidden = true;
          startOverlay.hidden = true;
          setToolbarEnabled(true);
          pauseBtn.textContent = '暂停';
          state.status = '运行中';
          note.textContent = detector ? '检测中：MediaPipe BlazeFace' : '检测中：模型加载中，稍后开始框选';
          refreshReadout();
          if (!firstFrame) {
            firstFrame = true;
            ctx.toast({ icon: 'face', title: '成就达成！', subtitle: '睁眼看村民：人面识别已启动' });
          }
          SC.core.log.add('人面识别已启动（' + (state.facing === 'user' ? '前置' : '后置') + '）');
        } catch (error) {
          if (!ctx.isActive()) return;
          state.status = '失败';
          note.textContent = friendlyError(error);
          startOverlay.hidden = false;
          startBtn.textContent = '重新开启';
          refreshReadout();
          SC.core.log.add('人面识别启动失败：' + (error && error.name ? error.name : error));
        }
      }

      /* 权限与模型下载只在用户点了「开启」之后才发生；拒绝后留在卡里，可重新点开启再试。 */
      startBtn.addEventListener('click', function () {
        initDetector();
        start();
      });
      infoBtn.addEventListener('click', function () {
        SC.ui.sensorInfo.open('face-detect');
      });

      switchBtn.addEventListener('click', function () {
        state.facing = state.facing === 'environment' ? 'user' : 'environment';
        tracked = [];
        start();
      });

      pauseBtn.addEventListener('click', function () {
        if (paused) {
          start();
          SC.core.log.add('人面识别已继续');
        } else {
          streamGeneration += 1;
          stopStream();
          paused = true;
          tracked = [];
          overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
          state.faces = 0;
          state.biggest = '--';
          state.status = '已暂停';
          note.textContent = '已暂停，摄像头已释放';
          pauseBtn.textContent = '继续';
          pausedOverlay.hidden = false;
          refreshReadout();
          SC.core.log.add('人面识别已暂停');
        }
      });

      sensInput.addEventListener('input', function () {
        threshold = parseFloat(sensInput.value) || 0.5;
        sensVal.textContent = threshold.toFixed(2);
      });

      kpBtn.addEventListener('click', function () {
        showKeypoints = !showKeypoints;
        kpBtn.setAttribute('aria-pressed', String(showKeypoints));
      });

      shotBtn.addEventListener('click', function () {
        if (!video.videoWidth) {
          ctx.toast({ icon: 'barrier', title: '还没有画面', subtitle: '等摄像头启动后再拍照' });
          return;
        }
        var canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        var c2d = canvas.getContext('2d');
        c2d.drawImage(video, 0, 0);
        c2d.drawImage(overlay, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'sensorcraft-face-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
          SC.core.log.add('人面识别已拍照 ' + canvas.width + '×' + canvas.height + '（' + state.faces + ' 张脸）');
        }, 'image/png');
      });

      ctx.raf(function () {
        if (stream && !paused && video.videoWidth) drawBoxes();
      });
      ctx.interval(function () { detectOnce(); }, DETECT_MS);
      ctx.onCleanup(function () {
        tracked = [];
        try { if (detector) detector.close(); } catch (ignored) {}
        detector = null;
      });
      refreshReadout();
    }
  });
})(window.SC = window.SC || {});
