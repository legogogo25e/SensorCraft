/* GPS：watchPosition 轨迹、速度/海拔/里程、复制坐标、导出 GPX。只在页面打开时记录。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  // Haversine 公式计算两点球面距离，用于累计里程。
  function haversine(a, b) {
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLon = (b.lon - a.lon) * toRad;
    var lat1 = a.lat * toRad;
    var lat2 = b.lat * toRad;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function errorText(error) {
    if (!error) return '定位失败。';
    if (error.code === 1) return '定位权限被拒绝。请在 Safari 网站设置中允许定位。';
    if (error.code === 2) return '无法获得位置：可能是飞行模式、室内或 GPS 不可用。';
    if (error.code === 3) return '定位超时。走到窗边或室外再试。';
    return error.message || '定位失败。';
  }

  SC.registerSensor({
    id: 'geolocation',
    name: 'GPS 定位',
    en: 'GEOLOCATION',
    group: '运动与环境',
    icon: 'map',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: '定位需要 HTTPS 或 localhost。' };
      }
      if (!feature.geolocation) {
        return { status: 'locked', reason: '当前浏览器不提供 Geolocation API。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-gps">' +
        '<div class="gps-stage"><canvas id="gps-canvas"></canvas><div class="gps-empty" id="gps-empty">点击「开始定位」，允许后走出第一步。</div></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="gps-start">开始定位</button>' +
        '<button class="mc-btn" type="button" id="gps-reset">清空轨迹</button>' +
        '<button class="mc-btn" type="button" id="gps-copy">复制坐标</button>' +
        '<button class="mc-btn" type="button" id="gps-export">导出 GPX</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="gps-note">只在页面打开时记录，不会后台上传。</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>藏宝图</span><span>TREASURE MAP</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">纬度</span><span class="cell-value" id="gps-r-lat">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">经度</span><span class="cell-value" id="gps-r-lon">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">精度</span><span class="cell-value" id="gps-r-acc">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">速度</span><span class="cell-value" id="gps-r-speed">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">海拔</span><span class="cell-value" id="gps-r-alt">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">里程</span><span class="cell-value" id="gps-r-dist">0 m</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">轨迹点</span><span class="readout-value" id="gps-r-points">0</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="gps-r-status">未开始</span></div>'
      );

      var canvas = ctx.root.querySelector('#gps-canvas');
      var empty = ctx.root.querySelector('#gps-empty');
      var startBtn = ctx.root.querySelector('#gps-start');
      var resetBtn = ctx.root.querySelector('#gps-reset');
      var copyBtn = ctx.root.querySelector('#gps-copy');
      var exportBtn = ctx.root.querySelector('#gps-export');
      var note = ctx.root.querySelector('#gps-note');

      var watchId = null;
      var points = [];
      var totalDistance = 0;
      var current = null;
      var movingSeen = false;
      var status = '未开始';

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function refresh() {
        setReadout('#gps-r-lat', current ? current.lat.toFixed(6) : '--');
        setReadout('#gps-r-lon', current ? current.lon.toFixed(6) : '--');
        setReadout('#gps-r-acc', current ? fmt.accuracy(current.accuracy) : '--');
        setReadout('#gps-r-speed', current ? fmt.speed(current.speed) : '--');
        setReadout('#gps-r-alt', current && current.altitude != null ? Math.round(current.altitude) + ' m' : '--');
        setReadout('#gps-r-dist', fmt.distance(totalDistance));
        setReadout('#gps-r-points', String(points.length));
        setReadout('#gps-r-status', status);
      }

      function onPosition(position) {
        var coords = position.coords;
        var point = {
          lat: coords.latitude,
          lon: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          altitudeAccuracy: coords.altitudeAccuracy,
          heading: coords.heading,
          speed: coords.speed,
          time: position.timestamp
        };
        if (points.length) {
          var last = points[points.length - 1];
          var d = haversine(last, point);
          if (d >= 1.5) {
            totalDistance += d;
            points.push(point);
          } else {
            points[points.length - 1] = point;
          }
        } else {
          points.push(point);
        }
        if (points.length > 500) points.shift();
        current = point;
        status = '定位中';
        empty.style.display = 'none';
        if (!movingSeen && totalDistance >= 100) {
          movingSeen = true;
          ctx.toast({ icon: 'map', title: '成就达成！', subtitle: '走出新手村：移动超过 100 米' });
        }
        refresh();
      }

      function onError(error) {
        if (watchId != null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        status = '失败';
        note.textContent = errorText(error);
        ctx.toast({ icon: 'map', title: '定位失败', subtitle: errorText(error) });
        startBtn.textContent = '重新定位';
        startBtn.className = 'mc-btn primary';
        refresh();
      }

      function start() {
        if (watchId != null) return;
        status = '申请中';
        refresh();
        startBtn.textContent = '定位中…';
        startBtn.className = 'mc-btn danger';
        watchId = navigator.geolocation.watchPosition(onPosition, onError, {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 12000
        });
        note.textContent = '精度受环境影响；室外通常更好。';
        SC.core.log.add('GPS 定位已开始');
      }

      function stop() {
        if (watchId != null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        status = '已停止';
        startBtn.textContent = '开始定位';
        startBtn.className = 'mc-btn primary';
        refresh();
        SC.core.log.add('GPS 定位已停止');
      }

      function draw() {
        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#d8c08a';
        c.fillRect(0, 0, w, h);

        c.strokeStyle = 'rgba(107,68,35,0.22)';
        c.lineWidth = 1;
        for (var x = 0; x < w; x += 22) {
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x, h);
          c.stroke();
        }
        for (var y = 0; y < h; y += 22) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(w, y);
          c.stroke();
        }

        if (!points.length) {
          c.fillStyle = '#5a3d1c';
          c.font = '11px monospace';
          c.fillText('NO FIX · 等待定位', 12, 20);
          return;
        }

        var minLat = Infinity;
        var maxLat = -Infinity;
        var minLon = Infinity;
        var maxLon = -Infinity;
        points.forEach(function (p) {
          minLat = Math.min(minLat, p.lat);
          maxLat = Math.max(maxLat, p.lat);
          minLon = Math.min(minLon, p.lon);
          maxLon = Math.max(maxLon, p.lon);
        });
        var padLat = Math.max(0.00008, (maxLat - minLat) * 0.15);
        var padLon = Math.max(0.00008, (maxLon - minLon) * 0.15);
        minLat -= padLat;
        maxLat += padLat;
        minLon -= padLon;
        maxLon += padLon;
        var spanLat = maxLat - minLat;
        var spanLon = maxLon - minLon;
        function toX(lon) {
          return ((lon - minLon) / spanLon) * (w - 24) + 12;
        }
        function toY(lat) {
          return h - (((lat - minLat) / spanLat) * (h - 24) + 12);
        }

        if (points.length > 1) {
          c.strokeStyle = '#ff3b3b';
          c.lineWidth = 3;
          c.beginPath();
          points.forEach(function (p, index) {
            if (index === 0) c.moveTo(toX(p.lon), toY(p.lat));
            else c.lineTo(toX(p.lon), toY(p.lat));
          });
          c.stroke();
        }

        var start = points[0];
        c.fillStyle = '#17dd62';
        c.fillRect(toX(start.lon) - 4, toY(start.lat) - 4, 8, 8);

        if (current) {
          var px = toX(current.lon);
          var py = toY(current.lat);
          if (current.accuracy) {
            var accPx = Math.max(6, (current.accuracy / 111000 / spanLat) * (h - 24));
            c.strokeStyle = 'rgba(255,215,0,0.55)';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(px, py, Math.min(accPx, Math.min(w, h) * 0.45), 0, Math.PI * 2);
            c.stroke();
          }
          c.fillStyle = '#ffd700';
          c.fillRect(px - 6, py - 6, 12, 12);
          c.strokeStyle = '#000';
          c.lineWidth = 2;
          c.strokeRect(px - 6, py - 6, 12, 12);
        }

        c.fillStyle = '#5a3d1c';
        c.font = '9px monospace';
        c.fillText('SENSORCRAFT TREASURE MAP · ' + points.length + ' PTS', 10, h - 8);
      }

      startBtn.addEventListener('click', function () {
        if (watchId != null) stop();
        else start();
      });
      resetBtn.addEventListener('click', function () {
        points = [];
        totalDistance = 0;
        current = null;
        movingSeen = false;
        empty.style.display = '';
        refresh();
        ctx.toast({ icon: 'map', title: '轨迹已清空', subtitle: '从当前位置重新开始画地图' });
      });

      copyBtn.addEventListener('click', function () {
        if (!current) {
          ctx.toast({ icon: 'map', title: '还没有坐标', subtitle: '先开始定位并等待一个位置' });
          return;
        }
        var text = current.lat.toFixed(6) + ', ' + current.lon.toFixed(6);
        dom.copyText(text).then(function () {
          ctx.toast({ icon: 'map', title: '坐标已复制', subtitle: text });
        }).catch(function () {
          ctx.toast({ icon: 'barrier', title: '复制失败', subtitle: '请手动选择坐标文本' });
        });
      });

      // 导出 GPX 1.1，轨迹点包含经纬度、海拔（若有）和时间；至少需要 2 个点。
      exportBtn.addEventListener('click', function () {
        if (points.length < 2) {
          ctx.toast({ icon: 'map', title: '轨迹太短', subtitle: '至少需要 2 个轨迹点才能导出 GPX' });
          return;
        }
        var body = points.map(function (p) {
          var ele = p.altitude != null ? '<ele>' + p.altitude.toFixed(1) + '</ele>' : '';
          return '<trkpt lat="' + p.lat + '" lon="' + p.lon + '">' + ele +
            '<time>' + new Date(p.time).toISOString() + '</time></trkpt>';
        }).join('');
        var gpx = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<gpx version="1.1" creator="SENSORCRAFT" xmlns="http://www.topografix.com/GPX/1/1">' +
          '<trk><name>SENSORCRAFT Track</name><trkseg>' + body + '</trkseg></trk></gpx>';
        var blob = new Blob([gpx], { type: 'application/gpx+xml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'sensorcraft-track-' + Date.now() + '.gpx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
        ctx.toast({ icon: 'map', title: 'GPX 已导出', subtitle: points.length + ' 个轨迹点' });
        SC.core.log.add('导出 GPX：' + points.length + ' 个点');
      });

      ctx.onCleanup(function () {
        if (watchId != null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
      });

      ctx.raf(draw);
      refresh();
    }
  });
})(window.SC = window.SC || {});
