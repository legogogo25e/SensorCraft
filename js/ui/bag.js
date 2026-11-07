/* 背包视图：按分组渲染物品槽卡片；锁定卡也保留可点击说明，并用空槽补齐网格。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var SPLASH = [
    '26 种传感器，等你解锁！',
    '先校准，再冒险',
    '别用 TNT 测心率',
    'iPhone 也能当地震仪',
    '红石信号已接通',
    '对着麦克风喊一声',
    '一格一格地探索',
    '这不是普通的网页'
  ];

  var STATUS = {
    ready: { label: 'READY', cls: '' },
    partial: { label: 'LIMIT', cls: 'partial' },
    locked: { label: 'LOCKED', cls: 'locked' },
    info: { label: 'INFO', cls: 'info' }
  };

  var bag = (SC.ui.bag = {
    render: function (summary) {
      var host = document.getElementById('bag-view');
      if (!host) return;
      dom.clear(host);
      var counts = summary || SC.core.probe.summary();
      var groups = SC.core.registry.grouped();

      var inv = dom.el('div', { class: 'inventory', role: 'region', 'aria-label': '传感器背包' });

      var titlebar = dom.el('div', { class: 'inv-titlebar' });
      var title = dom.el('div', { class: 'inv-title' });
      title.appendChild(dom.el('div', { class: 'inv-title-icon', html: SC.ui.icons.logo }));
      var titleText = dom.el('div');
      var h1 = dom.el('h1');
      h1.appendChild(document.createTextNode('SENSORCRAFT'));
      h1.appendChild(dom.el('span', { class: 'splash', text: SPLASH[Math.floor(Math.random() * SPLASH.length)] }));
      titleText.appendChild(h1);
      titleText.appendChild(
        dom.el('div', { class: 'inv-sub', text: 'iPhone 传感器实验室 · 点开物品槽开始实验' })
      );
      title.appendChild(titleText);

      var meta = dom.el('div', { class: 'inv-meta' });
      meta.appendChild(dom.el('div', { text: counts.ready + ' READY' }));
      meta.appendChild(dom.el('div', { text: counts.partial + ' LIMITED' }));
      meta.appendChild(dom.el('div', { text: counts.total + ' TOTAL' }));
      titlebar.appendChild(title);
      titlebar.appendChild(meta);

      var body = dom.el('div', { class: 'inv-body' });
      groups.forEach(function (group) {
        body.appendChild(bag.renderGroup(group));
      });

      var footer = dom.el('div', { class: 'inv-footer' });
      footer.appendChild(dom.el('span', { text: '点击物品槽 → 打开工作台' }));
      footer.appendChild(dom.el('span', { text: 'v' + SC.version + ' · monospace of the world' }));

      inv.appendChild(titlebar);
      inv.appendChild(body);
      inv.appendChild(footer);
      host.appendChild(inv);

      SC.ui.hud.setXp((counts.ready / Math.max(1, counts.total)) * 100, 'Lv.' + counts.ready + ' 探索者');
    },

    renderGroup: function (group) {
      var section = dom.el('section', { class: 'group' });
      var meta = SC.groupMeta[group.name] || { label: group.name };
      var heading = dom.el('h2', { class: 'group-title' });
      heading.appendChild(document.createTextNode(group.name));
      heading.appendChild(dom.el('span', { class: 'tag', text: meta.label || '' }));
      section.appendChild(heading);

      if (group.name === '未解锁图鉴') {
        section.appendChild(
          dom.el('p', {
            class: 'group-note',
            text: '这些能力在 iPhone Safari 里拿不到。点开卡片，看看为什么，以及可以怎么绕过去。'
          })
        );
      }

      var grid = dom.el('div', { class: 'slot-grid' });
      group.items.forEach(function (item) {
        grid.appendChild(bag.renderCard(item));
      });
      var padded = Math.ceil(group.items.length / 8) * 8;
      for (var i = group.items.length; i < padded; i += 1) {
        var empty = dom.el('span', { class: 'slot is-empty', 'aria-hidden': 'true' });
        empty.appendChild(dom.el('span', { class: 'slot-box' }));
        empty.appendChild(dom.el('span', { class: 'slot-name', text: '\u00a0' }));
        grid.appendChild(empty);
      }
      section.appendChild(grid);
      return section;
    },

    renderCard: function (item) {
      var status = SC.core.probe.get(item.id);
      var statusMeta = STATUS[status.status] || STATUS.locked;
      var isLocked = status.status === 'locked';
      var iconSvg = (SC.ui.icons && SC.ui.icons[item.icon]) || (SC.ui.icons && SC.ui.icons.barrier) || '';

      var tipParts = [item.name + ' · ' + statusMeta.label];
      if (status.reason) tipParts.push(status.reason);
      else if (status.status === 'ready') tipParts.push('点击打开工作台');
      else if (status.status === 'info') tipParts.push('点击查看说明');

      var card = dom.el('button', {
        class: 'slot' + (isLocked ? ' is-locked' : ''),
        type: 'button',
        'data-id': item.id,
        'data-tip': tipParts.join(' · '),
        'aria-label': item.name + '，状态 ' + statusMeta.label + '。' + (status.reason || '点击打开')
      });

      var box = dom.el('span', { class: 'slot-box' });
      box.appendChild(dom.el('span', { class: 'slot-icon', html: iconSvg }));
      box.appendChild(
        dom.el('span', {
          class: 'slot-badge ' + statusMeta.cls,
          text: statusMeta.label
        })
      );
      card.appendChild(box);
      card.appendChild(dom.el('span', { class: 'slot-name', text: item.name }));

      card.addEventListener('click', function () {
        SC.core.lifecycle.open(item.id);
      });
      return card;
    },

    focusCard: function (id) {
      var card = document.querySelector('.slot[data-id="' + id + '"]');
      if (card) card.focus({ preventScroll: false });
    }
  });
})(window.SC = window.SC || {});
