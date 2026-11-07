/* 加速度计：含重力/线性切换、暂停、步数、峰值、摇晃和自由落体检测。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  SC.registerSensor({
    id: 'accelerometer',
    name: '加速度计',
    en: 'ACCELEROMETER',
    group: '运动与环境',
    icon: 'accelerometer',
    probe: function (feature) {
      if (!feature.motion) {
        return { status: 'locked', reason: '当前浏览器不提供 DeviceMotionEvent。' };
      }
      if (feature.motionPermission) {
        return { status: 'partial', reason: 'iOS 需要你在模块里点击一次「授权并开始」。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-accel">' +
        '<div class="stage-frame ratio-1x1"><canvas id="accel-canvas"></canvas>' +
        '<div class="frame-hud"><span class="hud-chip" id="accel-chip">等待授权</span><span class="hud-chip" id="accel-mode-chip">GRAVITY</span></div></div>' +
        '<div class="axis-list">' +
        '<div class="axis-row"><span class="axis-name">X</span><div class="meter"><div class="meter-fill gold" id="accel-bar-x"></div></div><span class="axis-num" id="accel-val-x">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">Y</span><div class="meter"><div class="meter-fill gold" id="accel-bar-y"></div></div><span class="axis-num" id="accel-val-y">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">Z</span><div class="meter"><div class="meter-fill gold" id="accel-bar-z"></div></div><span class="axis-num" id="accel-val-z">--</span></div>' +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="accel-start">授权并开始</button>' +
        '<button class="mc-btn tiny" type="button" data-mode="gravity" aria-pressed="true">含重力</button>' +
        '<button class="mc-btn tiny" type="button" data-mode="linear" aria-pressed="false">线性</button>' +
        '<button class="mc-btn" type="button" id="accel-reset">重置</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="accel-note">步数为近似值，仅供实验。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>重力罗盘</span><span>GRAVITY</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">合矢量</span><span class="cell-value" id="accel-r-mag">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">X / Y / Z</span><span class="cell-value" id="accel-r-xyz">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">步数</span><span class="cell-value" id="accel-r-steps">0</span></div>' +
          '<div class="readout-cell"><span class="cell-label">采样间隔</span><span class="cell-value" id="accel-r-interval">--</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">峰值</span><span class="readout-value" id="accel-r-peak">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">数据源</span><span class="readout-value" id="accel-r-source">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="accel-r-status">等待授权</span></div>'
      );

      var canvas = ctx.root.querySelector('#accel-canvas');
      var chip = ctx.root.querySelector('#accel-chip');
      var note = ctx.root.querySelector('#accel-note');
      var startBtn = ctx.root.querySelector('#accel-start');
      var resetBtn = ctx.root.querySelector('#accel-reset');

      var latest = { x: 0, y: 0, z: 0, mag: 0, hasData: false, source: '--', interval: 0 };
      var mode = 'gravity';
      var modeChip = ctx.root.querySelector('#accel-mode-chip');
      var motionOff = null;
      var authorized = false;
      var peakMag = 0;
      var steps = 0;
      var smooth = 0;
      var stepArmed = true;
      var lastStep = 0;
      var shakeSeen = false;
      var fallSeen = false;
      var stepSeen = false;
      var listening = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function refresh() {
        var x = latest.x;
        var y = latest.y;
        var z = latest.z;
        ctx.root.querySelector('#accel-val-x').textContent = fmt.signed(x, 2);
        ctx.root.querySelector('#accel-val-y').textContent = fmt.signed(y, 2);
        ctx.root.querySelector('#accel-val-z').textContent = fmt.signed(z, 2);
        ctx.root.querySelector('#accel-bar-x').style.width = Math.min(100, (Math.abs(x) / 20) * 100) + '%';
        ctx.root.querySelector('#accel-bar-y').style.width = Math.min(100, (Math.abs(y) / 20) * 100) + '%';
        ctx.root.querySelector('#accel-bar-z').style.width = Math.min(100, (Math.abs(z) / 20) * 100) + '%';
        setReadout('#accel-r-mag', fmt.fixed(latest.mag, 2) + ' m/s²');
        setReadout('#accel-r-xyz', fmt.signed(x, 1) + ' / ' + fmt.signed(y, 1) + ' / ' + fmt.signed(z, 1));
        setReadout('#accel-r-steps', String(steps));
        setReadout('#accel-r-interval', latest.interval ? Math.round(latest.interval) + ' ms' : '--');
        setReadout('#accel-r-peak', fmt.fixed(peakMag, 2) + ' m/s²');
        setReadout('#accel-r-source', latest.source);
        setReadout('#accel-r-status', listening ? '采集中' : latest.hasData ? '已暂停' : '等待授权');
        chip.textContent = listening ? 'LIVE · ' + Math.round(latest.interval || 0) + 'ms' : latest.hasData ? 'PAUSED' : '等待授权';
        modeChip.textContent = mode === 'linear' ? 'LINEAR' : 'GRAVITY';
      }

      function handleMotion(event) {
        var a;
        var source;
        // 线性模式优先用 acceleration；设备不提供时回退到含重力数据并在数据源里注明。
        if (mode === 'linear') {
          a = event.acceleration;
          source = 'acceleration（线性）';
          if (!a) {
            a = event.accelerationIncludingGravity;
            source = '含重力（线性不可用）';
          }
        } else {
          a = event.accelerationIncludingGravity;
          source = 'accelerationIncludingGravity（含重力）';
          if (!a) {
            a = event.acceleration;
            source = 'acceleration（线性）';
          }
        }
        if (!a) return;
        latest.x = a.x || 0;
        latest.y = a.y || 0;
        latest.z = a.z || 0;
        latest.mag = Math.sqrt(latest.x * latest.x + latest.y * latest.y + latest.z * latest.z);
        latest.source = source;
        latest.interval = event.interval || 0;
        latest.hasData = true;
        peakMag = Math.max(peakMag, latest.mag);

        // 平滑合矢量后做峰值检测：超过 12 且间隔 >280ms 记一步，低于 10.2 重新武装。
        smooth = smooth * 0.82 + latest.mag * 0.18;
        var now = performance.now();
        if (smooth > 12 && stepArmed && now - lastStep > 280) {
          steps += 1;
          lastStep = now;
          stepArmed = false;
          if (!stepSeen && steps >= 10) {
            stepSeen = true;
            ctx.toast({ icon: 'accelerometer', title: '成就达成！', subtitle: '小小探险家：走出 10 步' });
          }
        }
        if (smooth < 10.2) stepArmed = true;

        if (!shakeSeen && (Math.abs(latest.x) + Math.abs(latest.y) + Math.abs(latest.z) > 34)) {
          shakeSeen = true;
          ctx.toast({ icon: 'accelerometer', title: '成就达成！', subtitle: '地震仪：检测到一次剧烈摇晃' });
        }
        if (!fallSeen && latest.mag < 2) {
          fallSeen = true;
          ctx.toast({ icon: 'accelerometer', title: '成就达成！', subtitle: '掉进虚空：检测到接近自由落体' });
        }
      }

      function attach() {
        motionOff = ctx.listen(window, 'devicemotion', handleMotion);
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
          if (result.motion === 'denied' || result.motion === 'error') {
            startBtn.textContent = '重新授权';
            note.textContent = '运动权限被拒绝。请到 Safari 网站设置里允许「运动与方向访问」。';
            ctx.setStatus('LIMITED', 'partial');
            return;
          }
          authorized = true;
        }
        attach();
        startBtn.textContent = '暂停';
        startBtn.className = 'mc-btn danger';
        note.textContent = '把手机放平，气泡会回到中心。';
        ctx.setStatus('READY', '');
        SC.core.log.add('加速度计已开始采集');
        refresh();
        setTimeout(function () {
          if (!latest.hasData) {
            note.textContent = '没有收到数据：桌面浏览器或权限未生效。可以换 iPhone 再试。';
          }
        }, 1500);
      }

      function draw() {
        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#0f0f12';
        c.fillRect(0, 0, w, h);

        var cx = w / 2;
        var cy = h / 2;
        var radius = Math.min(w, h) * 0.36;
        c.strokeStyle = '#3a3a40';
        c.lineWidth = 2;
        for (var r = radius; r > 12; r -= 18) {
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.stroke();
        }
        c.strokeStyle = 'rgba(255,215,0,0.35)';
        c.beginPath();
        c.moveTo(cx - radius, cy);
        c.lineTo(cx + radius, cy);
        c.moveTo(cx, cy - radius);
        c.lineTo(cx, cy + radius);
        c.stroke();

        var maxTilt = 9.8;
        var dx = dom.clamp((latest.x / maxTilt) * radius * 0.68, -radius * 0.8, radius * 0.8);
        var dy = dom.clamp((latest.y / maxTilt) * radius * 0.68, -radius * 0.8, radius * 0.8);
        var level = Math.abs(latest.mag - 9.8) < 1.1;

        c.fillStyle = level ? '#7fff2a' : '#ffd700';
        c.fillRect(Math.round(cx + dx - 7), Math.round(cy + dy - 7), 14, 14);
        c.strokeStyle = '#000';
        c.lineWidth = 2;
        c.strokeRect(Math.round(cx + dx - 7), Math.round(cy + dy - 7), 14, 14);
        c.fillStyle = level ? '#d6ff9a' : '#fff3a0';
        c.fillRect(Math.round(cx + dx - 5), Math.round(cy + dy - 5), 6, 4);

        c.fillStyle = '#a8a8a8';
        c.font = '9px monospace';
        c.fillText('LODESTONE LEVEL', 10, h - 10);
      }

      startBtn.addEventListener('click', start);
      resetBtn.addEventListener('click', function () {
        steps = 0;
        peakMag = 0;
        shakeSeen = false;
        fallSeen = false;
        stepSeen = false;
        refresh();
        ctx.toast({ icon: 'accelerometer', title: '计数已重置', subtitle: '步数、峰值、摇晃、自由落体成就重新计' });
      });

      Array.prototype.forEach.call(ctx.root.querySelectorAll('[data-mode]'), function (button) {
        button.addEventListener('click', function () {
          mode = button.getAttribute('data-mode');
          Array.prototype.forEach.call(ctx.root.querySelectorAll('[data-mode]'), function (item) {
            item.setAttribute('aria-pressed', String(item === button));
          });
          note.textContent = mode === 'linear'
            ? '线性加速度会去掉重力；部分设备不提供。'
            : '含重力模式：静止时合矢量约 9.8 m/s²。';
          refresh();
        });
      });

      ctx.raf(draw);
      ctx.interval(refresh, 100);
      refresh();
      if (!ctx.feature.motionPermission) start();
    }
  });
})(window.SC = window.SC || {});
