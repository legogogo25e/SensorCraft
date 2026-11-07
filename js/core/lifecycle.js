/* 工作台生命周期：打开/关闭模块、维护浏览器历史、清理上一个模块、恢复卡片焦点。 */
(function (SC) {
  'use strict';
  var lifecycle = (SC.core.lifecycle = {
    current: null,
    ctx: null,
    open: function (id, mode) {
      var module = SC.core.registry.get(id);
      if (!module) {
        SC.core.log.add('没有找到模块：' + id);
        return;
      }
      lifecycle.cleanupCurrent();
      var status = SC.core.probe.get(id);
      SC.ui.bench.render(module, status);
      var ctx = SC.core.createContext(module);
      lifecycle.ctx = ctx;
      lifecycle.current = module;

      // 先清理上一个模块，再挂载新模块；mount 抛错时只影响当前工作台。
      try {
        var result = module.mount(ctx);
        if (typeof result === 'function') ctx.onCleanup(result);
      } catch (error) {
        ctx.showError(error);
      }

      // 卡片点击 push 历史；popstate 回放时 mode='none'，避免重复入栈。
      var historyMode = mode || 'push';
      if (historyMode === 'push') {
        history.pushState({ view: 'sensor', id: id }, '', '#' + id);
      } else if (historyMode === 'replace') {
        history.replaceState({ view: 'sensor', id: id }, '', '#' + id);
      } else if (mode === 'none') {
        /* popstate already changed the URL */
      }

      document.body.classList.add('bench-open');
      SC.core.log.add('打开：' + module.name);
    },
    cleanupCurrent: function () {
      if (lifecycle.ctx) {
        lifecycle.ctx.cleanup();
        lifecycle.ctx = null;
      }
    },
    close: function (options) {
      var opts = options || {};
      var previous = lifecycle.current;
      lifecycle.cleanupCurrent();
      lifecycle.current = null;
      SC.ui.bench.clear();
      document.body.classList.remove('bench-open');

      if (!opts.fromHistory) {
        history.replaceState({ view: 'bag' }, '', location.pathname + location.search);
      }

      SC.ui.bag.render();
      if (previous) SC.ui.bag.focusCard(previous.id);
    },
    handlePopState: function (state) {
      if (state && state.view === 'sensor' && state.id) {
        lifecycle.open(state.id, 'none');
      } else {
        lifecycle.close({ fromHistory: true });
      }
    },
    init: function () {
      var hash = location.hash.replace(/^#/, '');
      history.replaceState({ view: 'bag' }, '', location.pathname + location.search);
      if (hash && SC.core.registry.get(hash)) {
        lifecycle.open(hash, 'push');
      }
      window.addEventListener('popstate', function (event) {
        lifecycle.handlePopState(event.state);
      });
      window.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && lifecycle.current) {
          event.preventDefault();
          if (history.length > 1) history.back();
          else lifecycle.close();
        }
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && SC.ui.hud) {
          SC.ui.hud.updateF3();
        }
      });
    }
  });
})(window.SC = window.SC || {});
