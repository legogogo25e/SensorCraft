/* 多点触控：多指编号/压力可视化 + 点靶反应游戏。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  var COLORS = ['#ffd700', '#7fff2a', '#55ffff', '#ff3b3b', '#c060ff', '#4a6cff', '#ff8c1a', '#ffffff'];

  SC.registerSensor({
    id: 'multitouch',
    name: '多点触控',
    en: 'MULTITOUCH',
    group: '交互与输出',
    icon: 'touch',
    probe: function (feature) {
      if (!feature.pointer && !feature.touch) {
        return { status: 'locked', reason: '当前浏览器不提供 PointerEvent/TouchEvent。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-touch">' +
        '<div class="touch-stage"><canvas id="touch-canvas"></canvas>' +
        '<div class="touch-hud"><span id="touch-count">触点 0</span><span id="touch-max">最大 0</span><span id="touch-game">点靶：关</span></div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="touch-game-btn">开始点靶游戏</button>' +
        '<button class="mc-btn" type="button" id="touch-reset">重置纪录</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note">把多根手指同时按在压力板上。游戏：点中金色靶心。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>多人压力板</span><span>PRESSURE PLATE</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">当前触点</span><span class="cell-value" id="touch-r-now">0</span></div>' +
          '<div class="readout-cell"><span class="cell-label">最大同时</span><span class="cell-value" id="touch-r-max">0</span></div>' +
          '<div class="readout-cell"><span class="cell-label">命中</span><span class="cell-value" id="touch-r-hits">0 / 5</span></div>' +
          '<div class="readout-cell"><span class="cell-label">最佳反应</span><span class="cell-value" id="touch-r-best">--</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">平均反应</span><span class="readout-value" id="touch-r-avg">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">当前压力</span><span class="readout-value" id="touch-r-pressure">--</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="touch-r-status">等待触摸</span></div>'
      );

      var canvas = ctx.root.querySelector('#touch-canvas');
      var countEl = ctx.root.querySelector('#touch-count');
      var maxEl = ctx.root.querySelector('#touch-max');
      var gameEl = ctx.root.querySelector('#touch-game');
      var gameBtn = ctx.root.querySelector('#touch-game-btn');
      var resetBtn = ctx.root.querySelector('#touch-reset');

      var pointers = new Map();
      var maxPointers = 0;
      var pointsSeen = 0;
      var gameActive = false;
      var target = null;
      var hits = 0;
      var times = [];
      var targetShownAt = 0;
      var fastSeen = false;
      var fiveSeen = false;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function refresh() {
        countEl.textContent = '触点 ' + pointers.size;
        maxEl.textContent = '最大 ' + maxPointers;
        gameEl.textContent = '点靶：' + (gameActive ? '开' : '关');
        setReadout('#touch-r-now', String(pointers.size));
        setReadout('#touch-r-max', String(maxPointers));
        setReadout('#touch-r-hits', hits + ' / 5');
        setReadout('#touch-r-best', times.length ? fmt.ms(Math.min.apply(null, times)) : '--');
        setReadout(
          '#touch-r-avg',
          times.length ? fmt.ms(times.reduce(function (a, b) { return a + b; }, 0) / times.length) : '--'
        );
        var pressure = 0;
        pointers.forEach(function (pointer) {
          pressure = Math.max(pressure, pointer.pressure || 0);
        });
        setReadout('#touch-r-pressure', pointers.size ? pressure.toFixed(2) : '--');
        setReadout('#touch-r-status', gameActive ? '点靶进行中' : pointers.size ? '触摸中' : '等待触摸');
      }

      function spawnTarget() {
        var fit = dom.fitCanvas(canvas);
        var margin = 40;
        target = {
          x: margin + Math.random() * Math.max(1, fit.width - margin * 2),
          y: margin + Math.random() * Math.max(1, fit.height - margin * 2),
          r: 22
        };
        targetShownAt = performance.now();
      }

      function toggleGame() {
        gameActive = !gameActive;
        hits = 0;
        times = [];
        gameBtn.textContent = gameActive ? '结束点靶游戏' : '开始点靶游戏';
        if (gameActive) {
          spawnTarget();
          ctx.toast({ icon: 'touch', title: '点靶开始', subtitle: '点中金色靶心，共 5 次' });
        } else {
          target = null;
        }
        refresh();
      }

      function onDown(event) {
        event.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        if (pointers.size >= 10) return;
        var index = pointers.size;
        pointers.set(event.pointerId, {
          x: x,
          y: y,
          pressure: event.pressure || 0,
          color: COLORS[index % COLORS.length],
          index: index + 1
        });
        if (pointers.size > maxPointers) maxPointers = pointers.size;
        pointsSeen += 1;
        if (!fiveSeen && maxPointers >= 5) {
          fiveSeen = true;
          ctx.toast({ icon: 'touch', title: '成就达成！', subtitle: '五指琴魔：同时按下 5 根手指' });
        }

        if (gameActive && target) {
          var dx = x - target.x;
          var dy = y - target.y;
          if (Math.sqrt(dx * dx + dy * dy) <= target.r + 10) {
            var reaction = performance.now() - targetShownAt;
            times.push(reaction);
            hits += 1;
            if (!fastSeen && reaction < 250) {
              fastSeen = true;
              ctx.toast({ icon: 'touch', title: '成就达成！', subtitle: '闪电侠：反应时间低于 250ms' });
            }
            if (hits >= 5) {
              var best = Math.min.apply(null, times);
              ctx.toast({
                icon: 'touch',
                title: '点靶完成！',
                subtitle: '最佳 ' + Math.round(best) + 'ms · 平均 ' + Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) + 'ms'
              });
              gameActive = false;
              target = null;
              gameBtn.textContent = '再玩一次';
            } else {
              spawnTarget();
            }
          }
        }
        refresh();
      }

      function onMove(event) {
        var pointer = pointers.get(event.pointerId);
        if (!pointer) return;
        var rect = canvas.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.pressure = event.pressure || 0;
      }

      function onUp(event) {
        if (pointers.delete(event.pointerId)) refresh();
      }

      function draw(now) {
        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#121216';
        c.fillRect(0, 0, w, h);

        c.strokeStyle = 'rgba(85,255,255,0.08)';
        c.lineWidth = 1;
        for (var x = 0; x < w; x += 28) {
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x, h);
          c.stroke();
        }
        for (var y = 0; y < h; y += 28) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(w, y);
          c.stroke();
        }

        if (gameActive && target) {
          var pulse = 1 + Math.sin(now / 180) * 0.08;
          c.strokeStyle = 'rgba(255,215,0,0.45)';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(target.x, target.y, target.r * 1.5 * pulse, 0, Math.PI * 2);
          c.stroke();
          c.fillStyle = '#ffd700';
          c.fillRect(target.x - target.r / 2, target.y - target.r / 2, target.r, target.r);
          c.strokeStyle = '#000';
          c.lineWidth = 3;
          c.strokeRect(target.x - target.r / 2, target.y - target.r / 2, target.r, target.r);
          c.fillStyle = '#fff3a0';
          c.fillRect(target.x - 4, target.y - 4, 8, 8);
        }

        pointers.forEach(function (pointer) {
          var size = 14 + Math.min(1, pointer.pressure || 0) * 10;
          c.strokeStyle = pointer.color;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(pointer.x, pointer.y, size + 4, 0, Math.PI * 2);
          c.stroke();
          c.fillStyle = pointer.color;
          c.fillRect(pointer.x - size / 2, pointer.y - size / 2, size, size);
          c.strokeStyle = '#000';
          c.lineWidth = 2;
          c.strokeRect(pointer.x - size / 2, pointer.y - size / 2, size, size);
          c.fillStyle = '#1b1b1f';
          c.font = 'bold 10px monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(pointer.index), pointer.x, pointer.y + 1);
        });

        c.fillStyle = '#a8a8a8';
        c.font = '9px monospace';
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText('TOUCH POINTS: ' + pointers.size + ' / MAX ' + maxPointers, 10, h - 10);
      }

      ctx.listen(canvas, 'pointerdown', onDown, { passive: false });
      ctx.listen(window, 'pointermove', onMove, { passive: true });
      ctx.listen(window, 'pointerup', onUp, { passive: true });
      ctx.listen(window, 'pointercancel', onUp, { passive: true });
      ctx.listen(canvas, 'contextmenu', function (event) {
        event.preventDefault();
      });

      gameBtn.addEventListener('click', toggleGame);
      resetBtn.addEventListener('click', function () {
        maxPointers = 0;
        pointsSeen = 0;
        hits = 0;
        times = [];
        fastSeen = false;
        fiveSeen = false;
        if (gameActive) spawnTarget();
        refresh();
      });

      ctx.raf(draw);
      refresh();
    }
  });
})(window.SC = window.SC || {});
