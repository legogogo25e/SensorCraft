/* 传感器注册表。新增卡片只需调用 SC.registerSensor({ id, probe, mount })，UI 会自动出现。 */
(function (SC) {
  'use strict';
  var registry = (SC.core.registry = {
    items: [],
    register: function (module) {
      if (!module || !module.id || !module.name) {
        throw new Error('registerSensor 需要 id 与 name');
      }
      if (registry.get(module.id)) {
        throw new Error('重复的传感器 id：' + module.id);
      }
      if (typeof module.mount !== 'function') {
        throw new Error('传感器 ' + module.id + ' 缺少 mount()');
      }
      module.group = module.group || '未解锁图鉴';
      module.icon = module.icon || 'barrier';
      module.en = module.en || module.id.toUpperCase();
      registry.items.push(module);
      return module;
    },
    all: function () {
      return registry.items.slice();
    },
    get: function (id) {
      for (var i = 0; i < registry.items.length; i += 1) {
        if (registry.items[i].id === id) return registry.items[i];
      }
      return null;
    },
    grouped: function () {
      var groups = SC.groups.slice();
      registry.items.forEach(function (item) {
        if (groups.indexOf(item.group) < 0) groups.push(item.group);
      });
      return groups
        .map(function (name) {
          return {
            name: name,
            items: registry.items.filter(function (item) {
              return item.group === name;
            })
          };
        })
        .filter(function (group) {
          return group.items.length > 0;
        });
    }
  });

  SC.registerSensor = function (module) {
    return registry.register(module);
  };
})(window.SC = window.SC || {});
