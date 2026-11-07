/* 成就/提示 toast 队列，同一时刻只显示一条，避免遮挡返回按钮。 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;
  var toast = (SC.ui.toast = {
    queue: [],
    showing: false,
    recent: {},
    show: function (options) {
      if (!options) return;
      var title = options.title || '成就达成！';
      var now = Date.now();
      if (toast.recent[title] && now - toast.recent[title] < 4000) return;
      toast.recent[title] = now;
      toast.queue.push(options);
      toast.drain();
    },
    drain: function () {
      if (toast.showing || !toast.queue.length) return;
      var stack = document.getElementById('toast-stack');
      if (!stack) return;
      var options = toast.queue.shift();
      var iconName = options.icon || 'pickaxe';
      var iconSvg = (SC.ui.icons && SC.ui.icons[iconName]) || (SC.ui.icons && SC.ui.icons.pickaxe) || '';

      var item = dom.el('div', { class: 'toast-item', role: 'status' });
      var icon = dom.el('div', { class: 'toast-icon', html: iconSvg });
      var text = dom.el('div', { class: 'toast-text' });
      text.appendChild(dom.el('div', { class: 'toast-title', text: options.title || '成就达成！' }));
      if (options.subtitle) {
        text.appendChild(dom.el('div', { class: 'toast-sub', text: options.subtitle }));
      }
      item.appendChild(icon);
      item.appendChild(text);
      stack.appendChild(item);
      toast.showing = true;

      setTimeout(function () {
        item.classList.add('is-out');
        setTimeout(function () {
          if (item.parentNode) item.parentNode.removeChild(item);
          toast.showing = false;
          toast.drain();
        }, 180);
      }, options.duration || SC.config.toastMs || 3000);
    }
  });
})(window.SC = window.SC || {});
