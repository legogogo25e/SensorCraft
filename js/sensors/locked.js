/* 6 张未解锁卡：解释为什么拿不到、替代方案，并可直接打开可用的替代卡片。 */
(function (SC) {
  'use strict';

  var LOCKED = [
    {
      id: 'magnetometer',
      name: '磁力计原始数据',
      en: 'MAGNETOMETER',
      icon: 'magnet',
      alternative: 'orientation',
      reason: '网页只能通过姿态事件拿到算好的方向，拿不到原始三轴磁场数据。',
      alternatives: ['用「姿态与指南针」卡片看方向。', '用手机原生传感器 App 看原始磁场。']
    },
    {
      id: 'barometer',
      name: '气压计',
      en: 'BAROMETER',
      icon: 'barometer',
      alternative: 'geolocation',
      reason: '网页没有气压计 API，无法读取气压或用它计算楼层。',
      alternatives: ['用 GPS 卡片看海拔（精度较低）。', '用天气 API 或原生 App。']
    },
    {
      id: 'proximity',
      name: '距离传感器',
      en: 'PROXIMITY',
      icon: 'proximity',
      alternative: 'camera',
      reason: '打电话贴脸用的距离传感器没有网页 API。',
      alternatives: ['用摄像头做颜色/光照实验。', '用外接超声波或 ToF 传感器。']
    },
    {
      id: 'lidar',
      name: 'LiDAR / 原深感',
      en: 'LIDAR',
      icon: 'lidar',
      alternative: 'camera',
      reason: '网页拿不到 LiDAR 或原深感摄像头的深度图。',
      alternatives: ['用原生 App 与 ARKit。', '用双摄/视差做非常粗略的测距实验，不保证准确。']
    },
    {
      id: 'healthkit',
      name: 'HealthKit / 步数',
      en: 'HEALTHKIT',
      icon: 'heart',
      alternative: 'accelerometer',
      reason: '健康数据存在系统健康服务里（iOS 叫 HealthKit，Android 叫 Health Connect），需要原生 App 和用户授权，网页拿不到。',
      alternatives: ['用加速度计卡片做近似计步。', '用系统「健康」App 或手表的数据。']
    },
    {
      id: 'background',
      name: '后台运行',
      en: 'BACKGROUND',
      icon: 'moon',
      alternative: 'wakelock',
      reason: 'iOS 上的 PWA 在锁屏或切到后台后不能持续采集传感器。',
      alternatives: ['用「屏幕常亮」保持前台。', '分段记录，回到页面后继续。']
    }
  ];

  LOCKED.forEach(function (item) {
    SC.registerSensor({
      id: item.id,
      name: item.name,
      en: item.en,
      group: '未解锁图鉴',
      icon: item.icon,
      probe: function () {
        return { status: 'locked', reason: item.reason };
      },
      mount: function (ctx) {
        var altModule = item.alternative ? SC.core.registry.get(item.alternative) : null;
        ctx.root.innerHTML =
          '<div class="module module-locked">' +
          '<div class="locked-panel">' +
          '<div class="locked-head"><div class="locked-icon">' +
          SC.ui.icons.barrier +
          '</div><div><h3>' +
          item.name +
          '</h3><p>' +
          item.en +
          ' · LOCKED</p></div></div>' +
          '<div class="reason-box"><strong>为什么拿不到：</strong> ' +
          item.reason +
          '</div>' +
          '<div><div class="readout-title"><span>可以怎么绕过去</span><span>ALTERNATIVES</span></div>' +
          '<ul class="alt-list">' +
          item.alternatives
            .map(function (text) {
              return '<li>' + text + '</li>';
            })
            .join('') +
          '</ul></div>' +
          '<p class="module-note">这不是权限没开，而是浏览器/系统没有提供这个 API。返回背包，试试可用的替代卡片。</p>' +
          '</div></div>';

        ctx.setReadout(
          '<div class="readout-title"><span>未解锁图鉴</span><span>LOCKED CODEX</span></div>' +
            '<div class="readout-row"><span class="readout-label">卡片</span><span class="readout-value">' +
            item.name +
            '</span></div>' +
            '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">LOCKED</span></div>' +
            '<div class="readout-row"><span class="readout-label">替代方案</span><span class="readout-value">' +
            item.alternatives.length +
            ' 条</span></div>' +
            '<div class="readout-row"><span class="readout-label">替代卡片</span><span class="readout-value">' +
            (altModule ? altModule.name : '无') +
            '</span></div>' +
            '<div class="readout-row"><span class="readout-label">原因</span><span class="readout-value">浏览器 / 系统未提供该 API</span></div>'
        );
        if (altModule) {
          var toolbar = document.createElement('div');
          toolbar.className = 'module-toolbar';
          var altBtn = document.createElement('button');
          altBtn.type = 'button';
          altBtn.className = 'mc-btn primary';
          altBtn.textContent = '打开替代卡片：' + altModule.name;
          altBtn.addEventListener('click', function () {
            SC.core.lifecycle.open(item.alternative);
          });
          toolbar.appendChild(altBtn);
          var panel = ctx.root.querySelector('.locked-panel');
          if (panel) panel.appendChild(toolbar);
        }
        ctx.setStatus('LOCKED', 'locked');
        SC.core.log.add('查看锁定卡：' + item.name);
      }
    });
  });
})(window.SC = window.SC || {});
