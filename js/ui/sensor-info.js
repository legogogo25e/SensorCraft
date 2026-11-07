/* 传感器说明弹窗：每张卡片一份学生向教学卡（原理 / 用途 / 数据结构 / 配图）。
 * 内容在 js/ui/sensor-info-data.js（SC.core.sensorInfoData），这里只负责渲染与开关。
 * 弹窗盖在工作台之上，不推历史、不停掉背后的卡片；Esc / 点遮罩 / 点 ✕ 都关闭，
 * Esc 要先拦住（capture + stopImmediatePropagation），否则 lifecycle 的 Esc
 * 处理会把整个工作台也关掉。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var host = null;
  var opener = null;
  var openId = null;

  function getHost() {
    if (!host) host = document.getElementById('sensor-info');
    return host;
  }

  function getData(id) {
    var all = SC.core.sensorInfoData || {};
    return all[id] || null;
  }

  function section(title, en) {
    var sec = dom.el('section', { class: 'info-section' });
    var h = dom.el('h3');
    h.appendChild(document.createTextNode(title));
    h.appendChild(dom.el('span', { class: 'info-sec-en', text: ' ' + en }));
    sec.appendChild(h);
    return sec;
  }

  function buildPanel(module, data) {
    var iconSvg = (SC.ui.icons && SC.ui.icons[module.icon]) || (SC.ui.icons && SC.ui.icons.barrier) || '';

    var panel = dom.el('div', { class: 'info-panel', role: 'document' });

    var head = dom.el('div', { class: 'info-head' });
    head.appendChild(dom.el('span', { class: 'info-head-icon', html: iconSvg }));
    var headText = dom.el('div', { class: 'info-head-text' });
    headText.appendChild(dom.el('h2', { text: module.name + ' 是什么？' }));
    headText.appendChild(dom.el('div', { class: 'info-head-en', text: module.en }));
    head.appendChild(headText);
    var closeBtn = dom.el('button', {
      class: 'mc-btn tiny info-close',
      type: 'button',
      text: '✕ 关闭',
      'aria-label': '关闭说明'
    });
    closeBtn.addEventListener('click', function () {
      sensorInfo.close();
    });
    head.appendChild(closeBtn);
    panel.appendChild(head);

    panel.appendChild(dom.el('p', { class: 'info-intro', text: data.intro }));

    if (data.diagram) {
      var fig = dom.el('figure', { class: 'info-diagram' });
      fig.innerHTML = data.diagram;
      panel.appendChild(fig);
    }

    var pr = section('原理', 'HOW IT WORKS');
    (data.principle || []).forEach(function (para) {
      pr.appendChild(dom.el('p', { text: para }));
    });
    panel.appendChild(pr);

    var us = section('用途', 'WHAT IT IS FOR');
    var list = dom.el('ul', { class: 'info-uses' });
    (data.uses || []).forEach(function (item) {
      list.appendChild(dom.el('li', { text: item }));
    });
    us.appendChild(list);
    panel.appendChild(us);

    var ds = section('数据结构', 'DATA');
    var table = dom.el('table', { class: 'info-data' });
    var thead = dom.el('thead');
    var tr = dom.el('tr');
    ['字段', '单位', '含义', '例子'].forEach(function (label) {
      tr.appendChild(dom.el('th', { text: label }));
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = dom.el('tbody');
    (data.data || []).forEach(function (row) {
      var r = dom.el('tr');
      r.appendChild(dom.el('td', { text: row.field }));
      r.appendChild(dom.el('td', { text: row.unit || '—' }));
      r.appendChild(dom.el('td', { text: row.meaning }));
      r.appendChild(dom.el('td', { text: row.example }));
      tbody.appendChild(r);
    });
    table.appendChild(tbody);
    ds.appendChild(table);
    ds.appendChild(
      dom.el('p', {
        class: 'module-note',
        text: '上面是这张卡实际输出的数据：字段名和单位与卡片右侧「数据」栏一致，例子是真实会出现的值。'
      })
    );
    panel.appendChild(ds);

    if (data.note) {
      var noteBox = dom.el('div', { class: 'info-note' });
      noteBox.appendChild(dom.el('strong', { text: '为什么网页拿不到：' }));
      noteBox.appendChild(document.createTextNode(data.note));
      panel.appendChild(noteBox);
    }

    if (data.tryIt) {
      var tryBox = dom.el('div', { class: 'info-try' });
      tryBox.appendChild(dom.el('strong', { text: '试一试：' }));
      tryBox.appendChild(document.createTextNode(data.tryIt));
      panel.appendChild(tryBox);
    }

    panel.appendChild(
      dom.el('p', {
        class: 'module-note info-foot',
        text: '说明里的数字是一般情况，具体以本卡实测为准。测量数据只在本机运算，不上传。'
      })
    );
    return panel;
  }

  var sensorInfo = (SC.ui.sensorInfo = {
    isOpen: function () {
      return openId !== null;
    },

    open: function (id) {
      var module = SC.core.registry.get(id);
      var data = getData(id);
      var hostEl = getHost();
      if (!module || !data || !hostEl) return false;
      opener = document.activeElement;
      openId = id;
      dom.clear(hostEl);
      var overlay = dom.el('div', { class: 'info-overlay' });
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) sensorInfo.close();
      });
      overlay.appendChild(buildPanel(module, data));
      hostEl.appendChild(overlay);
      hostEl.hidden = false;
      var closeBtn = hostEl.querySelector('.info-close');
      if (closeBtn) closeBtn.focus();
      SC.core.log.add('查看说明：' + module.name);
      return true;
    },

    close: function () {
      var hostEl = getHost();
      if (!hostEl || openId === null) return;
      openId = null;
      hostEl.hidden = true;
      dom.clear(hostEl);
      if (opener && document.contains(opener)) {
        try {
          opener.focus();
        } catch (ignored) {}
      }
      opener = null;
    }
  });

  /* Esc 关闭说明（capture 阶段先拦住，免得 lifecycle 把工作台也关了）。 */
  window.addEventListener(
    'keydown',
    function (event) {
      if (event.key === 'Escape' && sensorInfo.isOpen()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        sensorInfo.close();
      }
    },
    true
  );
})(window.SC = window.SC || {});
