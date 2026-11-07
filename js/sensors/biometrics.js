/* Face ID / Touch ID 边界说明 + 平台认证器可用性检测；网页永远拿不到生物特征数据。 */
(function (SC) {
  'use strict';

  SC.registerSensor({
    id: 'biometrics',
    name: 'Face ID / Touch ID',
    en: 'BIOMETRICS',
    group: '计算与身份',
    icon: 'biometrics',
    probe: function () {
      return {
        status: 'info',
        reason: '网页拿不到脸或指纹数据；只能借助系统登录流程做认证。'
      };
    },
    mount: function (ctx) {
      ctx.root.innerHTML =
        '<div class="module module-biometrics">' +
        '<div class="info-panel">' +
        '<div class="info-head"><div class="info-icon">' +
        SC.ui.icons.biometrics +
        '</div><div><h3>村民交易台</h3><p>Face ID / Touch ID 在网页里的真实边界</p></div></div>' +
        '<p class="module-note">浏览器不会把脸、指纹或 Secure Enclave 里的模板交给 JavaScript。网页能做的只有：调用系统认证流程，拿到一个「通过 / 不通过」的结果。</p>' +
        '<div class="readout-grid">' +
        '<div class="readout-cell"><span class="cell-label">读取生物数据</span><span class="cell-value warn-text">不可能</span></div>' +
        '<div class="readout-cell"><span class="cell-label">系统登录认证</span><span class="cell-value ok-text">可用（需 WebAuthn）</span></div>' +
        '<div class="readout-cell"><span class="cell-label">识别结果</span><span class="cell-value">只有成功/失败</span></div>' +
        '<div class="readout-cell"><span class="cell-label">后端要求</span><span class="cell-value">需要服务器</span></div>' +
        '</div>' +
        '<div class="reason-box"><strong>为什么不能读？</strong> 生物特征属于系统安全区。网页只能请求「验证一下这个人」，不能请求「把脸的数据给我」。这是设计上的隔离，不是权限没开。</div>' +
        '<ul class="alt-list">' +
        '<li>可以做：网站登录、支付确认、二次验证（WebAuthn / Passkeys）。</li>' +
        '<li>不可以做：读取指纹图像、读取 Face ID 深度图、做本地人脸识别。</li>' +
        '<li>替代方案：如果要采集人脸做实验，用摄像头模块，但不要做身份认证或医疗判断。</li>' +
        '</ul>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn" type="button" id="bio-more">查看 WebAuthn 说明</button>' +
        '<button class="mc-btn primary" type="button" id="bio-check">检测平台认证器</button>' +
        '</div>' +
        '<div class="module-note" id="bio-extra" hidden>WebAuthn 是浏览器标准：网站生成挑战，系统弹出 Face ID/Touch ID，成功后返回签名公钥凭证。网页本身仍然拿不到生物模板。</div>' +
        '</div></div>';

      ctx.setReadout(
        '<div class="readout-title"><span>村民交易台</span><span>VILLAGER</span></div>' +
          '<div class="readout-row"><span class="readout-label">生物数据</span><span class="readout-value warn-text">不可读取</span></div>' +
          '<div class="readout-row"><span class="readout-label">系统认证</span><span class="readout-value">WebAuthn</span></div>' +
          '<div class="readout-row"><span class="readout-label">平台</span><span class="readout-value">iOS Secure Enclave</span></div>' +
          '<div class="readout-row"><span class="readout-label">平台认证器</span><span class="readout-value" id="bio-r-auth">未检测</span></div>' +
          '<div class="readout-row"><span class="readout-label">状态</span><span class="readout-value">信息卡</span></div>'
      );

      var more = ctx.root.querySelector('#bio-more');
      var extra = ctx.root.querySelector('#bio-extra');
      var checkBtn = ctx.root.querySelector('#bio-check');
      var seen = false;
      more.addEventListener('click', function () {
        extra.hidden = !extra.hidden;
        more.textContent = extra.hidden ? '查看 WebAuthn 说明' : '收起说明';
        if (!seen) {
          seen = true;
          ctx.toast({ icon: 'biometrics', title: '成就达成！', subtitle: '交易达成：读完生物识别边界' });
        }
      });

      checkBtn.addEventListener('click', async function () {
        var target = ctx.readout.querySelector('#bio-r-auth');
        checkBtn.disabled = true;
        checkBtn.textContent = '检测中…';
        if (!window.PublicKeyCredential) {
          if (target) target.textContent = '不支持 WebAuthn';
          checkBtn.disabled = false;
          checkBtn.textContent = '检测平台认证器';
          return;
        }
        try {
          var available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (target) target.textContent = available ? '可用（Face ID/Touch ID）' : '不可用';
          ctx.toast({
            icon: 'biometrics',
            title: available ? '平台认证器可用' : '平台认证器不可用',
            subtitle: available ? '可以用 WebAuthn 做系统登录验证' : '浏览器或设备未开放平台认证器'
          });
          SC.core.log.add('平台认证器：' + (available ? '可用' : '不可用'));
        } catch (error) {
          if (target) target.textContent = '检测失败';
          ctx.toast({ icon: 'barrier', title: '检测失败', subtitle: error && error.message ? error.message : '未知错误' });
        }
        checkBtn.disabled = false;
        checkBtn.textContent = '重新检测';
      });

      ctx.setStatus('INFO', 'info');
    }
  });
})(window.SC = window.SC || {});
