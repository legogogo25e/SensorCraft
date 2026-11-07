/* YOLO 识别：ONNX Runtime Web + YOLO11n，多类别实时框选。
 *
 * 为什么是这个组合：
 * - 人面卡用 MediaPipe BlazeFace 只认脸；这张卡要认「万物」，
 *   就用 COCO 80 类的 YOLO11n（人、车、狗、猫、手机、椅子……）。
 *   YOLO11n 是 YOLOv8n 的后继，同级最轻，输入输出格式和 v8
 *   一样（[1,84,anchors]：4 个框坐标 + 80 类分数）。
 * - 模型是 Ultralytics 官方 v8.3.0 的 yolo11n.onnx（FP32，
 *   10,930,182 字节），经 onnxruntime 动态 INT8 量化后
 *   3,238,790 字节，体积少 70%，精度略降（实测：真人 0.95、
 *   狗 0.78、街景 2 辆车；FP32 同图是 0.95、0.95、4 辆车）。
 *   量化版存在 repo 的 models/yolo11n-int8.onnx，同源加载，
 *   不走 CDN、不怕 CORS。想换回 FP32 时把 MODEL_URL 改成
 *   models/yolo11n.onnx 并上传 FP32 文件即可。
 * - 许可证：YOLO11n 权重是 Ultralytics AGPL-3.0；
 *   onnxruntime-web 是 MIT。商业使用前请自行核对 AGPL 条款。
 * - 运行时：onnxruntime-web@1.29.0（固定版本），只加载
 *   WASM 专用的 ort.wasm.min.js（不含 WebGPU/JSEP 代码）：
 *   全量 ort.min.js 会在有 navigator.gpu 时走 JSEP 路径，
 *   而 JSEP 在 Safari 26 上有已知严重 bug（CPU 400%+、
 *   内存暴涨），必须避开。只走 WASM；GitHub Pages 不发
 *   COOP/COEP，所以强制单线程（numThreads = 1）。首次约
 *   14MB WASM + 3.1MB 模型，之后走浏览器缓存。
 *   输入 416×416（模型输入是动态的，320/416/640 都能跑；
 *   416 是速度和远处小物体的折中，嫌慢可改成 320）。
 * - NMS 和框解码是自己写的（ORT 不帮 YOLO 做 NMS），
 *   预处理是标准 letterbox（等比缩放 + 灰边 114）。
 * - 全部本机运算，视频帧不上传、不保存；离开卡片即释放
 *   摄像头并释放推理会话。
 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var ORT_VERSION = '1.29.0';
  var ORT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VERSION + '/dist/ort.wasm.min.js';
  var ORT_WASM_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VERSION + '/dist/';
  var MODEL_URL = './models/yolo11n-int8.onnx';
  var INPUT_SIZE = 416;
  var DETECT_MS = 500;
  var IOU_THRESHOLD = 0.45;
  var MAX_BOXES = 10;

  /* COCO 80 类：[英文名, 中文名] */
  var CLASSES = [
    ['person', '人'], ['bicycle', '自行车'], ['car', '汽车'], ['motorcycle', '摩托车'],
    ['airplane', '飞机'], ['bus', '公交车'], ['train', '火车'], ['truck', '卡车'],
    ['boat', '船'], ['traffic light', '红绿灯'], ['fire hydrant', '消防栓'], ['stop sign', '停车标志'],
    ['parking meter', '咪表'], ['bench', '长椅'], ['bird', '鸟'], ['cat', '猫'],
    ['dog', '狗'], ['horse', '马'], ['sheep', '羊'], ['cow', '牛'],
    ['elephant', '大象'], ['bear', '熊'], ['zebra', '斑马'], ['giraffe', '长颈鹿'],
    ['backpack', '背包'], ['umbrella', '雨伞'], ['handbag', '手提包'], ['tie', '领带'],
    ['suitcase', '行李箱'], ['frisbee', '飞盘'], ['skis', '滑雪板'], ['snowboard', '单板滑雪'],
    ['sports ball', '球'], ['kite', '风筝'], ['baseball bat', '棒球棒'], ['baseball glove', '棒球手套'],
    ['skateboard', '滑板'], ['surfboard', '冲浪板'], ['tennis racket', '网球拍'], ['bottle', '瓶子'],
    ['wine glass', '酒杯'], ['cup', '杯子'], ['fork', '叉子'], ['knife', '刀'],
    ['spoon', '勺子'], ['bowl', '碗'], ['banana', '香蕉'], ['apple', '苹果'],
    ['sandwich', '三明治'], ['orange', '橙子'], ['broccoli', '西兰花'], ['carrot', '胡萝卜'],
    ['hot dog', '热狗'], ['pizza', '披萨'], ['donut', '甜甜圈'], ['cake', '蛋糕'],
    ['chair', '椅子'], ['couch', '沙发'], ['potted plant', '盆栽'], ['bed', '床'],
    ['dining table', '餐桌'], ['toilet', '马桶'], ['tv', '电视'], ['laptop', '笔记本电脑'],
    ['mouse', '鼠标'], ['remote', '遥控器'], ['keyboard', '键盘'], ['cell phone', '手机'],
    ['microwave', '微波炉'], ['oven', '烤箱'], ['toaster', '烤面包机'], ['sink', '水槽'],
    ['refrigerator', '冰箱'], ['book', '书'], ['clock', '钟'], ['vase', '花瓶'],
    ['scissors', '剪刀'], ['teddy bear', '泰迪熊'], ['hair drier', '吹风机'], ['toothbrush', '牙刷']
  ];

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

  function colorFor(classId) {
    return 'hsl(' + ((classId * 47) % 360) + ', 90%, 55%)';
  }

  /* NMS：按分数排序，同类且 IoU 超阈值的只留最高分。 */
  function nms(boxes) {
    var sorted = boxes.slice().sort(function (a, b) { return b.score - a.score; });
    var kept = [];
    sorted.forEach(function (b) {
      for (var i = 0; i < kept.length; i += 1) {
        var k = kept[i];
        if (k.classId !== b.classId) continue;
        var x1 = Math.max(b.x, k.x);
        var y1 = Math.max(b.y, k.y);
        var x2 = Math.min(b.x + b.w, k.x + k.w);
        var y2 = Math.min(b.y + b.h, k.y + k.h);
        var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        var union = b.w * b.h + k.w * k.h - inter;
        if (union > 0 && inter / union > IOU_THRESHOLD) return;
      }
      kept.push(b);
    });
    return kept.slice(0, MAX_BOXES);
  }

  function readoutHtml(state) {
    return (
      '<div class="readout-title"><span>万物探测器</span><span>YOLO DETECT</span></div>' +
      '<div class="readout-row"><span class="readout-label">引擎</span><span class="readout-value">' + state.engine + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">模型</span><span class="readout-value">' + state.model + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">物体数</span><span class="readout-value">' + state.count + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">看到的</span><span class="readout-value">' + state.seen + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">检测速度</span><span class="readout-value">' + state.detFps + ' /秒</span></div>' +
      '<div class="readout-row"><span class="readout-label">单次推理</span><span class="readout-value">' + state.inferMs + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">镜头</span><span class="readout-value">' + (state.facing === 'user' ? '前置' : '后置') + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">' + state.status + '</span></div>' +
      '<div class="module-note">本机运算，不上传。YOLO11n 认 COCO 80 类：人、车、狗、猫、手机、椅子等；首次需联网下载 ONNX 运行时（约 14MB）+ 模型（约 3.1MB），之后走浏览器缓存。</div>'
    );
  }

  SC.registerSensor({
    id: 'yolo-detect',
    name: 'YOLO 识别',
    en: 'YOLO DETECT',
    group: '影像与声音',
    icon: 'yolo',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: 'YOLO 识别需要 HTTPS 或 localhost，当前不是安全上下文。' };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持 getUserMedia。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      var state = {
        facing: 'environment',
        engine: '加载模型中…',
        model: 'YOLO11n INT8',
        count: 0,
        seen: '--',
        detFps: 0,
        inferMs: '--',
        status: '等待授权'
      };
      var stream = null;
      var streamGeneration = 0;
      var paused = false;
      var threshold = 0.4;
      var tracked = [];
      var nextTrackId = 1;
      var firstDetect = false;
      var firstFrame = false;
      var detCount = 0;
      var detLast = performance.now();
      var detectInFlight = false;

      var session = null;
      var sessionLoading = false;
      var sessionFailed = false;

      var letterCanvas = document.createElement('canvas');
      letterCanvas.width = INPUT_SIZE;
      letterCanvas.height = INPUT_SIZE;
      var letterCtx = letterCanvas.getContext('2d', { willReadFrequently: true });
      var inputData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

      ctx.root.innerHTML =
        '<div class="module module-face-detect">' +
        '<div class="stage-frame ratio-4x3">' +
        '<div class="face-viewport"><video id="yolo-video" autoplay playsinline muted></video>' +
        '<canvas id="yolo-overlay"></canvas>' +
        '<div class="frame-corners"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>' +
        '<div class="stage-overlay" id="yolo-paused" hidden>已暂停<br><span>点击「继续」重新打开摄像头</span></div>' +
        '</div>' +
        '<div class="frame-hud"><span class="hud-chip" id="yolo-res">--</span>' +
        '<span class="hud-chip"><span class="rec-dot"></span> YOLO</span>' +
        '<span class="hud-chip" id="yolo-count">0 个物体</span></div>' +
        '</div>' +
        '<div class="slider-row"><label for="yolo-sens">置信度</label>' +
        '<input type="range" id="yolo-sens" min="0.25" max="0.7" step="0.05" value="0.4">' +
        '<span class="slider-value" id="yolo-sens-val">0.40</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="yolo-switch">切换镜头</button>' +
        '<button class="mc-btn primary" type="button" id="yolo-shot">拍照带框</button>' +
        '<button class="mc-btn danger" type="button" id="yolo-pause">暂停</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="yolo-note">正在加载 AI 模型…</span>' +
        '</div>' +
        '<p class="module-note">默认后置镜头，对准人、车、动物、日常物品试试。YOLO11n 认 COCO 80 类，视频只在本机处理，不上传、不保存。</p>' +
        '</div>';

      var video = ctx.root.querySelector('#yolo-video');
      var overlay = ctx.root.querySelector('#yolo-overlay');
      var overlayCtx = overlay.getContext('2d');
      var note = ctx.root.querySelector('#yolo-note');
      var resChip = ctx.root.querySelector('#yolo-res');
      var countChip = ctx.root.querySelector('#yolo-count');
      var switchBtn = ctx.root.querySelector('#yolo-switch');
      var shotBtn = ctx.root.querySelector('#yolo-shot');
      var pauseBtn = ctx.root.querySelector('#yolo-pause');
      var pausedOverlay = ctx.root.querySelector('#yolo-paused');
      var sensInput = ctx.root.querySelector('#yolo-sens');
      var sensVal = ctx.root.querySelector('#yolo-sens-val');

      function refreshReadout() {
        ctx.setReadout(readoutHtml(state));
        resChip.textContent = (video.videoWidth || 0) + '×' + (video.videoHeight || 0);
        countChip.textContent = state.count + ' 个物体';
      }

      function stopStream() {
        if (stream) {
          stream.getTracks().forEach(function (track) { track.stop(); });
          stream = null;
        }
        video.srcObject = null;
      }

      function loadOrtScript() {
        return new Promise(function (resolve, reject) {
          if (window.ort) { resolve(window.ort); return; }
          var script = document.createElement('script');
          script.src = ORT_SCRIPT_URL;
          script.onload = function () { resolve(window.ort); };
          script.onerror = function () { reject(new Error('ONNX Runtime 加载失败，请检查网络')); };
          document.head.appendChild(script);
        });
      }

      async function initSession() {
        if (session || sessionLoading || sessionFailed) return;
        sessionLoading = true;
        state.engine = '加载模型中…';
        note.textContent = '正在加载 ONNX 运行时…（首次约 14MB，需联网）';
        refreshReadout();
        try {
          var ort = await loadOrtScript();
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.wasmPaths = ORT_WASM_URL;
          note.textContent = '正在加载 YOLO 模型…（约 3.1MB）';
          refreshReadout();
          session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
          sessionLoading = false;
          state.engine = 'ONNX Runtime Web (WASM)';
          state.model = 'YOLO11n INT8';
          note.textContent = '检测中：YOLO11n 已就绪';
          SC.core.log.add('YOLO 识别模型已加载：YOLO11n INT8 (ONNX Runtime Web WASM)');
          refreshReadout();
        } catch (e) {
          sessionLoading = false;
          sessionFailed = true;
          session = null;
          state.engine = '加载失败';
          state.model = 'YOLO11n INT8';
          note.textContent = '模型加载失败：' + (e && e.message ? e.message : '请检查网络后重开卡片');
          SC.core.log.add('YOLO 模型加载失败：' + (e && e.message ? e.message : e));
          refreshReadout();
        }
      }

      function smoothBoxes(raw) {
        var now = performance.now();
        var next = [];
        raw.forEach(function (box) {
          var best = null;
          var bestDist = 1e9;
          tracked.forEach(function (t) {
            if (t.classId !== box.classId) return;
            var dx = (box.x + box.w / 2) - (t.x + t.w / 2);
            var dy = (box.y + box.h / 2) - (t.y + t.h / 2);
            var d = dx * dx + dy * dy;
            if (d < bestDist) { bestDist = d; best = t; }
          });
          if (best && bestDist < 0.04) {
            next.push({
              id: best.id, classId: box.classId,
              x: best.x + (box.x - best.x) * 0.5,
              y: best.y + (box.y - best.y) * 0.5,
              w: best.w + (box.w - best.w) * 0.5,
              h: best.h + (box.h - best.h) * 0.5,
              score: box.score, lastSeen: now
            });
          } else {
            next.push({ id: nextTrackId++, classId: box.classId, x: box.x, y: box.y, w: box.w, h: box.h, score: box.score, lastSeen: now });
          }
        });
        tracked.forEach(function (t) {
          if (now - t.lastSeen < 800 && !next.some(function (n) { return n.id === t.id; })) {
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
        tracked.forEach(function (box) {
          var x = box.x * overlay.width;
          var y = box.y * overlay.height;
          var w = box.w * overlay.width;
          var h = box.h * overlay.height;
          var color = colorFor(box.classId);
          overlayCtx.strokeStyle = color;
          overlayCtx.lineWidth = 3;
          overlayCtx.strokeRect(x, y, w, h);
          overlayCtx.strokeStyle = '#ffffff';
          overlayCtx.lineWidth = 2;
          var c = 12;
          overlayCtx.beginPath();
          overlayCtx.moveTo(x, y + c); overlayCtx.lineTo(x, y); overlayCtx.lineTo(x + c, y);
          overlayCtx.moveTo(x + w - c, y); overlayCtx.lineTo(x + w, y); overlayCtx.lineTo(x + w, y + c);
          overlayCtx.moveTo(x, y + h - c); overlayCtx.lineTo(x, y + h); overlayCtx.lineTo(x + c, y + h);
          overlayCtx.moveTo(x + w - c, y + h); overlayCtx.lineTo(x + w, y + h); overlayCtx.lineTo(x + w, y + h - c);
          overlayCtx.stroke();
          var label = CLASSES[box.classId][1] + ' · ' + Math.round(box.score * 100) + '%';
          overlayCtx.font = 'bold 13px monospace';
          var tw = overlayCtx.measureText(label).width;
          overlayCtx.fillStyle = color;
          overlayCtx.fillRect(x, Math.max(0, y - 20), tw + 10, 18);
          overlayCtx.fillStyle = '#1b1b1f';
          overlayCtx.fillText(label, x + 5, Math.max(13, y - 6));
        });
      }

      async function detectOnce() {
        if (!stream || paused || !video.videoWidth || !session) return;
        if (detectInFlight) return;
        detectInFlight = true;
        try {
          await detectOnceInner();
        } finally {
          detectInFlight = false;
        }
      }

      async function detectOnceInner() {
        var t0 = performance.now();
        /* letterbox：等比缩放 + 灰边，记下缩放和偏移以便把框映射回去。 */
        var vw = video.videoWidth;
        var vh = video.videoHeight;
        var scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
        var dw = vw * scale;
        var dh = vh * scale;
        var ox = (INPUT_SIZE - dw) / 2;
        var oy = (INPUT_SIZE - dh) / 2;
        letterCtx.fillStyle = '#727272';
        letterCtx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
        letterCtx.drawImage(video, ox, oy, dw, dh);
        var frame;
        try {
          frame = letterCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
        } catch (e) { return; }
        var data = frame.data;
        var n = INPUT_SIZE * INPUT_SIZE;
        for (var i = 0; i < n; i += 1) {
          var o = i * 4;
          inputData[i] = data[o] / 255;
          inputData[n + i] = data[o + 1] / 255;
          inputData[2 * n + i] = data[o + 2] / 255;
        }
        var result;
        try {
          var tensor = new window.ort.Tensor('float32', inputData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
          result = await session.run({ images: tensor });
        } catch (e) {
          SC.core.log.add('YOLO 推理出错：' + (e && e.message ? e.message : e));
          return;
        }
        var out = result.output0.data;
        var dims = result.output0.dims;
        var anchors = dims[2];
        var boxes = [];
        for (var a = 0; a < anchors; a += 1) {
          var bestClass = -1;
          var bestScore = 0;
          for (var k = 0; k < 80; k += 1) {
            var sc = out[(4 + k) * anchors + a];
            if (sc > bestScore) { bestScore = sc; bestClass = k; }
          }
          if (bestClass < 0 || bestScore < threshold) continue;
          var cx = out[a];
          var cy = out[anchors + a];
          var bw = out[2 * anchors + a];
          var bh = out[3 * anchors + a];
          var x1 = (cx - bw / 2 - ox) / scale / vw;
          var y1 = (cy - bh / 2 - oy) / scale / vh;
          var x2 = (cx + bw / 2 - ox) / scale / vw;
          var y2 = (cy + bh / 2 - oy) / scale / vh;
          boxes.push({
            classId: bestClass,
            x: Math.max(0, x1), y: Math.max(0, y1),
            w: Math.min(1, x2) - Math.max(0, x1),
            h: Math.min(1, y2) - Math.max(0, y1),
            score: bestScore
          });
        }
        boxes = boxes.filter(function (b) { return b.w > 0.02 && b.h > 0.02; });
        var kept = nms(boxes);
        state.inferMs = Math.round(performance.now() - t0) + 'ms';
        detCount += 1;
        var now = performance.now();
        if (now - detLast >= 1000) {
          state.detFps = Math.round((detCount * 1000) / (now - detLast));
          detCount = 0;
          detLast = now;
        }
        var smoothed = smoothBoxes(kept);
        state.count = smoothed.length;
        var seenNames = [];
        smoothed.forEach(function (b) {
          var name = CLASSES[b.classId][1];
          if (seenNames.indexOf(name) === -1) seenNames.push(name);
        });
        state.seen = seenNames.length ? seenNames.join('、') : '--';
        if (smoothed.length && !firstDetect) {
          firstDetect = true;
          ctx.toast({ icon: 'yolo', title: '成就达成！', subtitle: '初见万物：第一次框到物体' });
          SC.core.log.add('YOLO 识别：首次检测到物体（' + state.seen + '）');
        }
        refreshReadout();
      }

      async function start() {
        var generation = ++streamGeneration;
        stopStream();
        state.status = '申请中';
        refreshReadout();
        note.textContent = session ? '正在申请摄像头…' : '正在加载 AI 模型…';
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
          state.status = '运行中';
          note.textContent = session ? '检测中：YOLO11n' : '检测中：模型加载中，稍后开始框选';
          refreshReadout();
          if (!firstFrame) {
            firstFrame = true;
            ctx.toast({ icon: 'yolo', title: '成就达成！', subtitle: '睁眼看万物：YOLO 识别已启动' });
          }
          SC.core.log.add('YOLO 识别已启动（' + (state.facing === 'user' ? '前置' : '后置') + '）');
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
          SC.core.log.add('YOLO 识别已继续');
        } else {
          streamGeneration += 1;
          stopStream();
          paused = true;
          tracked = [];
          overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
          state.count = 0;
          state.seen = '--';
          state.status = '已暂停';
          note.textContent = '已暂停，摄像头已释放';
          pauseBtn.textContent = '继续';
          pausedOverlay.hidden = false;
          refreshReadout();
          SC.core.log.add('YOLO 识别已暂停');
        }
      });

      sensInput.addEventListener('input', function () {
        threshold = parseFloat(sensInput.value) || 0.4;
        sensVal.textContent = threshold.toFixed(2);
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
          a.download = 'sensorcraft-yolo-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
          SC.core.log.add('YOLO 识别已拍照 ' + canvas.width + '×' + canvas.height + '（' + state.count + ' 个物体）');
        }, 'image/png');
      });

      ctx.raf(function () {
        if (stream && !paused && video.videoWidth) drawBoxes();
      });
      ctx.interval(function () { detectOnce(); }, DETECT_MS);
      ctx.onCleanup(function () {
        tracked = [];
        try { if (session && session.release) session.release(); } catch (ignored) {}
        session = null;
      });
      refreshReadout();
      initSession();
      start();
    }
  });
})(window.SC = window.SC || {});
