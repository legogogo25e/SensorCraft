/* 麦克风：波形、频谱、相对 dB、主频/音名，支持灵敏度和峰值保持。dB 是相对值，不是专业声压级。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  function friendlyError(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return '麦克风权限被拒绝。请在 Safari 网站设置中允许麦克风，然后重试。';
    }
    if (name === 'NotFoundError') return '没有找到麦克风。';
    if (name === 'NotReadableError') return '麦克风被其他 App 占用。';
    return (error && error.message) || '无法启动麦克风。';
  }

  SC.registerSensor({
    id: 'microphone',
    name: '麦克风',
    en: 'MICROPHONE',
    group: '影像与声音',
    icon: 'microphone',
    probe: function (feature) {
      if (!feature.secure) {
        return { status: 'locked', reason: '麦克风需要 HTTPS 或 localhost。' };
      }
      if (!feature.media) {
        return { status: 'locked', reason: '当前浏览器不支持 getUserMedia。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-mic">' +
        '<div class="stage-frame mic-stage"><canvas id="mic-canvas"></canvas>' +
        '<div class="mic-db-overlay" id="mic-db"><span class="db-value">--</span><span class="db-unit">相对 dB</span></div>' +
        '<div class="tnt-warning" id="mic-tnt">⚠ TNT 警告</div></div>' +
        '<div class="slider-row"><label for="mic-gain">灵敏度</label>' +
        '<input id="mic-gain" type="range" min="0.5" max="2.5" step="0.1" value="1">' +
        '<span class="slider-value" id="mic-gain-val">1.0×</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="mic-toggle">停止</button>' +
        '<button class="mc-btn" type="button" id="mic-peak" aria-pressed="true">峰值保持</button>' +
        '<button class="mc-btn" type="button" id="mic-reset">重置峰值</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note">相对值，不是专业声压级；安静时也会显示底噪。</span>' +
        '</div></div>';

      var canvas = ctx.root.querySelector('#mic-canvas');
      var dbBox = ctx.root.querySelector('#mic-db');
      var dbValue = dbBox.querySelector('.db-value');
      var tnt = ctx.root.querySelector('#mic-tnt');
      var toggleBtn = ctx.root.querySelector('#mic-toggle');
      var peakBtn = ctx.root.querySelector('#mic-peak');
      var resetBtn = ctx.root.querySelector('#mic-reset');
      var gainInput = ctx.root.querySelector('#mic-gain');
      var gainValue = ctx.root.querySelector('#mic-gain-val');
      var gain = 1;

      var audioContext = null;
      var stream = null;
      var source = null;
      var analyser = null;
      var data = null;
      var freqData = null;
      var peak = 0;
      var holdPeak = true;
      var peakSeen = false;
      var loudSeen = false;
      var state = { db: 0, freq: 0, note: '--', status: '启动中' };

      ctx.setReadout(
        '<div class="readout-title"><span>声波图腾</span><span>SCULK SENSOR</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">相对音量</span><span class="cell-value" id="mic-r-db">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">主频</span><span class="cell-value" id="mic-r-freq">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">音名</span><span class="cell-value" id="mic-r-note">--</span></div>' +
          '<div class="readout-cell"><span class="cell-label">峰值</span><span class="cell-value" id="mic-r-peak">--</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">灵敏度</span><span class="readout-value" id="mic-r-gain">1.0×</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value" id="mic-r-status">启动中</span></div>'
      );

      function setReadoutValue(id, value) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = value;
      }

      function refresh() {
        setReadoutValue('#mic-r-db', fmt.db(state.db) + ' dB');
        setReadoutValue('#mic-r-freq', state.freq ? fmt.hz(state.freq) : '--');
        setReadoutValue('#mic-r-note', state.note);
        setReadoutValue('#mic-r-peak', fmt.db(peak) + ' dB');
        setReadoutValue('#mic-r-status', state.status);
        setReadoutValue('#mic-r-gain', gain.toFixed(1) + '×');
        dbValue.textContent = fmt.db(state.db);
        dbBox.classList.toggle('is-loud', state.db >= 85);
        tnt.classList.toggle('is-on', state.db >= 85);
      }

      async function start() {
        state.status = '申请中';
        refresh();
        try {
          if (!audioContext) audioContext = ctx.createAudioContext();
          if (audioContext.state === 'suspended') await audioContext.resume();
          stream = await ctx.ensureStream({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
          source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.82;
          source.connect(analyser);
          data = new Uint8Array(analyser.fftSize);
          freqData = new Uint8Array(analyser.frequencyBinCount);
          state.status = '采集中';
          toggleBtn.textContent = '停止';
          toggleBtn.className = 'mc-btn danger';
          refresh();
          SC.core.log.add('麦克风已启动');
        } catch (error) {
          if (!ctx.isActive()) return;
          state.status = '失败';
          refresh();
          ctx.showError(new Error(friendlyError(error)), error && error.name);
        }
      }

      function stop() {
        if (stream) {
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
          stream = null;
        }
        if (source) {
          try {
            source.disconnect();
          } catch (error) {
            /* ignore */
          }
          source = null;
        }
        analyser = null;
        state.status = '已停止';
        toggleBtn.textContent = '开始';
        toggleBtn.className = 'mc-btn primary';
        refresh();
        SC.core.log.add('麦克风已停止');
      }

      function compute() {
        if (!analyser || !data || !freqData) {
          state.db = 0;
          state.freq = 0;
          state.note = '--';
          return;
        }
        analyser.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i += 1) {
          var v = (data[i] - 128) / 128;
          sum += v * v;
        }
        // RMS 换算成 0-120 的相对 dB。+100 只是把常见环境噪声映射到可读区间，不代表声压级。
        var rms = Math.sqrt(sum / data.length) * gain;
        state.db = Math.max(0, Math.min(120, 20 * Math.log10(Math.max(rms, 0.00001)) + 100));
        if (holdPeak) peak = Math.max(peak, state.db);
        else peak = state.db;

        // 取频谱峰值作为主频，再换算成音名；峰值太低时显示 --。
        analyser.getByteFrequencyData(freqData);
        var maxIndex = 0;
        var maxValue = 0;
        for (var j = 1; j < freqData.length; j += 1) {
          if (freqData[j] > maxValue) {
            maxValue = freqData[j];
            maxIndex = j;
          }
        }
        if (maxValue > 24) {
          state.freq = (maxIndex * audioContext.sampleRate) / analyser.fftSize;
          var note = fmt.note(state.freq);
          state.note = note ? note.label + ' (' + (note.cents >= 0 ? '+' : '') + note.cents + 'c)' : '--';
        } else {
          state.freq = 0;
          state.note = '--';
        }

        if (!peakSeen && rms > 0.01) {
          peakSeen = true;
          ctx.toast({ icon: 'microphone', title: '成就达成！', subtitle: '听见世界：第一次采集到声音' });
        }
        if (!loudSeen && state.db >= 100) {
          loudSeen = true;
          ctx.toast({ icon: 'torch', title: '成就达成！', subtitle: '爆破专家：检测到超过 100 dB 的相对音量' });
        }
        refresh();
      }

      function draw() {
        var fit = dom.fitCanvas(canvas);
        var c = fit.ctx;
        var w = fit.width;
        var h = fit.height;
        c.fillStyle = '#081014';
        c.fillRect(0, 0, w, h);

        c.strokeStyle = 'rgba(85,255,255,0.10)';
        c.lineWidth = 1;
        for (var gx = 0; gx < w; gx += 24) {
          c.beginPath();
          c.moveTo(gx, 0);
          c.lineTo(gx, h);
          c.stroke();
        }
        for (var gy = 0; gy < h; gy += 24) {
          c.beginPath();
          c.moveTo(0, gy);
          c.lineTo(w, gy);
          c.stroke();
        }

        if (!analyser || !data) {
          c.fillStyle = 'rgba(85,255,255,0.6)';
          c.font = '10px monospace';
          c.fillText('等待麦克风…', 12, h / 2);
          return;
        }

        var mid = h * 0.30;
        c.strokeStyle = '#55ffff';
        c.lineWidth = 2;
        c.beginPath();
        for (var x = 0; x < w; x += 1) {
          var idx = Math.floor((x / w) * data.length);
          var y = mid + ((data[idx] - 128) / 128) * gain * (h * 0.22);
          if (x === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();

        var barCount = 32;
        var base = h * 0.92;
        var maxBar = h * 0.48;
        var barW = w / barCount;
        c.fillStyle = '#7fff2a';
        for (var b = 0; b < barCount; b += 1) {
          var fIndex = Math.floor((b / barCount) * freqData.length * 0.58);
          var value = Math.min(1, (freqData[fIndex] / 255) * gain);
          var barH = Math.max(1, value * maxBar);
          c.fillRect(b * barW + 1, base - barH, Math.max(1, barW - 2), barH);
        }
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(0, h * 0.56, w, 1);
      }

      toggleBtn.addEventListener('click', function () {
        if (stream) stop();
        else start();
      });

      peakBtn.addEventListener('click', function () {
        holdPeak = !holdPeak;
        peakBtn.setAttribute('aria-pressed', String(holdPeak));
        if (!holdPeak) peak = 0;
      });

      resetBtn.addEventListener('click', function () {
        peak = 0;
        refresh();
        ctx.toast({ icon: 'microphone', title: '峰值已重置', subtitle: '再制造一次大声响' });
      });

      gainInput.addEventListener('input', function () {
        gain = Number(gainInput.value);
        gainValue.textContent = gain.toFixed(1) + '×';
        refresh();
      });

      ctx.interval(compute, 100);
      ctx.raf(draw);
      refresh();
      start();
    }
  });
})(window.SC = window.SC || {});
