/* 人面识别：摄像头 + 三层检测引擎，实时框选人面。
 *
 * 诚实说明（写在代码里，不藏在文档角落）：
 * - iPhone Safari 没有 FaceDetector / Shape Detection API，Chrome 才有。
 *   所以这里不用不存在的原生 API 假装检测。
 * - WebGPU 本身不是人面检测器，它只是加速器：有 WebGPU 时，
 *   用 compute shader 并行做肤色掩码（RGB -> YCbCr 肤色判断），
 *   再由 CPU 做连通域 + 人面几何打分；没有 WebGPU 就全走 CPU。
 * - 检测本身是轻量肤色 + 几何模型（不是 BlazeFace / YuNet 神经网络）：
 *   正面、光线好、占画面 15%~60% 的人面最稳；侧脸、戴口罩、
 *   逆光、肤色接近背景（木头、沙发）时可能漏检或误检。
 *   想换高精度模型时，把 detectFrame() 换成 MediaPipe / ONNX
 *   推理即可，框选、平滑、拍照的管线不用改。
 * - 全部本机运算，视频帧不上传、不保存；离开卡片即释放摄像头。
 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var DET_W = 160;
  var DET_H = 120;
  var DET_N = DET_W * DET_H;
  var DETECT_MS = 120;

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

  /* YCbCr 肤色判断：经典区间，灵敏度拉宽/收窄 Cb/Cr 容差。 */
  function isSkin(r, g, b, tol) {
    if (r < 40 || g < 25 || b < 15) return false;
    if (!(r > g && g > b)) return false;
    if (r - b < 18) return false;
    var y = 0.299 * r + 0.587 * g + 0.114 * b;
    var cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    var cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    var cbTol = 25 * tol;
    var crTol = 20 * tol;
    if (y < 35) return false;
    return cb > 102 - cbTol && cb < 128 + cbTol && cr > 133 - crTol && cr < 173 + crTol;
  }

  /* 连通域 + 人面几何打分。输入 mask Uint8(0/1)，输出归一化框 [{x,y,w,h,score}]。 */
  function boxesFromMask(mask, lum, sensitivity) {
    var label = new Int32Array(DET_N);
    label.fill(-1);
    var boxes = [];
    var stack = new Int32Array(DET_N);
    var minArea = 90;
    var maxArea = Math.floor(DET_N * 0.6);
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
        var nx;
        var ny;
        var np;
        if (x > 0) { np = p - 1; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (x < DET_W - 1) { np = p + 1; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (y > 0) { np = p - DET_W; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
        if (y < DET_H - 1) { np = p + DET_W; if (mask[np] && label[np] === -1) { label[np] = compId; stack[sp++] = np; } }
      }
      if (area < minArea || area > maxArea) continue;
      var bw = maxX - minX + 1;
      var bh = maxY - minY + 1;
      if (bw < 18 || bh < 22 || bw > 132 || bh > 116) continue;
      var aspect = bw / bh;
      if (aspect < 0.62 || aspect > 1.5) continue;
      var fill = area / (bw * bh);
      if (fill < 0.38) continue;
      /* 上半部暗像素（眼睛/眉毛/眼镜）比例：太少像纯色块，太多像头发。 */
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
      boxes.push({
        x: minX / DET_W,
        y: minY / DET_H,
        w: bw / DET_W,
        h: bh / DET_H,
        score: score,
        darkRatio: darkRatio
      });
    }
    boxes.sort(function (a, b) { return b.score - a.score; });
    var kept = [];
    for (var i = 0; i < boxes.length && kept.length < 3; i += 1) {
      var keep = true;
      for (var j = 0; j < kept.length; j += 1) {
        var ox = Math.max(0, Math.min(boxes[i].x + boxes[i].w, kept[j].x + kept[j].w) - Math.max(boxes[i].x, kept[j].x));
        var oy = Math.max(0, Math.min(boxes[i].y + boxes[i].h, kept[j].y + kept[j].h) - Math.max(boxes[i].y, kept[j].y));
        var inter = ox * oy;
        var union = boxes[i].w * boxes[i].h + kept[j].w * kept[j].h - inter;
        if (union > 0 && inter / union > 0.3) { keep = false; break; }
      }
      if (keep) kept.push(boxes[i]);
    }
    return kept;
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
    /* 一次 3x3 开运算去噪点：孤立肤色点去掉，小孔填上。 */
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
    return { boxes: boxesFromMask(cleaned, lum, sensitivity), mask: cleaned };
  }

  /* WebGPU：compute shader 并行算肤色掩码，CPU 只做连通域。失败即回退 CPU。 */
  var GPU_SHADER =
    'struct Params { tol : f32, pad0 : f32, pad1 : f32, pad2 : f32, };' +
    '@group(0) @binding(0) var<storage, read> src : array<u32>;' +
    '@group(0) @binding(1) var<storage, read_write> dst : array<u32>;' +
    '@group(0) @binding(2) var<uniform> params : Params;' +
    '@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id : vec3<u32>) {' +
    '  let i : u32 = id.x;' +
    '  if (i >= 19200u) { return; }' +
    '  let px : u32 = src[i];' +
    '  let r : f32 = f32(px & 255u);' +
    '  let g : f32 = f32((px >> 8u) & 255u);' +
    '  let b : f32 = f32((px >> 16u) & 255u);' +
    '  var skin : u32 = 0u;' +
    '  if (r > 40.0 && g > 25.0 && b > 15.0 && r > g && g > b && (r - b) > 18.0) {' +
    '    let y : f32 = 0.299 * r + 0.587 * g + 0.114 * b;' +
    '    let cb : f32 = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b;' +
    '    let cr : f32 = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b;' +
    '    let tol : f32 = params.tol;' +
    '    if (y > 35.0 && cb > 102.0 - 25.0 * tol && cb < 128.0 + 25.0 * tol && cr > 133.0 - 20.0 * tol && cr < 173.0 + 20.0 * tol) { skin = 1u; }' +
    '  }' +
    '  dst[i] = skin;' +
    '}';

  function readoutHtml(state) {
    return (
      '<div class="readout-title"><span>村民探测器</span><span>FACE DETECT</span></div>' +
      '<div class="readout-row"><span class="readout-label">引擎</span><span class="readout-value">' + state.engine + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">人面数</span><span class="readout-value">' + state.faces + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">最大人面</span><span class="readout-value">' + state.biggest + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">检测速度</span><span class="readout-value">' + state.detFps + ' /秒</span></div>' +
      '<div class="readout-row"><span class="readout-label">检测分辨率</span><span class="readout-value">' + DET_W + '×' + DET_H + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">镜头</span><span class="readout-value">' + (state.facing === 'user' ? '前置' : '后置') + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">' + state.status + '</span></div>' +
      '<div class="module-note">本机运算，不上传。轻量模型：正面、光线好时最稳；想更高精度可换 MediaPipe / ONNX 模型。</div>'
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
      if (!feature.webgpu && typeof window.FaceDetector === 'undefined') {
        return { status: 'partial', reason: '无 WebGPU、无原生 FaceDetector，将用 CPU 肤色检测（仍可工作，速度较慢）。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      var state = {
        facing: 'user',
        engine: '检测中…',
        faces: 0,
        biggest: '--',
        detFps: 0,
        status: '等待授权'
      };
      var stream = null;
      var streamGeneration = 0;
      var paused = false;
      var sensitivity = 1.0;
      var showMask = false;
      var tracked = [];
      var nextTrackId = 1;
      var firstFace = false;
      var firstFrame = false;
      var detCount = 0;
      var detLast = performance.now();
      var nativeDetector = null;
      var gpu = null;
      var gpuFailed = false;
      var gpuLogged = false;
      var detectInFlight = false;

      var sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = DET_W;
      sampleCanvas.height = DET_H;
      var sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      var maskCanvas = document.createElement('canvas');
      maskCanvas.width = DET_W;
      maskCanvas.height = DET_H;
      var maskCtx = maskCanvas.getContext('2d');

      ctx.root.innerHTML =
        '<div class="module module-face-detect">' +
        '<div class="stage-frame ratio-4x3">' +
        '<div class="face-viewport"><video id="face-video" autoplay playsinline muted></video>' +
        '<canvas id="face-overlay"></canvas>' +
        '<div class="frame-corners"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>' +
        '<div class="stage-overlay" id="face-paused" hidden>已暂停<br><span>点击「继续」重新打开摄像头</span></div>' +
        '</div>' +
        '<div class="frame-hud"><span class="hud-chip" id="face-res">--</span>' +
        '<span class="hud-chip"><span class="rec-dot"></span> FACE</span>' +
        '<span class="hud-chip" id="face-count">0 张脸</span></div>' +
        '</div>' +
        '<div class="face-mask-wrap" id="face-mask-wrap" hidden><canvas id="face-mask" width="160" height="120"></canvas><span class="module-note">肤色遮罩（调试用：白色 = 判为肤色）</span></div>' +
        '<div class="slider-row"><label for="face-sens">灵敏度</label>' +
        '<input type="range" id="face-sens" min="0.5" max="1.5" step="0.1" value="1.0">' +
        '<span class="slider-value" id="face-sens-val">1.0</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="face-switch">切换镜头</button>' +
        '<button class="mc-btn primary" type="button" id="face-shot">拍照带框</button>' +
        '<button class="mc-btn" type="button" id="face-mask-btn" aria-pressed="false">显示遮罩</button>' +
        '<button class="mc-btn danger" type="button" id="face-pause">暂停</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="face-note">正在申请摄像头…</span>' +
        '</div>' +
        '<p class="module-note">正面朝向镜头、光线充足时最稳。视频只在本机处理，不上传、不保存。</p>' +
        '</div>';

      var video = ctx.root.querySelector('#face-video');
      var overlay = ctx.root.querySelector('#face-overlay');
      var overlayCtx = overlay.getContext('2d');
      var note = ctx.root.querySelector('#face-note');
      var resChip = ctx.root.querySelector('#face-res');
      var countChip = ctx.root.querySelector('#face-count');
      var switchBtn = ctx.root.querySelector('#face-switch');
      var shotBtn = ctx.root.querySelector('#face-shot');
      var maskBtn = ctx.root.querySelector('#face-mask-btn');
      var pauseBtn = ctx.root.querySelector('#face-pause');
      var pausedOverlay = ctx.root.querySelector('#face-paused');
      var sensInput = ctx.root.querySelector('#face-sens');
      var sensVal = ctx.root.querySelector('#face-sens-val');
      var maskWrap = ctx.root.querySelector('#face-mask-wrap');
      var maskView = ctx.root.querySelector('#face-mask');
      var maskViewCtx = maskView.getContext('2d');

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

      async function initGpu() {
        if (gpuFailed || !navigator.gpu) return null;
        try {
          var adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
          if (!adapter) return null;
          var device = await adapter.requestDevice();
          var module = device.createShaderModule({ code: GPU_SHADER });
          var pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: module, entryPoint: 'main' }
          });
          var srcBuf = device.createBuffer({ size: DET_N * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
          var dstBuf = device.createBuffer({ size: DET_N * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
          var readBuf = device.createBuffer({ size: DET_N * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          var paramBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
          var bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: srcBuf } },
              { binding: 1, resource: { buffer: dstBuf } },
              { binding: 2, resource: { buffer: paramBuf } }
            ]
          });
          gpu = { device: device, pipeline: pipeline, srcBuf: srcBuf, dstBuf: dstBuf, readBuf: readBuf, paramBuf: paramBuf, bindGroup: bindGroup };
          return gpu;
        } catch (e) {
          gpuFailed = true;
          return null;
        }
      }

      async function gpuDetect(imageData, sens) {
        if (!gpu) gpu = await initGpu();
        if (!gpu) return null;
        try {
          var data = imageData.data;
          var packed = new Uint32Array(DET_N);
          var lum = new Uint8Array(DET_N);
          for (var i = 0; i < DET_N; i += 1) {
            var o = i * 4;
            packed[i] = data[o] | (data[o + 1] << 8) | (data[o + 2] << 16);
            lum[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
          }
          var device = gpu.device;
          device.queue.writeBuffer(gpu.srcBuf, 0, packed);
          device.queue.writeBuffer(gpu.paramBuf, 0, new Float32Array([sens, 0, 0, 0]));
          var encoder = device.createCommandEncoder();
          var pass = encoder.beginComputePass();
          pass.setPipeline(gpu.pipeline);
          pass.setBindGroup(0, gpu.bindGroup);
          pass.dispatchWorkgroups(Math.ceil(DET_N / 64));
          pass.end();
          encoder.copyBufferToBuffer(gpu.dstBuf, 0, gpu.readBuf, 0, DET_N * 4);
          device.queue.submit([encoder.finish()]);
          await gpu.readBuf.mapAsync(GPUMapMode.READ);
          var out = new Uint32Array(gpu.readBuf.getMappedRange().slice(0));
          gpu.readBuf.unmap();
          var mask = new Uint8Array(DET_N);
          for (var j = 0; j < DET_N; j += 1) mask[j] = out[j] ? 1 : 0;
          return { boxes: boxesFromMask(mask, lum, sens), mask: mask };
        } catch (e) {
          gpuFailed = true;
          if (!gpuLogged) {
            gpuLogged = true;
            SC.core.log.add('WebGPU 检测失败，已回退 CPU：' + (e && e.message ? e.message : e));
          }
          try { if (gpu) gpu.device.destroy(); } catch (ignored) {}
          gpu = null;
          return null;
        }
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
              lastSeen: now
            });
          } else {
            next.push({ id: nextTrackId++, x: box.x, y: box.y, w: box.w, h: box.h, score: box.score, lastSeen: now });
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
          var label = 'FACE ' + (idx + 1) + ' · ' + Math.round(box.score * 100) + '%';
          overlayCtx.font = 'bold 13px monospace';
          var tw = overlayCtx.measureText(label).width;
          overlayCtx.fillStyle = '#7fff2a';
          overlayCtx.fillRect(x, Math.max(0, y - 20), tw + 10, 18);
          overlayCtx.fillStyle = '#1b1b1f';
          overlayCtx.fillText(label, x + 5, Math.max(13, y - 6));
        });
      }

      function drawMask(mask) {
        if (!showMask || !mask) return;
        var img = maskViewCtx.createImageData(DET_W, DET_H);
        for (var i = 0; i < DET_N; i += 1) {
          var v = mask[i] ? 255 : 0;
          img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
        }
        maskViewCtx.putImageData(img, 0, 0);
      }

      async function detectOnce() {
        if (!stream || paused || !video.videoWidth) return;
        /* 上一次检测还没跑完就跳过这一拍：WebGPU 的 mapAsync 和
           缓冲区不能并发，否则会抛错并永久回退 CPU。 */
        if (detectInFlight) return;
        detectInFlight = true;
        try {
          await detectOnceInner();
        } finally {
          detectInFlight = false;
        }
      }

      async function detectOnceInner() {
        var frame;
        try {
          sampleCtx.drawImage(video, 0, 0, DET_W, DET_H);
          frame = sampleCtx.getImageData(0, 0, DET_W, DET_H);
        } catch (e) { return; }
        var result = null;
        /* 第 1 层：原生 FaceDetector（Chrome 桌面有，iPhone 没有） */
        if (typeof window.FaceDetector !== 'undefined') {
          try {
            if (!nativeDetector) nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
            var faces = await nativeDetector.detect(video);
            if (faces && faces.length) {
              state.engine = '原生 FaceDetector';
              result = {
                boxes: faces.map(function (f) {
                  var b = f.boundingBox;
                  return { x: b.x / video.videoWidth, y: b.y / video.videoHeight, w: b.width / video.videoWidth, h: b.height / video.videoHeight, score: 0.9 };
                }),
                mask: null
              };
            }
          } catch (e) { nativeDetector = null; }
        }
        /* 第 2 层：WebGPU 肤色掩码 */
        if (!result && navigator.gpu && !gpuFailed) {
          state.engine = 'WebGPU + CPU';
          result = await gpuDetect(frame, sensitivity);
          if (result) state.engine = 'WebGPU + CPU';
        }
        /* 第 3 层：CPU 肤色检测 */
        if (!result) {
          state.engine = 'CPU 肤色检测';
          result = cpuDetect(frame, sensitivity);
        }
        detCount += 1;
        var now = performance.now();
        if (now - detLast >= 1000) {
          state.detFps = Math.round((detCount * 1000) / (now - detLast));
          detCount = 0;
          detLast = now;
        }
        var smoothed = smoothBoxes(result.boxes);
        state.faces = smoothed.length;
        state.biggest = smoothed.length
          ? Math.round(Math.max.apply(null, smoothed.map(function (b) { return b.w * 100; }))) + '% 宽'
          : '--';
        drawMask(result.mask);
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
        note.textContent = '正在申请摄像头…';
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
          pauseBtn.textContent = '暂停';
          state.resolution = video.videoWidth + '×' + video.videoHeight;
          state.status = '运行中';
          note.textContent = '检测中：约每 120ms 检测一次';
          refreshReadout();
          if (!firstFrame) {
            firstFrame = true;
            ctx.toast({ icon: 'face', title: '成就达成！', subtitle: '睁眼看村民：人面识别已启动' });
          }
          SC.core.log.add('人面识别已启动（' + (state.facing === 'user' ? '前置' : '后置') + '）');
        } catch (error) {
          if (!ctx.isActive()) return;
          state.status = '失败';
          note.textContent = '无法启动';
          refreshReadout();
          ctx.showError(new Error(friendlyError(error)), error && error.name);
        }
      }

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
        sensitivity = parseFloat(sensInput.value) || 1.0;
        sensVal.textContent = sensitivity.toFixed(1);
      });

      maskBtn.addEventListener('click', function () {
        showMask = !showMask;
        maskBtn.setAttribute('aria-pressed', String(showMask));
        maskWrap.hidden = !showMask;
        if (!showMask) maskViewCtx.clearRect(0, 0, DET_W, DET_H);
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
        try { if (gpu) gpu.device.destroy(); } catch (ignored) {}
        gpu = null;
      });
      refreshReadout();
      start();
    }
  });
})(window.SC = window.SC || {});
