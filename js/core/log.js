/* 事件日志：左下角聊天框只显示最近 3 条，history 保留最近 200 条供调试面板上传。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var log = (SC.core.log = {
    el: null,
    lines: [],
    history: [],
    maxHistory: 200,
    ready: false,
    consolePatched: false,
    init: function () {
      if (log.ready) return;
      log.el = document.getElementById('chat-log');
      log.ready = true;
      log.captureConsole();
      window.addEventListener('error', function (event) {
        var where = event.filename
          ? ' @ ' + event.filename + ':' + (event.lineno || 0) + ':' + (event.colno || 0)
          : '';
        log.add('脚本错误：' + (event.message || '未知错误') + where);
      });
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        var message = reason && reason.message ? reason.message : String(reason || '未知 Promise 错误');
        log.add('未处理的异步错误：' + message);
      });
    },
    captureConsole: function () {
      if (log.consolePatched) return;
      log.consolePatched = true;
      ['error', 'warn'].forEach(function (level) {
        var original = console[level];
        if (typeof original !== 'function') return;
        console[level] = function () {
          try {
            var parts = Array.prototype.map.call(arguments, function (arg) {
              if (arg instanceof Error) return arg.stack || arg.message;
              if (typeof arg === 'object' && arg !== null) {
                try {
                  return JSON.stringify(arg);
                } catch (error) {
                  return String(arg);
                }
              }
              return String(arg);
            });
            log.add('[console.' + level + '] ' + parts.join(' '));
          } catch (error) {
            /* never break the console */
          }
          return original.apply(console, arguments);
        };
      });
    },
    add: function (text) {
      var value = String(text);
      log.history.push({ time: new Date().toISOString(), text: value });
      while (log.history.length > log.maxHistory) log.history.shift();

      if (!log.el) log.el = document.getElementById('chat-log');
      if (!log.el) return;
      var line = dom.el('div', { class: 'chat-line' });
      var prefix = dom.el('span', { class: 'chat-prefix', text: '[SENSORCRAFT]' });
      line.appendChild(prefix);
      line.appendChild(document.createTextNode(' ' + value));
      log.el.appendChild(line);
      log.lines.push(line);

      while (log.lines.length > (SC.config.maxLogLines || 3)) {
        var old = log.lines.shift();
        if (old && old.parentNode) old.parentNode.removeChild(old);
      }

      setTimeout(function () {
        line.classList.add('is-fading');
        setTimeout(function () {
          if (line.parentNode) line.parentNode.removeChild(line);
          var index = log.lines.indexOf(line);
          if (index >= 0) log.lines.splice(index, 1);
        }, 450);
      }, SC.config.logFadeMs || 8000);
    },
    exportText: function () {
      if (!log.history.length) return '（暂无日志）';
      return log.history
        .map(function (entry) {
          return '[' + entry.time + '] ' + entry.text;
        })
        .join('\n');
    },
    clear: function () {
      log.history = [];
      log.lines.slice().forEach(function (line) {
        if (line.parentNode) line.parentNode.removeChild(line);
      });
      log.lines = [];
    }
  });
})(window.SC = window.SC || {});
