/* 陀螺仪：三轴角速度、峰值 RPM、零偏校准和暂停。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  SC.registerSensor({
    id: 'gyroscope',
    name: '陀螺仪',
    en: 'GYROSCOPE',
    group: '运动与环境',
    icon: 'gyroscope',
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
        '<div class="module module-gyro">' +
        '<div class="stage-frame ratio-1x1"><canvas id="gyro-canvas"></canvas>' +
        '<div class="frame-hud"><span class="hud-chip" id="gyro-chip">等待授权</span><span class="hud-chip">END CRYSTAL</span></div></div>' +
        '<div class="axis-list">' +
        '<div class="axis-row"><span class="axis-name">α</span><div class="meter"><div class="meter-fill cyan" id="gyro-bar-a"></div></div><span class="axis-num" id="gyro-val-a">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">β</span><div class="meter"><div class="meter-fill cyan" id="gyro-bar-b"></div></div><span class="axis-num" id="gyro-val-b">--</span></div>' +
        '<div class="axis-row"><span class="axis-name">γ</span><div class="meter"><div class="meter-fill cyan" id="gyro-bar-g"></div></div><span class="axis-num" id="gyro-val-g">--</span></div>' +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="gyro-start">授权并开始</button>' +
        '<button class="mc-btn" type="button" id="gyro-reset">重置峰值</button>' +
        '<button class="mc-btn" type="button" id="gyro-cal">校准零偏</button>' +
        '<button class="mc-btn" type="button" id="gyro-clear">清除零偏</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="gyro-note">单位：度/秒。快速转动手机试试。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>旋转之眼</span><span>END CRYSTAL</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">合角速度</span><span class="cell-value" id="gyro-r-mag">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">峰值 RPM</span><span class="cell-value" id="gyro-r-rpm">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">α / β / γ</span><span class="cell-value" id="gyro-r-xyz">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">状态</span><span class="cell-value" id="gyro-r-status">等待授权</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">零偏</span><span class="readout-value" id="gyro-r-bias">0 / 0 / 0</span></div>'
      );

      var canvas = ctx.root.querySelector('#gyro-canvas');
      var chip = ctx.root.querySelector('#gyro-chip');
      var note = ctx.root.querySelector('#gyro-note');
      var startBtn = ctx.root.querySelector('#gyro-start');
      var resetBtn = ctx.root.querySelector('#gyro-reset');
      var calBtn = ctx.root.querySelector('#gyro-cal');
      var clearBtn = ctx.root.querySelector('#gyro-clear');

      var latest = { a: 0, b: 0, g: 0, mag: 0, hasData: false };
      var raw = { a: 0, b: 0, g: 0 };
      var bias = { a: 0, b: 0, g: 0 };
      var motionOff = null;
      var authorized = false;
      var peak = 0;
      var spin = 0;
      var lastTime = performance.now();
      var listening = false;
      var spinSeen = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function refresh() {
        ctx.root.querySelector('#gyro-val-a').textContent = fmt.signed(latest.a, 0);
        ctx.root.querySelector('#gyro-val-b').textContent = fmt.signed(latest.b, 0);
        ctx.root.querySelector('#gyro-val-g').textContent = fmt.signed(latest.g, 0);
        ctx.root.querySelector('#gyro-bar-a').style.width = Math.min(100, (Math.abs(latest.a) / 720) * 100) + '%';
        ctx.root.querySelector('#gyro-bar-b').style.width = Math.min(100, (Math.abs(latest.b) / 720) * 100) + '%';
        ctx.root.querySelector('#gyro-bar-g').style.width = Math.min(100, (Math.abs(latest.g) / 720) * 100) + '%';
        setReadout('#gyro-r-mag', fmt.fixed(latest.mag, 1) + ' °/s');
        setReadout('#gyro-r-rpm', fmt.fixed((peak * 60) / 360, 1) + ' rpm');
        setReadout(
          '#gyro-r-xyz',
          fmt.signed(latest.a, 0) + ' / ' + fmt.signed(latest.b, 0) + ' / ' + fmt.signed(latest.g, 0)
        );
        setReadout('#gyro-r-bias', fmt.signed(bias.a, 0) + ' / ' + fmt.signed(bias.b, 0) + ' / ' + fmt.signed(bias.g, 0));
        setReadout('#gyro-r-status', listening ? '采集中' : latest.hasData ? '已暂停' : '等待授权');
        chip.textContent = listening ? 'SPIN · ' + Math.round(latest.mag) + '°/s' : latest.hasData ? 'PAUSED' : '等待授权';
      }

      function handleMotion(event) {
        var rate = event.rotationRate;
        if (!rate) return;
        raw.a = rate.alpha || 0;
        raw.b = rate.beta || 0;
        raw.g = rate.gamma || 0;
        // 校准后从原始角速度里减去零偏；未校准或清除后 bias 为 0。
        latest.a = raw.a - bias.a;
        latest.b = raw.b - bias.b;
        latest.g = raw.g - bias.g;
        latest.mag = Math.sqrt(latest.a * latest.a + latest.b * latest.b + latest.g * latest.g);
        latest.hasData = true;
        peak = Math.max(peak, latest.mag);
        if (!spinSeen && latest.mag > 360) {
          spinSeen = true;
          ctx.toast({ icon: 'gyroscope', title: '成就达成！', subtitle: '旋转木马：角速度超过 360°/s' });
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
            note.textContent = '运动权限被拒绝，陀螺仪不可用。';
            ctx.setStatus('LIMITED', 'partial');
            return;
          }
          authorized = true;
        }
        attach();
        startBtn.textContent = '暂停';
        startBtn.className = 'mc-btn danger';
        note.textContent = '快速转动手机，末影水晶会跟着转。';
        ctx.setStatus('READY', '');
        SC.core.log.add('陀螺仪已开始采集');
        refresh();
        setTimeout(function () {
          if (!latest.hasData) note.textContent = '没有收到 rotationRate：此设备或浏览器未提供陀螺仪数据。';
        }, 1500);
      }

      function draw(now) {
        var dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        spin += (latest.g || 0) * dt * 0.7 + (latest.a || 0) * dt * 0.2;

        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#0f0f12';
        c.fillRect(0, 0, w, h);

        var cx = w / 2;
        var cy = h / 2;
        var size = Math.min(w, h) * 0.3;
        c.save();
        c.translate(cx, cy);
        c.rotate((spin * Math.PI) / 180);
        c.fillStyle = '#c060ff';
        c.beginPath();
        c.moveTo(0, -size);
        c.lineTo(size * 0.55, 0);
        c.lineTo(0, size);
        c.lineTo(-size * 0.55, 0);
        c.closePath();
        c.fill();
        c.fillStyle = '#f0d0ff';
        c.beginPath();
        c.moveTo(0, -size * 0.65);
        c.lineTo(size * 0.2, 0);
        c.lineTo(0, size * 0.65);
        c.lineTo(-size * 0.2, 0);
        c.closePath();
        c.fill();
        c.strokeStyle = '#2a0a4a';
        c.lineWidth = 2;
        c.stroke();
        c.restore();

        c.fillStyle = '#a8a8a8';
        c.font = '9px monospace';
        c.fillText('END CRYSTAL · °/s', 10, h - 10);
      }

      startBtn.addEventListener('click', start);
      resetBtn.addEventListener('click', function () {
        peak = 0;
        spinSeen = false;
        refresh();
        ctx.toast({ icon: 'gyroscope', title: '峰值已重置', subtitle: '再来一次快速旋转' });
      });

      calBtn.addEventListener('click', function () {
        bias.a = raw.a;
        bias.b = raw.b;
        bias.g = raw.g;
        refresh();
        ctx.toast({ icon: 'gyroscope', title: '零偏已校准', subtitle: '保持手机静止时的读数已归零' });
        SC.core.log.add('陀螺仪零偏：' + JSON.stringify(bias));
      });

      clearBtn.addEventListener('click', function () {
        bias.a = 0;
        bias.b = 0;
        bias.g = 0;
        refresh();
        ctx.toast({ icon: 'gyroscope', title: '零偏已清除', subtitle: '恢复原始角速度' });
      });

      ctx.raf(draw);
      ctx.interval(refresh, 100);
      refresh();
      if (!ctx.feature.motionPermission) start();
    }
  });
})(window.SC = window.SC || {});
