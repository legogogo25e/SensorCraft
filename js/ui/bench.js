/* 工作台外壳：标题栏、返回按钮、状态角标、模块容器和右侧读数容器。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var BASE_TITLE = document.title;

  var STATUS = {
    ready: { label: 'READY', cls: '' },
    partial: { label: 'LIMITED', cls: 'partial' },
    locked: { label: 'LOCKED', cls: 'locked' },
    info: { label: 'INFO', cls: 'info' }
  };

  var bench = (SC.ui.bench = {
    render: function (module, status) {
      var host = document.getElementById('bench-view');
      if (!host) return;
      var meta = STATUS[status.status] || STATUS.ready;
      var iconSvg = (SC.ui.icons && SC.ui.icons[module.icon]) || (SC.ui.icons && SC.ui.icons.barrier) || '';

      dom.clear(host);
      host.hidden = false;

      var titlebar = dom.el('div', { class: 'bench-titlebar' });
      var back = dom.el('button', {
        class: 'mc-btn tiny',
        type: 'button',
        text: '← 返回',
        'aria-label': '返回背包'
      });
      back.addEventListener('click', function () {
        if (history.length > 1) history.back();
        else SC.core.lifecycle.close();
      });

      var title = dom.el('div', { class: 'bench-title' });
      title.appendChild(dom.el('span', { class: 'bench-title-icon', html: iconSvg }));
      var titleText = dom.el('div');
      titleText.appendChild(dom.el('h2', { text: module.name }));
      titleText.appendChild(dom.el('div', { class: 'bench-en', text: module.en }));
      title.appendChild(titleText);

      var badge = dom.el('span', {
        class: 'status-badge ' + meta.cls,
        id: 'bench-status',
        text: meta.label
      });

      titlebar.appendChild(back);
      titlebar.appendChild(title);
      titlebar.appendChild(badge);

      var body = dom.el('div', { class: 'bench-body' });
      var stage = dom.el('div', { class: 'bench-stage', id: 'module-root' });
      var readout = dom.el('aside', { class: 'bench-readout', id: 'bench-readout', 'aria-live': 'polite' });
      readout.innerHTML =
        '<div class="readout-title"><span>数据</span><span>DATA</span></div>' +
        '<div class="module-note">正在等待信号…</div>';
      body.appendChild(stage);
      body.appendChild(readout);

      host.appendChild(titlebar);
      host.appendChild(body);
      host.scrollTop = 0;

      document.title = module.name + ' · SENSORCRAFT';
      SC.ui.hud.setMode('BENCH:' + module.id);
    },

    clear: function () {
      var host = document.getElementById('bench-view');
      if (!host) return;
      host.hidden = true;
      dom.clear(host);
      document.title = BASE_TITLE;
      SC.ui.hud.setMode('BAG');
    }
  });
})(window.SC = window.SC || {});
