/* 调试日志面板：复制、下载、预填 GitHub Issue，以及可选的 Worker/Vercel 直传。token 永远不进入网页。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var debug = (SC.ui.debug = {
    panel: null,
    logBox: null,
    fab: null,
    badge: null,
    issueLink: null,
    githubBtn: null,
    endpointInput: null,
    endpointStatus: null,
    endpointKey: 'sensorcraft-log-endpoint',
    init: function () {
      var app = document.getElementById('app');
      if (!app) return;

      var fab = dom.el('button', {
        class: 'mc-btn tiny debug-fab',
        type: 'button',
        id: 'debug-fab',
        text: 'LOG',
        title: '打开调试日志 / 提交到 GitHub'
      });
      var badge = dom.el('span', { class: 'debug-badge', id: 'debug-badge', hidden: true, text: '0' });
      fab.appendChild(badge);
      app.appendChild(fab);
      debug.fab = fab;
      debug.badge = badge;

      var panel = dom.el('div', {
        id: 'debug-panel',
        class: 'debug-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': '调试日志',
        hidden: true
      });
      var win = dom.el('div', { class: 'debug-window' });

      var head = dom.el('div', { class: 'debug-head' });
      head.appendChild(dom.el('span', { text: '调试日志 / DEBUG LOG' }));
      var closeBtn = dom.el('button', { class: 'mc-btn tiny', type: 'button', text: '关闭' });
      head.appendChild(closeBtn);

      var toolbar = dom.el('div', { class: 'debug-toolbar' });
      var copyBtn = dom.el('button', { class: 'mc-btn', type: 'button', text: '复制日志' });
      var githubBtn = dom.el('button', { class: 'mc-btn primary', type: 'button', text: '提交到 GitHub' });
      var downloadBtn = dom.el('button', { class: 'mc-btn', type: 'button', text: '下载 .txt' });
      var clearBtn = dom.el('button', { class: 'mc-btn danger', type: 'button', text: '清空' });
      toolbar.appendChild(copyBtn);
      toolbar.appendChild(githubBtn);
      toolbar.appendChild(downloadBtn);
      toolbar.appendChild(clearBtn);

      var note = dom.el('div', {
        class: 'debug-note',
        text: '「提交到 GitHub」：配置了直传端点就直接创建 Issue；未配置则打开新建 Issue 页面并把日志复制到剪贴板。token 只在服务端，不会进入网页。日志会公开，请不要包含隐私信息。'
      });

      var endpointRow = dom.el('div', { class: 'debug-endpoint' });
      endpointRow.appendChild(dom.el('label', { for: 'debug-endpoint-input', text: '直传端点（可选）' }));
      var endpointInput = dom.el('input', {
        id: 'debug-endpoint-input',
        class: 'mc-select',
        type: 'url',
        placeholder: 'https://sensorcraft-log.<subdomain>.workers.dev/logs',
        autocomplete: 'off',
        spellcheck: 'false'
      });
      var endpointSave = dom.el('button', { class: 'mc-btn tiny', type: 'button', text: '保存' });
      var endpointStatus = dom.el('span', { class: 'module-note', id: 'debug-endpoint-status', text: '' });
      endpointRow.appendChild(endpointInput);
      endpointRow.appendChild(endpointSave);
      endpointRow.appendChild(endpointStatus);

      var issueLink = dom.el('a', {
        class: 'mc-btn debug-issue-link',
        target: '_blank',
        rel: 'noopener',
        hidden: true,
        text: '打开 GitHub Issue 页面'
      });

      var logBox = dom.el('pre', { class: 'debug-log', id: 'debug-log', text: '' });

      win.appendChild(head);
      win.appendChild(toolbar);
      win.appendChild(note);
      win.appendChild(endpointRow);
      win.appendChild(issueLink);
      win.appendChild(logBox);
      panel.appendChild(win);
      app.appendChild(panel);

      debug.panel = panel;
      debug.logBox = logBox;
      debug.issueLink = issueLink;
      debug.githubBtn = githubBtn;
      debug.endpointInput = endpointInput;
      debug.endpointStatus = endpointStatus;

      fab.addEventListener('click', debug.open);
      closeBtn.addEventListener('click', debug.close);
      panel.addEventListener('click', function (event) {
        if (event.target === panel) debug.close();
      });
      copyBtn.addEventListener('click', debug.copy);
      githubBtn.addEventListener('click', debug.submit);
      downloadBtn.addEventListener('click', debug.download);
      endpointSave.addEventListener('click', debug.saveEndpoint);
      clearBtn.addEventListener('click', function () {
        SC.core.log.clear();
        debug.render();
        SC.ui.toast.show({ icon: 'barrier', title: '日志已清空', subtitle: '从下一条事件重新记录' });
      });

      window.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !panel.hidden) {
          event.preventDefault();
          event.stopImmediatePropagation();
          debug.close();
        }
      }, true);

      debug.loadEndpoint();
      setInterval(debug.updateBadge, 2000);
      debug.updateBadge();
    },
    open: function () {
      if (!debug.panel) return;
      debug.render();
      debug.issueLink.hidden = true;
      debug.panel.hidden = false;
      document.body.classList.add('debug-open');
      var close = debug.panel.querySelector('.debug-head .mc-btn');
      if (close) close.focus();
    },
    close: function () {
      if (!debug.panel) return;
      debug.panel.hidden = true;
      document.body.classList.remove('debug-open');
      if (debug.fab) debug.fab.focus();
    },
    render: function () {
      if (!debug.logBox) return;
      debug.logBox.textContent = debug.buildText();
      debug.logBox.scrollTop = debug.logBox.scrollHeight;
    },
    loadEndpoint: function () {
      var value = '';
      try {
        value = localStorage.getItem(debug.endpointKey) || '';
      } catch (error) {
        value = '';
      }
      if (!value) value = SC.config.logEndpoint || '';
      debug.endpointInput.value = value;
      SC.config.logEndpoint = value;
      debug.updateEndpointStatus();
    },
    updateEndpointStatus: function () {
      if (!debug.endpointStatus) return;
      var value = (debug.endpointInput.value || '').trim();
      debug.endpointStatus.textContent = value
        ? '已配置：提交时直接创建 Issue'
        : '未配置：使用预填 Issue 页面';
      debug.endpointStatus.className = 'module-note' + (value ? ' ok-text' : '');
    },
    saveEndpoint: function () {
      var value = (debug.endpointInput.value || '').trim();
      if (value && !/^https?:\/\//i.test(value)) {
        SC.ui.toast.show({ icon: 'barrier', title: '端点格式不对', subtitle: '需要以 https:// 开头' });
        return;
      }
      if (value && !/^https:\/\//i.test(value) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(value)) {
        SC.ui.toast.show({ icon: 'barrier', title: '请使用 HTTPS', subtitle: '只有 localhost 可以用 http://' });
        return;
      }
      try {
        if (value) localStorage.setItem(debug.endpointKey, value);
        else localStorage.removeItem(debug.endpointKey);
      } catch (error) {
        /* localStorage can be unavailable in private mode */
      }
      SC.config.logEndpoint = value;
      debug.updateEndpointStatus();
      SC.ui.toast.show({
        icon: value ? 'map' : 'barrier',
        title: value ? '直传端点已保存' : '直传端点已清除',
        subtitle: value ? '提交时会直接创建 Issue' : '将使用预填 Issue 页面'
      });
    },
    buildText: function () {
      var summary = SC.core.probe.summary();
      var feature = SC.core.probe.feature;
      var enabledFeatures = Object.keys(feature)
        .filter(function (key) {
          return feature[key] === true;
        })
        .join(', ');
      var current = SC.core.lifecycle.current;
      var lines = [
        'SENSORCRAFT 调试日志',
        '时间: ' + new Date().toISOString(),
        '版本: ' + SC.version,
        '页面: ' + location.href,
        '当前模块: ' + (current ? current.id : 'BAG'),
        '安全上下文: ' + (window.isSecureContext !== false ? 'YES' : 'NO'),
        '视口: ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1),
        'UA: ' + navigator.userAgent,
        '平台: ' + (navigator.platform || '--'),
        '权限状态: ' + JSON.stringify(SC.core.permissions.state),
        '屏幕常亮: ' + (SC.core.wakeLock.enabled ? 'ON' : 'OFF'),
        '卡片: ' + summary.ready + ' ready / ' + summary.partial + ' partial / ' + summary.locked + ' locked / ' + summary.info + ' info',
        '可用特性: ' + (enabledFeatures || '--'),
        '',
        '--- 日志 ---',
        SC.core.log.exportText()
      ];
      return lines.join('\n');
    },
    copy: function () {
      dom.copyText(debug.buildText())
        .then(function () {
          SC.ui.toast.show({ icon: 'map', title: '日志已复制', subtitle: '可以粘贴到 GitHub Issue 或聊天里' });
        })
        .catch(function () {
          SC.ui.toast.show({ icon: 'barrier', title: '复制失败', subtitle: '请手动长按选择日志文本' });
        });
    },
    download: function () {
      var blob = new Blob([debug.buildText()], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'sensorcraft-log-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 3000);
      SC.ui.toast.show({ icon: 'map', title: '日志已下载', subtitle: '可以把 .txt 附件拖进 GitHub Issue' });
    },
    // 有直传端点时走 Worker/Vercel；否则回退到预填 Issue。两条路都不会把 token 放进页面。
    submit: function () {
      var full = debug.buildText();
      var endpoint = (debug.endpointInput.value || '').trim();
      if (endpoint && !/^https?:\/\//i.test(endpoint)) {
        SC.ui.toast.show({ icon: 'barrier', title: '端点格式不对', subtitle: '改用预填 Issue 页面' });
        endpoint = '';
      }
      if (endpoint) debug.submitDirect(endpoint, full);
      else debug.openIssue(full);
    },
    submitDirect: function (endpoint, full) {
      var title = 'SENSORCRAFT 调试日志 ' + new Date().toLocaleString('zh-CN');
      var payload = {
        title: title,
        body: full.slice(0, 18000),
        source: 'sensorcraft',
        page: location.href
      };
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, 15000);

      debug.githubBtn.disabled = true;
      debug.githubBtn.textContent = '上传中…';

      // 直传只把日志正文发给代理；token 在服务端。15 秒超时，失败自动回退。
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
        .then(function (response) {
          return response.json().catch(function () {
            return {};
          }).then(function (data) {
            if (!response.ok || !data.ok) {
              throw new Error(data.message || data.error || ('HTTP ' + response.status));
            }
            return data;
          });
        })
        .then(function (data) {
          var issue = data.issue || {};
          debug.issueLink.href = issue.url || SC.config.issueUrl;
          debug.issueLink.textContent = issue.number ? '查看 Issue #' + issue.number : '查看 Issue';
          debug.issueLink.hidden = false;
          SC.ui.toast.show({
            icon: 'map',
            title: '日志已提交',
            subtitle: issue.number ? 'Issue #' + issue.number : 'GitHub Issue 已创建'
          });
        })
        .catch(function (error) {
          SC.ui.toast.show({
            icon: 'barrier',
            title: '直传失败',
            subtitle: (error && error.message ? error.message : '网络错误') + '，改用预填 Issue'
          });
          debug.openIssue(full);
        })
        .finally(function () {
          clearTimeout(timer);
          debug.githubBtn.disabled = false;
          debug.githubBtn.textContent = '提交到 GitHub';
        });
    },
    openIssue: function (full) {
      var title = 'SENSORCRAFT 调试日志 ' + new Date().toLocaleString('zh-CN');
      var maxBody = 4000;
      var truncated = full.length > maxBody;
      var body = truncated
        ? full.slice(0, maxBody) + '\n\n…（日志过长，完整内容已复制到剪贴板，请粘贴到这里）'
        : full;
      var url = SC.config.issueUrl + '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);

      dom.copyText(full)
        .then(function () {
          SC.ui.toast.show({
            icon: 'map',
            title: '完整日志已复制',
            subtitle: '在 GitHub Issue 页面粘贴后提交'
          });
        })
        .catch(function () {
          SC.ui.toast.show({
            icon: 'barrier',
            title: '剪贴板不可用',
            subtitle: '请在日志框里手动复制'
          });
        });

      var opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        debug.issueLink.href = url;
        debug.issueLink.textContent = '打开 GitHub Issue 页面';
        debug.issueLink.hidden = false;
        SC.ui.toast.show({
          icon: 'barrier',
          title: '弹窗被拦截',
          subtitle: '点「打开 GitHub Issue 页面」继续'
        });
      }
    },
    updateBadge: function () {
      if (!debug.badge) return;
      var count = SC.core.log.history.filter(function (entry) {
        return /error|错误|失败|拒绝|Unhandled|未处理/i.test(entry.text);
      }).length;
      debug.badge.textContent = count > 99 ? '99+' : String(count);
      debug.badge.hidden = count === 0;
      if (debug.fab) debug.fab.classList.toggle('has-errors', count > 0);
    }
  });
})(window.SC = window.SC || {});
