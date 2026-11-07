/* 扬声器/语音：音调、TTS、语音识别。iOS 常返回 service-not-allowed，已做明确提示和麦克风降级。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var fmt = SC.core.format;

  var WAVES = ['sine', 'square', 'sawtooth', 'triangle'];

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  SC.registerSensor({
    id: 'speaker',
    name: '扬声器/语音',
    en: 'SPEAKER & VOICE',
    group: '交互与输出',
    icon: 'speaker',
    probe: function (feature) {
      if (!(window.AudioContext || window.webkitAudioContext)) {
        return { status: 'locked', reason: '当前浏览器不支持 Web Audio，无法播放音调。' };
      }
      if (!feature.speechSynthesis) {
        return { status: 'partial', reason: '可以播放音调，但当前浏览器不支持语音朗读。' };
      }
      if (isIOS()) {
        return {
          status: 'partial',
          reason: '音调与朗读可用；iOS Safari 通常拒绝网页语音识别（service-not-allowed）。'
        };
      }
      if (!feature.speechRecognition) {
        return { status: 'partial', reason: '音调与朗读可用；当前浏览器不支持语音识别。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-speaker">' +
        '<div class="note-field" id="note-field"></div>' +
        '<div class="slider-row"><label for="tone-freq">频率</label>' +
        '<input id="tone-freq" type="range" min="20" max="2000" step="1" value="440">' +
        '<span class="slider-value" id="tone-freq-val">440 Hz</span></div>' +
        '<div class="module-toolbar" id="wave-row">' +
        '<button class="mc-btn" type="button" data-wave="sine" aria-pressed="true">正弦</button>' +
        '<button class="mc-btn" type="button" data-wave="square" aria-pressed="false">方波</button>' +
        '<button class="mc-btn" type="button" data-wave="sawtooth" aria-pressed="false">锯齿</button>' +
        '<button class="mc-btn" type="button" data-wave="triangle" aria-pressed="false">三角</button>' +
        '<span class="spacer"></span>' +
        '<button class="mc-btn primary" type="button" id="tone-play">播放</button>' +
        '</div>' +
        '<div class="slider-row"><label for="tone-vol">音量</label>' +
        '<input id="tone-vol" type="range" min="0" max="1" step="0.05" value="0.3">' +
        '<span class="slider-value" id="tone-vol-val">0.30</span></div>' +
        '<div class="readout-grid">' +
        '<div class="readout-cell"><span class="cell-label">音名</span><span class="cell-value" id="tone-note">A4</span></div>' +
        '<div class="readout-cell"><span class="cell-label">波形</span><span class="cell-value" id="tone-wave">sine</span></div>' +
        '</div>' +
        '<label class="module-note" for="tts-text">语音朗读（TTS）：</label>' +
        '<textarea class="tts-input" id="tts-text">你好，我是 SENSORCRAFT 的村民。</textarea>' +
        '<div class="voice-row"><label for="tts-voice">声音</label>' +
        '<select class="mc-select" id="tts-voice"></select></div>' +
        '<div class="slider-row"><label for="tts-rate">语速</label>' +
        '<input id="tts-rate" type="range" min="0.5" max="2" step="0.1" value="1">' +
        '<span class="slider-value" id="tts-rate-val">1.0</span></div>' +
        '<div class="slider-row"><label for="tts-pitch">音调</label>' +
        '<input id="tts-pitch" type="range" min="0.5" max="2" step="0.1" value="1">' +
        '<span class="slider-value" id="tts-pitch-val">1.0</span></div>' +
        '<div class="slider-row"><label for="tts-volume">音量</label>' +
        '<input id="tts-volume" type="range" min="0" max="1" step="0.05" value="1">' +
        '<span class="slider-value" id="tts-volume-val">1.00</span></div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="tts-speak">朗读</button>' +
        '<button class="mc-btn" type="button" id="tts-stop">停止朗读</button>' +
        '<button class="mc-btn danger" type="button" id="tts-all-stop">全部停止</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="tts-note"></span>' +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="asr-btn" disabled>语音识别（不可用）</button>' +
        '<button class="mc-btn" type="button" id="asr-mic">打开麦克风</button>' +
        '<span class="module-note" id="asr-note">正在检测语音识别能力…</span>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>音符盒</span><span>NOTE BLOCK</span></div>' +
          '<div class="readout-grid">' +
          '<div class="readout-cell"><span class="cell-label">频率</span><span class="cell-value" id="spk-r-freq">440 Hz</span></div>' +
          '<div class="readout-cell"><span class="cell-label">音名</span><span class="cell-value" id="spk-r-note">A4</span></div>' +
          '<div class="readout-cell"><span class="cell-label">波形</span><span class="cell-value" id="spk-r-wave">sine</span></div>' +
          '<div class="readout-cell"><span class="cell-label">状态</span><span class="cell-value" id="spk-r-status">停止</span></div>' +
          '</div>' +
          '<div class="readout-row"><span class="readout-label">TTS</span><span class="readout-value" id="spk-r-tts">可用</span></div>' +
          '<div class="readout-row"><span class="readout-label">声音</span><span class="readout-value" id="spk-r-voice">默认</span></div>' +
          '<div class="readout-row"><span class="readout-label">语音识别</span><span class="readout-value" id="spk-r-asr">--</span></div>'
      );

      var freqInput = ctx.root.querySelector('#tone-freq');
      var freqVal = ctx.root.querySelector('#tone-freq-val');
      var noteEl = ctx.root.querySelector('#tone-note');
      var waveEl = ctx.root.querySelector('#tone-wave');
      var playBtn = ctx.root.querySelector('#tone-play');
      var waveRow = ctx.root.querySelector('#wave-row');
      var noteField = ctx.root.querySelector('#note-field');
      var ttsText = ctx.root.querySelector('#tts-text');
      var ttsSpeak = ctx.root.querySelector('#tts-speak');
      var ttsStop = ctx.root.querySelector('#tts-stop');
      var ttsAllStop = ctx.root.querySelector('#tts-all-stop');
      var ttsNote = ctx.root.querySelector('#tts-note');
      var voiceSelect = ctx.root.querySelector('#tts-voice');
      var rateInput = ctx.root.querySelector('#tts-rate');
      var rateValue = ctx.root.querySelector('#tts-rate-val');
      var pitchInput = ctx.root.querySelector('#tts-pitch');
      var pitchValue = ctx.root.querySelector('#tts-pitch-val');
      var volumeInput = ctx.root.querySelector('#tts-volume');
      var volumeValue = ctx.root.querySelector('#tts-volume-val');
      var toneVolInput = ctx.root.querySelector('#tone-vol');
      var toneVolValue = ctx.root.querySelector('#tone-vol-val');
      var asrBtn = ctx.root.querySelector('#asr-btn');
      var asrMic = ctx.root.querySelector('#asr-mic');
      var asrNote = ctx.root.querySelector('#asr-note');
      var asrState = ctx.feature.speechRecognition ? (isIOS() ? '受限（iOS）' : '可用') : '不可用';
      var asrDisabled = !ctx.feature.speechRecognition;

      var audioContext = null;
      var oscillator = null;
      var gain = null;
      var wave = 'sine';
      var toneVolume = 0.3;
      var voicesCache = [];
      var playing = false;
      var toneSeen = false;
      var ttsSeen = false;
      var recognition = null;
      var particleTimer = null;

      function setReadout(id, text) {
        var el = ctx.readout.querySelector(id);
        if (el) el.textContent = text;
      }

      function noteFor(freq) {
        var note = fmt.note(freq);
        return note ? note.label : '--';
      }

      function refresh() {
        var freq = Number(freqInput.value);
        freqVal.textContent = Math.round(freq) + ' Hz';
        noteEl.textContent = noteFor(freq);
        waveEl.textContent = wave;
        setReadout('#spk-r-freq', Math.round(freq) + ' Hz');
        setReadout('#spk-r-note', noteFor(freq));
        setReadout('#spk-r-wave', wave);
        setReadout('#spk-r-status', playing ? '播放中' : '停止');
        setReadout('#spk-r-tts', ctx.feature.speechSynthesis ? '可用' : '不可用');
        setReadout('#spk-r-asr', asrState);
        var selected = voicesCache[Number(voiceSelect.value)];
        setReadout('#spk-r-voice', selected ? selected.name : '默认');
      }

      function spawnNote() {
        var note = document.createElement('span');
        note.className = 'note-particle';
        note.style.left = 6 + Math.random() * 88 + '%';
        note.style.background = Math.random() > 0.5 ? '#7fff2a' : '#ffd700';
        noteField.appendChild(note);
        setTimeout(function () {
          if (note.parentNode) note.parentNode.removeChild(note);
        }, 1700);
      }

      async function startTone() {
        try {
          if (!audioContext) audioContext = ctx.createAudioContext();
          if (audioContext.state === 'suspended') await audioContext.resume();
          if (oscillator) {
            try {
              oscillator.stop();
            } catch (error) {
              /* ignore */
            }
          }
          oscillator = audioContext.createOscillator();
          gain = audioContext.createGain();
          gain.gain.value = Math.max(0.0001, toneVolume * 0.25);
          oscillator.type = wave;
          oscillator.frequency.value = Number(freqInput.value);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start();
          playing = true;
          playBtn.textContent = '停止';
          playBtn.className = 'mc-btn danger';
          noteField.innerHTML = '';
          noteField.classList.add('is-playing');
          particleTimer = ctx.interval(spawnNote, 260);
          spawnNote();
          refresh();
          if (!toneSeen) {
            toneSeen = true;
            ctx.toast({ icon: 'speaker', title: '成就达成！', subtitle: '调音师：播放了第一个音调' });
          }
          SC.core.log.add('音调播放：' + Math.round(Number(freqInput.value)) + ' Hz ' + wave);
        } catch (error) {
          ctx.showError(error, 'AUDIO');
        }
      }

      function stopTone() {
        if (oscillator) {
          try {
            oscillator.stop();
          } catch (error) {
            /* ignore */
          }
          oscillator = null;
        }
        if (gain) {
          try {
            gain.disconnect();
          } catch (error) {
            /* ignore */
          }
          gain = null;
        }
        if (particleTimer) {
          particleTimer();
          particleTimer = null;
        }
        playing = false;
        noteField.classList.remove('is-playing');
        playBtn.textContent = '播放';
        playBtn.className = 'mc-btn primary';
        refresh();
      }

      function speak() {
        if (!ctx.feature.speechSynthesis) {
          ttsNote.textContent = '当前浏览器不支持语音朗读。';
          return;
        }
        var text = ttsText.value.trim();
        if (!text) {
          ttsNote.textContent = '先输入要朗读的文字。';
          return;
        }
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = Number(rateInput.value) || 1;
        utterance.pitch = Number(pitchInput.value) || 1;
        utterance.volume = Number(volumeInput.value);
        var selected = voicesCache[Number(voiceSelect.value)];
        if (selected) utterance.voice = selected;
        utterance.onstart = function () {
          ttsNote.textContent = '正在朗读…';
        };
        utterance.onend = function () {
          ttsNote.textContent = '朗读完成。';
        };
        utterance.onerror = function (event) {
          ttsNote.textContent = '朗读失败：' + (event.error || '未知错误');
        };
        window.speechSynthesis.speak(utterance);
        if (!ttsSeen) {
          ttsSeen = true;
          ctx.toast({ icon: 'speaker', title: '成就达成！', subtitle: '会说话的村民：完成第一次语音朗读' });
        }
        SC.core.log.add('TTS 朗读：' + text.slice(0, 24));
      }

      freqInput.addEventListener('input', function () {
        if (oscillator) oscillator.frequency.value = Number(freqInput.value);
        refresh();
      });

      waveRow.addEventListener('click', function (event) {
        var button = event.target.closest('[data-wave]');
        if (!button) return;
        wave = button.getAttribute('data-wave');
        Array.prototype.forEach.call(waveRow.querySelectorAll('[data-wave]'), function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        if (oscillator) oscillator.type = wave;
        refresh();
      });

      playBtn.addEventListener('click', function () {
        if (playing) stopTone();
        else startTone();
      });

      function populateVoices() {
        if (!window.speechSynthesis) return;
        voicesCache = window.speechSynthesis.getVoices();
        voiceSelect.innerHTML = '';
        if (!voicesCache.length) {
          var opt = document.createElement('option');
          opt.value = '0';
          opt.textContent = '默认声音';
          voiceSelect.appendChild(opt);
          return;
        }
        voicesCache.forEach(function (voice, index) {
          var opt = document.createElement('option');
          opt.value = String(index);
          opt.textContent = voice.name + ' (' + voice.lang + ')';
          voiceSelect.appendChild(opt);
        });
        var zhIndex = -1;
        for (var i = 0; i < voicesCache.length; i += 1) {
          if (/zh|Chinese/i.test(voicesCache[i].lang + ' ' + voicesCache[i].name)) {
            zhIndex = i;
            break;
          }
        }
        voiceSelect.value = String(zhIndex >= 0 ? zhIndex : 0);
        refresh();
      }

      ttsSpeak.addEventListener('click', speak);
      ttsStop.addEventListener('click', function () {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        ttsNote.textContent = '已停止。';
      });
      ttsAllStop.addEventListener('click', function () {
        stopTone();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        ttsNote.textContent = '所有声音已停止。';
        ctx.toast({ icon: 'speaker', title: '全部停止', subtitle: '音调与朗读都已关闭' });
      });
      voiceSelect.addEventListener('change', refresh);
      rateInput.addEventListener('input', function () {
        rateValue.textContent = Number(rateInput.value).toFixed(1);
      });
      pitchInput.addEventListener('input', function () {
        pitchValue.textContent = Number(pitchInput.value).toFixed(1);
      });
      volumeInput.addEventListener('input', function () {
        volumeValue.textContent = Number(volumeInput.value).toFixed(2);
      });
      toneVolInput.addEventListener('input', function () {
        toneVolume = Number(toneVolInput.value);
        toneVolValue.textContent = toneVolume.toFixed(2);
        if (gain) gain.gain.value = Math.max(0.0001, toneVolume * 0.25);
      });

      asrMic.addEventListener('click', function () {
        SC.core.lifecycle.open('microphone');
      });

      if (ctx.feature.speechRecognition) {
        var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        asrBtn.disabled = false;
        asrBtn.textContent = isIOS() ? '尝试语音识别' : '开始语音识别';
        asrNote.textContent = isIOS()
          ? 'iOS Safari 常返回 service-not-allowed；这不是麦克风权限问题。'
          : '点击后说话，浏览器会转写。';

        asrBtn.addEventListener('click', function () {
          if (asrDisabled) return;
          if (recognition) {
            recognition.stop();
            recognition = null;
            asrBtn.textContent = isIOS() ? '尝试语音识别' : '开始语音识别';
            asrNote.textContent = '识别已停止。';
            return;
          }
          var errorCode = null;
          recognition = new SpeechRecognitionCtor();
          recognition.lang = 'zh-CN';
          recognition.interimResults = true;
          recognition.continuous = false;
          recognition.onresult = function (event) {
            var text = '';
            for (var i = event.resultIndex; i < event.results.length; i += 1) {
              text += event.results[i][0].transcript;
            }
            asrNote.textContent = '识别：' + text;
            asrState = '可用';
            refresh();
          };
          recognition.onerror = function (event) {
            var code = event.error || 'unknown';
            errorCode = code;
            var message;
            // iOS Safari 的典型错误：服务端不开放网页语音识别。禁用按钮并给出降级路径，不重试轰炸。
            if (code === 'service-not-allowed' || code === 'not-allowed') {
              message = '浏览器拒绝语音识别服务（' + code + '）。iOS Safari 不开放网页语音识别，这不是麦克风权限问题；可以改用 TTS、麦克风可视化或原生 App。';
              asrState = '不可用（' + code + '）';
              asrDisabled = true;
              asrBtn.disabled = true;
              asrBtn.textContent = '语音识别不可用';
              ctx.toast({
                icon: 'barrier',
                title: '语音识别被系统拒绝',
                subtitle: 'iOS Safari 不开放网页语音识别'
              });
            } else if (code === 'no-speech') {
              message = '没有听到语音，请靠近麦克风再说一次。';
              asrState = '可用';
            } else if (code === 'audio-capture') {
              message = '找不到麦克风，或麦克风被其他 App 占用。';
              asrState = '麦克风不可用';
            } else if (code === 'network') {
              message = '语音识别服务网络错误，请检查网络后重试。';
              asrState = '网络错误';
            } else if (code === 'aborted') {
              message = '识别已取消。';
            } else if (code === 'language-not-supported') {
              message = '当前浏览器的语音识别不支持中文。';
              asrState = '语言不支持';
              asrDisabled = true;
              asrBtn.disabled = true;
              asrBtn.textContent = '语音识别不可用';
            } else {
              message = '识别失败：' + code;
            }
            asrNote.textContent = message;
            recognition = null;
            if (!asrDisabled) {
              asrBtn.textContent = isIOS() ? '重试语音识别' : '开始语音识别';
            }
            refresh();
            SC.core.log.add('语音识别错误：' + code);
          };
          recognition.onend = function () {
            recognition = null;
            if (!asrDisabled) {
              asrBtn.textContent = isIOS() ? '尝试语音识别' : '开始语音识别';
              if (!errorCode) asrState = '可用';
            }
            refresh();
          };
          try {
            recognition.start();
            asrBtn.textContent = '停止识别';
            asrNote.textContent = '正在听…';
          } catch (error) {
            recognition = null;
            asrNote.textContent = '无法启动语音识别：' + (error && error.message ? error.message : '未知错误');
            asrBtn.textContent = isIOS() ? '尝试语音识别' : '开始语音识别';
            refresh();
          }
        });
      } else {
        asrBtn.textContent = '语音识别不可用';
        asrNote.textContent = '当前浏览器不支持 SpeechRecognition；可以用「打开麦克风」查看声音。';
      }

      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = populateVoices;
        populateVoices();
      }

      ctx.onCleanup(function () {
        stopTone();
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.onvoiceschanged = null;
        }
        if (recognition) {
          try {
            recognition.stop();
          } catch (error) {
            /* ignore */
          }
        }
      });

      refresh();
    }
  });
})(window.SC = window.SC || {});
