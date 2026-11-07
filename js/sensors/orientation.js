/* 姿态与指南针：α/β/γ、方位角、水平气泡、水平归零和校准提示。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  SC.registerSensor({
    id: 'orientation',
    name: '姿态与指南针',
    en: 'ORIENTATION',
    group: '运动与环境',
    icon: 'compass',
    probe: function (feature) {
      if (!feature.orientation) {
        return { status: 'locked', reason: '当前浏览器不提供 DeviceOrientationEvent。' };
      }
      if (feature.orientationPermission) {
        return { status: 'partial', reason: 'iOS 需要你在模块里点击一次「授权并开始」。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-compass">' +
        '<div class="stage-frame ratio-1x1"><canvas id="compass-canvas"></canvas>' +
        '<div class="frame-hud"><span class="hud-chip" id="compass-chip">等待授权</span><span class="hud-chip">COMPASS</span></div></div>' +
        '<div class="axis-list">' +
        '<div class="axis-row"><span class="axis-name">α</span><div class="meter"><div class="meter-fill gold" id="compass-bar-a"></div></div><span class="axis-num" id="compass-val-a">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">β</span><div class="meter"><div class="meter-fill gold" id="compass-bar-b"></div></div><span class="axis-num" id="compass-val-b">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">γ</span><div class="meter"><div class="meter-fill gold" id="compass-bar-g"></div></div><span class="axis-num" id="compass-val-g">--</span></div>' +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="compass-start">授权并开始</button>' +
        '<button class="mc-btn" type="button" id="compass-tare">水平归零</button>' +
        '<button class="mc-btn" type="button" id="compass-tip">指南针校准提示</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="compass-note">把手机放平，气泡回到中心。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>探险家罗盘</span><span>EXPLORER</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">方位</span><span class="cell-value" id="compass-r-heading">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">中文方位</span><span class="cell-value" id="compass-r-dir">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">α / β / γ</span><span class="cell-value" id="compass-r-xyz">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">指北来源</span><span class="cell-value" id="compass-r-source">--</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">水平归零</span><span class="readout-value" id="compass-r-tare">未启用</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="compass-r-status">等待授权</span></div>'
      );

      var canvas = ctx.root.querySelector('#compass-canvas');
      var chip = ctx.root.querySelector('#compass-chip');
      var note = ctx.root.querySelector('#compass-note');
      var startBtn = ctx.root.querySelector('#compass-start');
      var tareBtn = ctx.root.querySelector('#compass-tare');
      var tipBtn = ctx.root.querySelector('#compass-tip');

      var latest = { alpha: 0, beta: 0, gamma: 0, heading: null, hasData: false, source: '--' };
      var tare = { beta: 0, gamma: 0, active: false };
      var motionOff = null;
      var authorized = false;
      var listening = false;
      var northSeen = false;
      var levelSince = 0;
      var levelSeen = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      // 水平归零只影响 β/γ 和气泡，不影响方位角 heading。
      function taredBeta() {
        return latest.beta - (tare.active ? tare.beta : 0);
      }

      function taredGamma() {
        return latest.gamma - (tare.active ? tare.gamma : 0);
      }

      function refresh() {
        var beta = taredBeta();
        var gamma = taredGamma();
        ctx.root.querySelector('#compass-val-a').textContent = fmt.signed(latest.alpha, 0);
        ctx.root.querySelector('#compass-val-b').textContent = fmt.signed(beta, 0);
        ctx.root.querySelector('#compass-val-g').textContent = fmt.signed(gamma, 0);
        ctx.root.querySelector('#compass-bar-a').style.width = Math.min(100, (Math.abs(latest.alpha) / 360) * 100) + '%';
        ctx.root.querySelector('#compass-bar-b').style.width = Math.min(100, (Math.abs(beta) / 180) * 100) + '%';
        ctx.root.querySelector('#compass-bar-g').style.width = Math.min(100, (Math.abs(gamma) / 90) * 100) + '%';
        var dir = fmt.compass(latest.heading);
        setReadout('#compass-r-heading', latest.heading == null ? '--' : Math.round(latest.heading) + '°');
        setReadout('#compass-r-dir', dir.cn + ' / ' + dir.en);
        setReadout(
          '#compass-r-xyz',
          fmt.signed(latest.alpha, 0) + ' / ' + fmt.signed(beta, 0) + ' / ' + fmt.signed(gamma, 0)
        );
        setReadout('#compass-r-source', latest.source);
        setReadout('#compass-r-tare', tare.active ? fmt.signed(tare.beta, 1) + ' / ' + fmt.signed(tare.gamma, 1) : '未启用');
        setReadout('#compass-r-status', listening ? '采集中' : latest.hasData ? '已暂停' : '等待授权');
        chip.textContent = listening && latest.heading != null ? dir.cn + ' · ' + Math.round(latest.heading) + '°' : latest.hasData ? 'PAUSED' : '等待授权';
      }

      function handleOrientation(event) {
        latest.alpha = event.alpha || 0;
        latest.beta = event.beta || 0;
        latest.gamma = event.gamma || 0;
        latest.hasData = true;
        if (typeof event.webkitCompassHeading === 'number') {
          latest.heading = event.webkitCompassHeading;
          latest.source = 'webkitCompassHeading（指北）';
        } else if (event.absolute && event.alpha != null) {
          latest.heading = (360 - event.alpha) % 360;
          latest.source = 'alpha（绝对）';
        } else {
          latest.heading = (360 - latest.alpha) % 360;
          latest.source = 'alpha（相对）';
        }
        if (!northSeen && (latest.heading < 10 || latest.heading > 350)) {
          northSeen = true;
          ctx.toast({ icon: 'compass', title: '成就达成！', subtitle: '找到北方：罗盘指向正北' });
        }
        var level = Math.abs(taredBeta()) < 5 && Math.abs(taredGamma()) < 5;
        if (level) {
          if (!levelSince) levelSince = performance.now();
          if (!levelSeen && performance.now() - levelSince > 3000) {
            levelSeen = true;
            ctx.toast({ icon: 'accelerometer', title: '成就达成！', subtitle: '稳如磐石：保持水平 3 秒' });
          }
        } else {
          levelSince = 0;
        }
      }

      function attach() {
        motionOff = ctx.listen(window, 'deviceorientation', handleOrientation);
        listening = true;
      }

      function pause() {
        if (motionOff) {
          motionOff();
          motionOff = null;
        }
        listening = false;
        startBtn.textContent = '继续';
        startBtn.className = 'mc-btn primary';
        note.textContent = '采集已暂停。';
        refresh();
      }

      async function start() {
        if (listening) {
          pause();
          return;
        }
        if (!authorized) {
          startBtn.disabled = true;
          startBtn.textContent = '授权中…';
          var result = await ctx.motionPermission();
          startBtn.disabled = false;
          if (result.orientation === 'denied' || result.orientation === 'error') {
            startBtn.textContent = '重新授权';
            note.textContent = '方向权限被拒绝，指南针不可用。请到 Safari 网站设置里允许「运动与方向访问」。';
            ctx.setStatus('LIMITED', 'partial');
            return;
          }
          authorized = true;
        }
        attach();
        startBtn.textContent = '暂停';
        startBtn.className = 'mc-btn danger';
        note.textContent = '转动手机，观察指针和气泡。';
        ctx.setStatus('READY', '');
        SC.core.log.add('姿态与指南针已开始采集');
        refresh();
        setTimeout(function () {
          if (!latest.hasData) note.textContent = '没有收到方向数据：桌面浏览器或权限未生效。';
        }, 1500);
      }

      function draw() {
        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#12100a';
        c.fillRect(0, 0, w, h);

        var cx = w / 2;
        var cy = h * 0.42;
        var radius = Math.min(w, h) * 0.30;
        c.strokeStyle = '#6b4423';
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = '#ffd700';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(cx, cy, radius - 8, 0, Math.PI * 2);
        c.stroke();

        var labels = [
          { text: 'N', angle: 0, color: '#ff3b3b' },
          { text: 'E', angle: 90, color: '#ffd700' },
          { text: 'S', angle: 180, color: '#ffd700' },
          { text: 'W', angle: 270, color: '#ffd700' }
        ];
        c.font = 'bold 12px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        labels.forEach(function (label) {
          var rad = ((label.angle - 90) * Math.PI) / 180;
          c.fillStyle = label.color;
          c.fillText(label.text, cx + Math.cos(rad) * (radius - 20), cy + Math.sin(rad) * (radius - 20));
        });

        if (latest.heading != null) {
          var angle = ((latest.heading - 90) * Math.PI) / 180;
          c.strokeStyle = '#ff3b3b';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(angle) * (radius - 30), cy + Math.sin(angle) * (radius - 30));
          c.stroke();
          c.fillStyle = '#fff3a0';
          c.fillRect(cx - 5, cy - 5, 10, 10);
          c.strokeStyle = '#000';
          c.lineWidth = 1;
          c.strokeRect(cx - 5, cy - 5, 10, 10);
        }

        var bubbleY = h * 0.84;
        var bubbleR = Math.min(w, h) * 0.11;
        c.strokeStyle = '#4a4a50';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, bubbleY, bubbleR, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.moveTo(cx - bubbleR, bubbleY);
        c.lineTo(cx + bubbleR, bubbleY);
        c.moveTo(cx, bubbleY - bubbleR);
        c.lineTo(cx, bubbleY + bubbleR);
        c.stroke();
        var beta = taredBeta();
        var gamma = taredGamma();
        var level = Math.abs(beta) < 5 && Math.abs(gamma) < 5;
        var bx = dom.clamp((gamma / 45) * bubbleR * 0.75, -bubbleR * 0.7, bubbleR * 0.7);
        var by = dom.clamp((beta / 45) * bubbleR * 0.75, -bubbleR * 0.7, bubbleR * 0.7);
        c.fillStyle = level ? '#7fff2a' : '#ffd700';
        c.fillRect(cx + bx - 5, bubbleY + by - 5, 10, 10);
        c.strokeStyle = '#000';
        c.lineWidth = 1;
        c.strokeRect(cx + bx - 5, bubbleY + by - 5, 10, 10);

        c.fillStyle = '#a8a8a8';
        c.font = '9px monospace';
        c.textAlign = 'left';
        c.fillText(latest.source, 10, h - 10);
      }

      startBtn.addEventListener('click', start);
      tareBtn.addEventListener('click', function () {
        if (tare.active) {
          tare.active = false;
          tare.beta = 0;
          tare.gamma = 0;
          tareBtn.textContent = '水平归零';
          note.textContent = '已清除水平归零。';
          ctx.toast({ icon: 'compass', title: '归零已清除', subtitle: '气泡恢复原始倾斜' });
        } else {
          tare.active = true;
          tare.beta = latest.beta;
          tare.gamma = latest.gamma;
          tareBtn.textContent = '清除归零';
          note.textContent = '已把当前姿态当作水平。';
          ctx.toast({ icon: 'compass', title: '水平已归零', subtitle: '现在这个角度就是 0°' });
        }
        refresh();
      });
      tipBtn.addEventListener('click', function () {
        ctx.toast({ icon: 'compass', title: '指南针校准', subtitle: '拿着手机画 8 字，远离磁铁和金属' });
        note.textContent = '校准方法：拿着手机缓慢画 8 字，远离磁铁、音箱和金属桌面。';
      });

      ctx.raf(draw);
      ctx.interval(refresh, 100);
      refresh();
      if (!ctx.feature.orientationPermission) start();
    }
  });
})(window.SC = window.SC || {});
