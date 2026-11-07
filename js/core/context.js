/* 每个传感器模块的运行时 ctx。统一登记清理函数、rAF、定时器、媒体流和 AudioContext，确保离开模块时不泄漏。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  SC.core.createContext = function (module) {
    var root = document.getElementById('module-root');
    var readout = document.getElementById('bench-readout');
    var cleanups = [];
    var rafIds = new Set();
    var intervalIds = new Set();
    var timeoutIds = new Set();
    var streams = new Set();
    var audioContexts = new Set();
    var active = true;

    function cleanup() {
      if (!active) return;
      active = false;
      // 清理按 LIFO 执行；每个模块自己注册的 off/stop 都会被调用。
      while (cleanups.length) {
        var fn = cleanups.pop();
        try {
          fn();
        } catch (error) {
          /* cleanup must never throw */
        }
      }
      rafIds.forEach(function (id) {
        cancelAnimationFrame(id);
      });
      rafIds.clear();
      intervalIds.forEach(function (id) {
        clearInterval(id);
      });
      intervalIds.clear();
      timeoutIds.forEach(function (id) {
        clearTimeout(id);
      });
      timeoutIds.clear();
      // 媒体轨道与 AudioContext 统一兜底释放，防止离开模块后摄像头/麦克风指示灯仍亮。
      streams.forEach(function (stream) {
        stream.getTracks().forEach(function (track) {
          try {
            track.stop();
          } catch (error) {
            /* ignore */
          }
        });
      });
      streams.clear();
      audioContexts.forEach(function (ac) {
        try {
          ac.close();
        } catch (error) {
          /* ignore */
        }
      });
      audioContexts.clear();
      if (root) dom.clear(root);
      if (readout) dom.clear(readout);
    }

    var ctx = {
      module: module,
      root: root,
      readout: readout,
      feature: SC.core.probe.feature,
      isActive: function () {
        return active;
      },
      onCleanup: function (fn) {
        if (typeof fn === 'function') cleanups.push(fn);
      },
      listen: function (target, type, handler, options) {
        var off = dom.on(target, type, handler, options);
        cleanups.push(off);
        return off;
      },
      raf: function (callback) {
        var id = 0;
        var stopped = false;
        function loop(time) {
          if (stopped || !active) return;
          callback(time);
          id = requestAnimationFrame(loop);
          rafIds.add(id);
        }
        id = requestAnimationFrame(loop);
        rafIds.add(id);
        var stop = function () {
          stopped = true;
          cancelAnimationFrame(id);
          rafIds.delete(id);
        };
        cleanups.push(stop);
        return stop;
      },
      interval: function (callback, ms) {
        var id = setInterval(function () {
          if (active) callback();
        }, ms);
        intervalIds.add(id);
        var stop = function () {
          clearInterval(id);
          intervalIds.delete(id);
        };
        cleanups.push(stop);
        return stop;
      },
      timeout: function (callback, ms) {
        var id = setTimeout(function () {
          timeoutIds.delete(id);
          if (active) callback();
        }, ms);
        timeoutIds.add(id);
        return function () {
          clearTimeout(id);
          timeoutIds.delete(id);
        };
      },
      ensureStream: async function (constraints) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          var err = new Error('当前浏览器不支持 getUserMedia');
          err.code = 'NOT_SUPPORTED';
          throw err;
        }
        var stream = await navigator.mediaDevices.getUserMedia(constraints);
        streams.add(stream);
        return stream;
      },
      createAudioContext: function () {
        var AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) {
          var err = new Error('当前浏览器不支持 Web Audio');
          err.code = 'NOT_SUPPORTED';
          throw err;
        }
        var ac = new AudioCtor();
        audioContexts.add(ac);
        return ac;
      },
      motionPermission: function () {
        return SC.core.permissions.requestMotion();
      },
      toast: function (options) {
        if (SC.ui.toast) SC.ui.toast.show(options);
      },
      log: function (text) {
        SC.core.log.add(text);
      },
      setReadout: function (html) {
        if (readout) readout.innerHTML = html;
      },
      setStatus: function (text, kind) {
        var badge = document.getElementById('bench-status');
        if (!badge) return;
        badge.textContent = text;
        badge.className = 'status-badge ' + (kind || '');
      },
      setXp: function (percent, level) {
        if (SC.ui.hud) SC.ui.hud.setXp(percent, level);
      },
      showError: function (error, code) {
        if (!root) return;
        var message = error && error.message ? error.message : String(error || '未知错误');
        var panel = dom.el('div', { class: 'error-panel' });
        var codeEl = dom.el('div', { class: 'error-code', text: code || (error && error.code) || 'UNKNOWN' });
        var title = dom.el('h3', { text: '红石信号中断' });
        var text = dom.el('p', { text: message });
        var back = dom.el('button', {
          class: 'mc-btn danger',
          type: 'button',
          text: '返回背包',
          onclick: function () {
            if (history.length > 1) history.back();
            else SC.core.lifecycle.close();
          }
        });
        panel.appendChild(codeEl);
        panel.appendChild(title);
        panel.appendChild(text);
        panel.appendChild(back);
        dom.clear(root);
        root.appendChild(panel);
        SC.core.log.add('模块错误：' + message);
      }
    };

    ctx.cleanup = cleanup;
    return ctx;
  };
})(window.SC = window.SC || {});
