/* YOLO 识别：ONNX Runtime Web + 可切换模型，多类别实时框选。
 *
 * 为什么是这个组合：
 * - 人面卡用 MediaPipe BlazeFace 只认脸；这张卡要认「万物」，
 *   就用 COCO 80 类的 YOLO（人、车、狗、猫、手机、椅子……）。
 * - 卡片工具栏里有个模型选择器，两个模型可以随时切换着对比，
 *   选择会记在 localStorage，下次打开还是上次那个。
 *   - YOLO26n（默认，Ultralytics 2026-01-14 发布，v8.4.0 的
 *     yolo26n.onnx，FP32 9,941,957 字节，INT8 量化后 2,908,710
 *     字节）：NMS-free 端到端，输出直接是 [1,300,6]（x1,y1,x2,y2,
 *     分数,类别），不用手写 NMS；COCO mAP 40.9，比 11n 高 1.4，
 *     CPU 快约 43%。代价：输入固定 640×640，单帧算量大。
 *     实测（INT8，置信度 0.4）：真人 0.95、狗 0.88、街景 4 辆
 *     车 + 1 人 + 1 红绿灯；FP32 同图是 0.96、0.92、5 车 + 2 人。
 *   - YOLO11n（Ultralytics v8.3.0 的 yolo11n.onnx，FP32
 *     10,930,182 字节，INT8 量化后 3,238,790 字节）：传统输出
 *     [1,84,anchors]（4 个框坐标 + 80 类分数），要手写 NMS；
 *     输入是动态的，这里用 416，单帧算量小所以更快。
 *     实测（INT8，置信度 0.4）：真人 0.95、狗 0.78、街景 2 辆车；
 *     FP32 同图是 0.95、0.95、4 辆车。
 *   - YOLOE-26n PF（Ultralytics 8.4.207 自行导出，yoloe-26n-seg-pf.pt，
 *     prompt-free，416 输入，FP32 15,589,855 字节）：不用打字就认
 *     内置 4,585 类（RAM++ tag list，类名在 js/sensors/yoloe-classes.js，
 *     与 ONNX metadata 的 names 顺序一致）。输出是分割模型端到端
 *     的 [1,300,38]（4 个框坐标 + 分数 + 类别 + 32 个 mask 系数），
 *     这里只解析前 6 列，mask 系数不用（不画分割轮廓）。
 *     实测（FP32，Node onnxruntime-web@1.29.0 WASM 单线程，同一台 VM）：
 *     416 输入约 0.8 秒/帧，bus 图：bus 0.86、人 0.82、stop sign 0.41，
 *     dog 图：pomeranian 0.91（品种名，不叫 dog）、bobcat 0.86，
 *     zidane 图：rock concert 0.88、jazz artist 0.87。
 *     两个要先讲明的代价：①词表里除了物体，还有品种、部位、场景
 *     （nose、city square、rock concert），标签看起来会比 COCO「野」，
 *     有些框的名字不对——这是 prompt-free 本身的特性，不是 bug；
 *     ②INT8 动态量化版实测反而更慢（同环境约 5.2 秒/帧，标签也更飘，
 *     如 evening light 0.97），所以 PF 版刻意不上 INT8，用 FP32。
 *     640 输入版也导过（约 1.9 秒/帧），核心检出差不多，416 更快，
 *     所以上线的是 416。detection-only 导出试过，pf 权重装不进
 *     yoloe-26n.yaml 的检测架构（'Sequential' object has no attribute
 *     'in_channels'），故用 seg 导出。
 *   三个量化版都在 repo 的 models/ 里（yolo26n-int8.onnx、
 *   yolo11n-int8.onnx），同源加载，不走 CDN、不怕 CORS。
 * - 许可证：YOLO 权重都是 Ultralytics AGPL-3.0；
 *   onnxruntime-web 是 MIT。商业使用前请自行核对 AGPL 条款。
 * - 运行时：onnxruntime-web@1.29.0（固定版本），只加载
 *   WASM 专用的 ort.wasm.min.js（不含 WebGPU/JSEP 代码）：
 *   全量 ort.min.js 会在有 navigator.gpu 时走 JSEP 路径，
 *   而 JSEP 在 Safari 26 上有已知严重 bug（CPU 400%+、
 *   内存暴涨），必须避开。只走 WASM；GitHub Pages 不发
 *   COOP/COEP，所以强制单线程（numThreads = 1）。首次约
 *   14MB WASM + 约 3MB 模型，之后走浏览器缓存。
 * - 预处理是标准 letterbox（等比缩放 + 灰边 114）。
 * - 全部本机运算，视频帧不上传、不保存；离开卡片即释放
 *   摄像头并释放推理会话。
 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var ORT_VERSION = '1.29.0';
  var ORT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VERSION + '/dist/ort.wasm.min.js';
  var ORT_WASM_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VERSION + '/dist/';
  /* 三个模型：26n 是 NMS-free 端到端（[1,300,6]），输入固定 640；
   * 11n 是传统输出（[1,84,anchors] + 手写 NMS），输入动态，这里用 416；
   * YOLOE-26n PF 是 prompt-free（[1,300,38]，只取前 6 列），4585 类，输入 416。 */
  var MODELS = {
    yolo26n: { label: 'YOLO26n INT8', file: './models/yolo26n-int8.onnx', inputSize: 640, endToEnd: true, rowWidth: 6, classCount: 80, sizeNote: '约 3MB', hint: '新 · 更准 · 640 输入' },
    yolo11n: { label: 'YOLO11n INT8', file: './models/yolo11n-int8.onnx', inputSize: 416, endToEnd: false, rowWidth: 0, classCount: 80, sizeNote: '约 3MB', hint: '快 · 416 输入' },
    yoloe26npf: { label: 'YOLOE-26n PF', file: './models/yoloe-26n-pf.onnx', inputSize: 416, endToEnd: true, rowWidth: 38, classCount: 4585, sizeNote: '约 15MB', hint: '认 4585 类 · 英文标签 · 416 输入' }
  };
  var MODEL_STORAGE_KEY = 'sensorcraft-yolo-model';
  function storedModel() {
    try {
      var v = window.localStorage.getItem(MODEL_STORAGE_KEY);
      if (v && MODELS[v]) return v;
    } catch (ignored) {}
    return 'yolo26n';
  }
  var MAX_INPUT_SIZE = 640;
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

  /* hsl 转 rgb（mask 填充用，ImageData 要数值三元组）。 */
  function hslToRgb(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  /* 实例分割 mask：PF 模型的输出里每行后 32 列是 mask 系数，
   * output1 是 32 张原型（proto，416 输入时是 104×104）。
   * mask = sigmoid(系数 · 原型)，阈值 0.5 等价于点积 > 0。
   * 只算框内那块原型像素，返回一块只覆盖框的小 canvas；
   * 没有任何像素过阈值就返回 null（不画）。 */
  function computeMaskCanvas(box, proto, protoW, protoH, inputSize) {
    if (!box.coeffs) return null;
    var scale = protoW / inputSize;
    var px1 = Math.max(0, Math.floor(box.lx1 * scale));
    var py1 = Math.max(0, Math.floor(box.ly1 * scale));
    var px2 = Math.min(protoW, Math.ceil(box.lx2 * scale));
    var py2 = Math.min(protoH, Math.ceil(box.ly2 * scale));
    var w = px2 - px1;
    var h = py2 - py1;
    if (w <= 0 || h <= 0) return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var c2d = canvas.getContext('2d');
    var img = c2d.createImageData(w, h);
    var data = img.data;
    var rgb = hslToRgb((box.classId * 47) % 360, 0.9, 0.55);
    var filled = 0;
    for (var y = 0; y < h; y += 1) {
      var py = py1 + y;
      for (var x = 0; x < w; x += 1) {
        var px = px1 + x;
        var v = 0;
        for (var c = 0; c < 32; c += 1) {
          v += box.coeffs[c] * proto[(c * protoH + py) * protoW + px];
        }
        if (v > 0) {
          var o = (y * w + x) * 4;
          data[o] = rgb[0];
          data[o + 1] = rgb[1];
          data[o + 2] = rgb[2];
          data[o + 3] = 255;
          filled += 1;
        }
      }
    }
    if (!filled) return null;
    c2d.putImageData(img, 0, 0);
    return canvas;
  }

  /* 框上显示的名字：COCO 模型显示中文名；PF 模型没有中文翻译，
   * 显示 4585 词表里的英文原名（品种、部位、场景名都会原样出现）。 */
  function labelFor(modelKey, classId) {
    if (modelKey === 'yoloe26npf') {
      var names = (SC.core && SC.core.yoloePfNames) || [];
      return names[classId] || ('class ' + classId);
    }
    return (CLASSES[classId] && CLASSES[classId][1]) || ('class ' + classId);
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
      '<div class="module-note">本机运算，不上传。YOLO26n / 11n 认 COCO 80 类（中文名）；YOLOE-26n PF 认内置 4585 类（英文原名，含品种、部位、场景名，标签会比较「野」）。首次需联网下载 ONNX 运行时（约 14MB）+ 模型（26n/11n 约 3MB，PF 约 15MB），之后走浏览器缓存。26n 更准但输入 640、单帧慢；11n 输入 416、单帧快；PF 416 输入、认得最多但标签最飘，工具栏可切换对比。</div>'
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
      var currentModel = storedModel();
      var state = {
        facing: 'environment',
        engine: '未开始',
        model: MODELS[currentModel].label,
        count: 0,
        seen: '--',
        detFps: 0,
        inferMs: '--',
        status: '未开始'
      };
      var stream = null;
      var streamGeneration = 0;
      var paused = false;
      /* 轮廓开关：只在 PF（分割）模型下有数据，26n/11n 开了也没轮廓；
       * 默认关，选择记在 localStorage，跟模型选择一样跨次打开保留。 */
      var MASK_STORAGE_KEY = 'sensorcraft-yolo-mask';
      var maskEnabled = false;
      try { maskEnabled = window.localStorage.getItem(MASK_STORAGE_KEY) === '1'; } catch (ignored) {}
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
      letterCanvas.width = MODELS[currentModel].inputSize;
      letterCanvas.height = MODELS[currentModel].inputSize;
      var letterCtx = letterCanvas.getContext('2d', { willReadFrequently: true });
      /* 按最大输入（640）分配，26n 和 11n 共用，切换模型时只改 canvas 尺寸。 */
      var inputData = new Float32Array(3 * MAX_INPUT_SIZE * MAX_INPUT_SIZE);

      ctx.root.innerHTML =
        '<div class="module module-face-detect">' +
        '<div class="stage-frame ratio-4x3">' +
        '<div class="face-viewport"><video id="yolo-video" autoplay playsinline muted></video>' +
        '<canvas id="yolo-overlay"></canvas>' +
        '<div class="frame-corners"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>' +
        '<div class="stage-overlay" id="yolo-paused" hidden>已暂停<br><span>点击「继续」重新打开摄像头</span></div>' +
        '<div class="stage-overlay" id="yolo-start"><div class="start-box">' +
        '<div class="start-title">YOLO 识别</div>' +
        '<div class="start-text">框出画面里的人、车、动物和日常物品。YOLO26n / 11n 认 COCO 80 类（中文名）；YOLOE-26n PF 不用打字就认内置 4585 类（英文名，含品种、部位、场景，标签会比较「野」）。点「开启」后，先下载 AI 模型和推理运行时（首次需联网，PF 模型约 15MB），再由浏览器申请摄像头权限；不点就不会问。</div>' +
        '<div class="start-actions"><button class="mc-btn primary" type="button" id="yolo-start-btn">开启 YOLO 识别</button>' +
        '<button class="mc-btn ghost" type="button" id="yolo-info-btn">先看看说明</button></div>' +
        '</div></div>' +
        '</div>' +
        '<div class="frame-hud"><span class="hud-chip" id="yolo-res">--</span>' +
        '<span class="hud-chip"><span class="rec-dot"></span> YOLO</span>' +
        '<span class="hud-chip" id="yolo-count">0 个物体</span></div>' +
        '</div>' +
        '<div class="slider-row"><label for="yolo-sens">置信度</label>' +
        '<input type="range" id="yolo-sens" min="0.25" max="0.7" step="0.05" value="0.4">' +
        '<span class="slider-value" id="yolo-sens-val">0.40</span></div>' +
        '<div class="slider-row"><label for="yolo-model">模型</label>' +
        '<select class="mc-select" id="yolo-model">' +
        '<option value="yolo26n">YOLO26n · 更准 · 640</option>' +
        '<option value="yolo11n">YOLO11n · 更快 · 416</option>' +
        '<option value="yoloe26npf">YOLOE-26n PF · 4585 类 · 416</option>' +
        '</select>' +
        '<span class="slider-value" id="yolo-model-hint"></span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="yolo-switch" disabled>切换镜头</button>' +
        '<button class="mc-btn primary" type="button" id="yolo-shot" disabled>拍照带框</button>' +
        '<button class="mc-btn danger" type="button" id="yolo-pause" disabled>暂停</button>' +
        '<button class="mc-btn" type="button" id="yolo-mask">轮廓：关</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="yolo-note">还没开始：点「开启」，先下载 AI 模型，再申请摄像头。</span>' +
        '</div>' +
        '<p class="module-note">默认后置镜头，对准人、车、动物、日常物品试试。YOLO26n / 11n 认 COCO 80 类，视频只在本机处理，不上传、不保存。换模型会重新加载（26n/11n 约 3MB，PF 约 15MB，缓存后很快），摄像头不用重开。PF 的 4585 类标签是英文，狗可能标成品名（如 pomeranian），人可能标成场景或职业（如 rock concert），属于 prompt-free 词表的特性。「轮廓」开关只在 PF 模型下有效：开后在框里填一层半透明轮廓（实例分割 mask），26n / 11n 没有 mask 数据，开了也不会画。</p>' +
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
      var maskBtn = ctx.root.querySelector('#yolo-mask');
      var pausedOverlay = ctx.root.querySelector('#yolo-paused');

      function refreshMaskButton() {
        maskBtn.textContent = maskEnabled ? '轮廓：开' : '轮廓：关';
      }
      var startOverlay = ctx.root.querySelector('#yolo-start');
      var startBtn = ctx.root.querySelector('#yolo-start-btn');
      var infoBtn = ctx.root.querySelector('#yolo-info-btn');

      function setToolbarEnabled(enabled) {
        [switchBtn, shotBtn, pauseBtn].forEach(function (b) {
          b.disabled = !enabled;
        });
      }
      var sensInput = ctx.root.querySelector('#yolo-sens');
      var sensVal = ctx.root.querySelector('#yolo-sens-val');
      var modelSelect = ctx.root.querySelector('#yolo-model');
      var modelHint = ctx.root.querySelector('#yolo-model-hint');
      modelSelect.value = currentModel;
      modelHint.textContent = MODELS[currentModel].inputSize + ' 输入';

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
        var model = MODELS[currentModel];
        sessionLoading = true;
        state.engine = '加载模型中…';
        state.model = model.label;
        note.textContent = '正在加载 ONNX 运行时…（首次约 14MB，需联网）';
        refreshReadout();
        try {
          var ort = await loadOrtScript();
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.wasmPaths = ORT_WASM_URL;
          note.textContent = '正在加载 ' + model.label + ' 模型…（' + (model.sizeNote || '约 3MB') + '）';
          refreshReadout();
          session = await ort.InferenceSession.create(model.file, { executionProviders: ['wasm'] });
          sessionLoading = false;
          state.engine = 'ONNX Runtime Web (WASM)';
          state.model = model.label;
          note.textContent = '检测中：' + model.label + ' 已就绪';
          SC.core.log.add('YOLO 识别模型已加载：' + model.label + ' (ONNX Runtime Web WASM)');
          refreshReadout();
        } catch (e) {
          sessionLoading = false;
          sessionFailed = true;
          session = null;
          state.engine = '加载失败';
          state.model = model.label;
          note.textContent = '模型加载失败：' + (e && e.message ? e.message : '请检查网络后重开卡片');
          SC.core.log.add('YOLO 模型加载失败：' + (e && e.message ? e.message : e));
          refreshReadout();
        }
      }

      /* 切换模型：释放旧会话，换输入尺寸，重载新模型；摄像头保持开启。
       * 正在加载时不接受切换，并把下拉框拨回当前模型，避免显示和实际不一致。 */
      function switchModel(key) {
        if (!MODELS[key] || key === currentModel) return;
        if (sessionLoading) { modelSelect.value = currentModel; return; }
        try { if (session && session.release) session.release(); } catch (ignored) {}
        session = null;
        sessionFailed = false;
        tracked = [];
        state.count = 0;
        state.seen = '--';
        state.inferMs = '--';
        currentModel = key;
        letterCanvas.width = MODELS[key].inputSize;
        letterCanvas.height = MODELS[key].inputSize;
        modelHint.textContent = MODELS[key].inputSize + ' 输入';
        try { window.localStorage.setItem(MODEL_STORAGE_KEY, key); } catch (ignored) {}
        state.model = MODELS[key].label;
        note.textContent = '正在切换到 ' + MODELS[key].label + '…';
        SC.core.log.add('YOLO 识别切换模型：' + MODELS[key].label);
        refreshReadout();
        initSession();
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
              score: box.score, lastSeen: now,
              mask: box.mask || best.mask
            });
          } else {
            next.push({ id: nextTrackId++, classId: box.classId, x: box.x, y: box.y, w: box.w, h: box.h, score: box.score, lastSeen: now, mask: box.mask });
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
          /* 轮廓画在框线下面：半透明填充，框和标签压在上面，字不糊。 */
          if (box.mask) {
            overlayCtx.globalAlpha = 0.35;
            overlayCtx.drawImage(box.mask, x, y, w, h);
            overlayCtx.globalAlpha = 1;
          }
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
          var label = labelFor(currentModel, box.classId) + ' · ' + Math.round(box.score * 100) + '%';
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
        var model = MODELS[currentModel];
        var size = model.inputSize;
        /* letterbox：等比缩放 + 灰边，记下缩放和偏移以便把框映射回去。 */
        var vw = video.videoWidth;
        var vh = video.videoHeight;
        var scale = Math.min(size / vw, size / vh);
        var dw = vw * scale;
        var dh = vh * scale;
        var ox = (size - dw) / 2;
        var oy = (size - dh) / 2;
        letterCtx.fillStyle = '#727272';
        letterCtx.fillRect(0, 0, size, size);
        letterCtx.drawImage(video, ox, oy, dw, dh);
        var frame;
        try {
          frame = letterCtx.getImageData(0, 0, size, size);
        } catch (e) { return; }
        var data = frame.data;
        var n = size * size;
        for (var i = 0; i < n; i += 1) {
          var o = i * 4;
          inputData[i] = data[o] / 255;
          inputData[n + i] = data[o + 1] / 255;
          inputData[2 * n + i] = data[o + 2] / 255;
        }
        var result;
        try {
          var tensor = new window.ort.Tensor('float32', inputData.subarray(0, 3 * n), [1, 3, size, size]);
          result = await session.run({ images: tensor });
        } catch (e) {
          SC.core.log.add('YOLO 推理出错：' + (e && e.message ? e.message : e));
          return;
        }
        var out = result.output0.data;
        var dims = result.output0.dims;
        var boxes = [];
        if (model.endToEnd) {
          /* 端到端输出 [1,300,W]：26n 是 W=6，每行 [x1,y1,x2,y2,分数,类别]；
             PF 是 W=38（分割模型：后面 32 列是 mask 系数，这里不用），
             前 6 列格式一样；坐标在 letterbox 像素空间里；模型已做过
             NMS，不用再去重。类别上限按模型来：COCO 80，PF 4585。 */
          var rows = dims[1];
          var stride = dims[2];
          for (var r = 0; r < rows; r += 1) {
            var base = r * stride;
            var score = out[base + 4];
            if (score < threshold) continue;
            var cls = Math.round(out[base + 5]);
            if (cls < 0 || cls >= model.classCount) continue;
            var x1 = (out[base] - ox) / scale / vw;
            var y1 = (out[base + 1] - oy) / scale / vh;
            var x2 = (out[base + 2] - ox) / scale / vw;
            var y2 = (out[base + 3] - oy) / scale / vh;
            /* PF（分割）模型每行后 32 列是 mask 系数：先存下来，
             * 框留下来之后再跟 output1 的原型算轮廓；26n stride=6 没有系数。 */
            var coeffs = null;
            if (stride > 6) {
              coeffs = [];
              for (var ci = 0; ci < 32; ci += 1) coeffs.push(out[base + 6 + ci]);
            }
            boxes.push({
              classId: cls,
              x: Math.max(0, x1), y: Math.max(0, y1),
              w: Math.min(1, x2) - Math.max(0, x1),
              h: Math.min(1, y2) - Math.max(0, y1),
              score: score,
              lx1: out[base], ly1: out[base + 1], lx2: out[base + 2], ly2: out[base + 3],
              coeffs: coeffs
            });
          }
          var kept = boxes
            .filter(function (b) { return b.w > 0.02 && b.h > 0.02; })
            .sort(function (a, b) { return b.score - a.score; })
            .slice(0, MAX_BOXES);
        } else {
          /* YOLO11n：输出 [1,84,anchors]，4 个框坐标（中心点 + 宽高）
             + 80 类分数，要自己取每类最高分再手写 NMS 去重。 */
          var anchors = dims[2];
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
            var x1b = (cx - bw / 2 - ox) / scale / vw;
            var y1b = (cy - bh / 2 - oy) / scale / vh;
            var x2b = (cx + bw / 2 - ox) / scale / vw;
            var y2b = (cy + bh / 2 - oy) / scale / vh;
            boxes.push({
              classId: bestClass,
              x: Math.max(0, x1b), y: Math.max(0, y1b),
              w: Math.min(1, x2b) - Math.max(0, x1b),
              h: Math.min(1, y2b) - Math.max(0, y1b),
              score: bestScore
            });
          }
          boxes = boxes.filter(function (b) { return b.w > 0.02 && b.h > 0.02; });
          var kept = nms(boxes);
        }
        /* 轮廓开关开着、且是 PF（分割）模型时：用本帧的 mask 系数 +
         * output1 原型（[1,32,H,W]，416 输入时 104×104）算每个框的轮廓。
         * 26n/11n 没有 output1，kept 里也不会带 coeffs，不会走到这里。 */
        if (maskEnabled && currentModel === 'yoloe26npf' && result.output1) {
          var proto = result.output1.data;
          var pDims = result.output1.dims;
          kept.forEach(function (b) {
            b.mask = computeMaskCanvas(b, proto, pDims[3], pDims[2], size);
          });
        }
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
          var name = labelFor(currentModel, b.classId);
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
          startOverlay.hidden = true;
          setToolbarEnabled(true);
          pauseBtn.textContent = '暂停';
          state.status = '运行中';
          note.textContent = session ? '检测中：' + MODELS[currentModel].label : '检测中：模型加载中，稍后开始框选';
          refreshReadout();
          if (!firstFrame) {
            firstFrame = true;
            ctx.toast({ icon: 'yolo', title: '成就达成！', subtitle: '睁眼看万物：YOLO 识别已启动' });
          }
          SC.core.log.add('YOLO 识别已启动（' + (state.facing === 'user' ? '前置' : '后置') + '）');
        } catch (error) {
          if (!ctx.isActive()) return;
          state.status = '失败';
          note.textContent = friendlyError(error);
          startOverlay.hidden = false;
          startBtn.textContent = '重新开启';
          refreshReadout();
          SC.core.log.add('YOLO 识别启动失败：' + (error && error.name ? error.name : error));
        }
      }

      /* 权限与模型下载只在用户点了「开启」之后才发生；拒绝后留在卡里，可重新点开启再试。 */
      startBtn.addEventListener('click', function () {
        initSession();
        start();
      });
      infoBtn.addEventListener('click', function () {
        SC.ui.sensorInfo.open('yolo-detect');
      });

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

      /* 轮廓开关：随时可点，状态记 localStorage；开着但当前模型不是 PF 时
       * 提示一句（开关保持开着，切到 PF 就直接生效，不用再点一次）。 */
      maskBtn.addEventListener('click', function () {
        maskEnabled = !maskEnabled;
        try { window.localStorage.setItem(MASK_STORAGE_KEY, maskEnabled ? '1' : '0'); } catch (ignored) {}
        refreshMaskButton();
        if (maskEnabled && currentModel !== 'yoloe26npf') {
          ctx.toast({ icon: 'yolo', title: '当前模型没有轮廓数据', subtitle: '切到 YOLOE-26n PF 才有实例分割轮廓' });
        }
        if (!maskEnabled) {
          tracked.forEach(function (t) { t.mask = null; });
          overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        }
        SC.core.log.add('YOLO 轮廓' + (maskEnabled ? '已开启' : '已关闭'));
      });

      sensInput.addEventListener('input', function () {
        threshold = parseFloat(sensInput.value) || 0.4;
        sensVal.textContent = threshold.toFixed(2);
      });

      modelSelect.addEventListener('change', function () {
        switchModel(modelSelect.value);
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
      refreshMaskButton();
      refreshReadout();
    }
  });
})(window.SC = window.SC || {});
