/* 反应时间：jsPsych 8.3.0 流程编排 + 自订插件计时。
 *
 * 任务（按 2026-11-07 Perplexity 多轮研究结论）：
 * - 3 次练习 + 15 次计分，约 45–75 秒；每次点按后都会显示当次
 *   反应时间（练习 900ms、计分 700ms），结果列出全部 18 次
 *   （练习 + 计分，含作废原因），可复制文本或导出 JSON；
 *   汇总（中位、四分位距等）只用计分有效试，不设年龄百分位、
 *   不贴损伤标签。
 * - 颜色目标就是主窗口：点「开始」后提示文字收起，目标滚动到
 *   屏幕中央，整个测试都在同一张卡片内完成，不开新窗口、新标签。
 * - 关键坑：jsPsych 的 prepareDom() 不会直接用你给的 display
 *   element 渲染试次，而是在它里面再 append 一个
 *   #jspsych-content  div，试次渲染在那个新 div 里。所以挂载时
 *   放在 #rt-display 里的待开始占位框，必须在 initJsPsych 之前
 *   清掉，否则测试一跑就会同时出现两个框（上面一个暗色待开始框、
 *   下面一个绿色试次框），正是 2026-11-07 用户截图报的 bug。
 *   跑完后把占位框写回去，免得两次测试之间留一个空框。
 * - 计时端点是目标上的 pointerdown，时间戳用 performance.now()，
 *   不用按钮 click（click 有额外延迟）也不用键盘。
 * - 刺激出现时刻用 requestAnimationFrame 回调的时间戳定锚：
 *   前置期结束时只立一个旗，下一帧回调里才翻绿并记录 onset，
 *   这样 onset 就是画面真正翻绿的那一帧。
 * - 作废规则（符合其一即该试无效，不计入中位）：
 *   1) 刺激前点按（抢先）；2) 刺激后 2 秒无反应（超时）；
 *   3) 刺激出现前后帧间隔 > 100ms（画面卡顿，onset 不可信）；
 *   4) 试中切后台 / 锁屏（visibilitychange）。
 * - 15 次计分里有效 < 12 次 → 没有可比分数，只报失败原因。
 *
 * jsPsych 的角色只是流程编排（时间线、数据收集、on_finish）：
 * - 版本固定 jspsych@8.3.0，不用 @latest。UMD 浏览器构建
 *   index.browser.min.js（79,826 字节，MIT）已本地托管在
 *   js/vendor/jspsych-8.3.0/，随 index.html 的 <script> 加载，
 *   不走 CDN；jsPsych 的 CSS 不用，界面用本项目自己的样式。
 * - 自订插件 SensorCraftReactionPlugin（class，static info，
 *   trial(display_element, trial)，结束时调 finishTrial(data)），
 *   是 jsPsych 8 官方插件 API；已在 Node vm 沙箱里实测跑通
 *   initJsPsych → run → finishTrial → data.get() 全流程。
 * - 超时统一用 jsPsych.pluginAPI.setTimeout，试结束自动清除；
 *   插件自己的 rAF 循环和监听器在 finish 时手动清理。
 * - 离开卡片时调 jsPsych.abortExperiment() 中断当前试并停掉
 *   时间线，on_finish 里用 ctx.isActive() 守住不渲染已卸载的卡。
 *
 * 免责（研究给的原文，卡内全文展示）：This task measures your
 * performance on this phone, not brain health or fitness to drive.
 * Display and touch delays, practice, fatigue and distraction affect
 * the result. It cannot diagnose concussion, dementia, ADHD or another
 * condition. Compare results only under similar conditions on the same
 * device.
 */
(function (SC) {
  'use strict';
  var dom = SC.core.dom;

  var PRACTICE_TRIALS = 3;
  var SCORED_TRIALS = 15;
  var MIN_VALID_SCORED = 12;
  var FOREPERIOD_MIN_MS = 1200;
  var FOREPERIOD_MAX_MS = 2800;
  var RESPONSE_TIMEOUT_MS = 2000;
  var FRAME_STALL_MS = 100;
  var PRACTICE_FEEDBACK_MS = 900;
  var SCORED_FEEDBACK_MS = 700;

  var DISCLAIMER_EN = 'This task measures your performance on this phone, not brain health or fitness to drive. Display and touch delays, practice, fatigue and distraction affect the result. It cannot diagnose concussion, dementia, ADHD or another condition. Compare results only under similar conditions on the same device.';
  var NO_SCORE_EN = 'No comparable score. The session was interrupted or contained too few valid trials. Your trial results were not scored.';

  /* 待开始占位框：只在未开始 / 已完成时显示，initJsPsych 之前必须清掉
     （见文件头 jsPsych prepareDom 的坑），否则会和试次框同时出现。 */
  var IDLE_HTML =
    '<div class="reaction-target state-idle"><div class="reaction-target-text">按「开始」<br><span class="reaction-feedback-sub">3 次练习 + 15 次计分</span></div>' +
    '<div class="reaction-target-sub">待开始</div></div>';

  /* ---- 纯函数：中位 / 四分位 / 计分汇总（可单测，见文末测试钩子） ---- */
  function sortedCopy(values) {
    return values.slice().sort(function (a, b) { return a - b; });
  }

  function medianOf(values) {
    if (!values.length) return null;
    var s = sortedCopy(values);
    var mid = Math.floor(s.length / 2);
    if (s.length % 2) return s[mid];
    return (s[mid - 1] + s[mid]) / 2;
  }

  function quartilesOf(values) {
    if (!values.length) return { q1: null, median: null, q3: null };
    var s = sortedCopy(values);
    var median = medianOf(s);
    var lower = s.slice(0, Math.floor(s.length / 2));
    var upper = s.slice(Math.ceil(s.length / 2));
    return { q1: medianOf(lower), median: median, q3: medianOf(upper) };
  }

  function summarizeScored(trials) {
    var validRts = [];
    var counts = { anticipation: 0, timeout: 0, frameStall: 0, interrupted: 0 };
    trials.forEach(function (t) {
      if (t.valid && typeof t.rt === 'number') {
        validRts.push(t.rt);
      } else if (t.reason === 'anticipation') {
        counts.anticipation += 1;
      } else if (t.reason === 'timeout') {
        counts.timeout += 1;
      } else if (t.reason === 'frame-stall') {
        counts.frameStall += 1;
      } else if (t.reason === 'interrupted') {
        counts.interrupted += 1;
      }
    });
    var q = quartilesOf(validRts);
    return {
      total: trials.length,
      valid: validRts.length,
      anticipations: counts.anticipation,
      timeouts: counts.timeout,
      frameStalls: counts.frameStall,
      interrupted: counts.interrupted,
      median: q.median,
      q1: q.q1,
      q3: q.q3,
      min: validRts.length ? Math.min.apply(null, validRts) : null,
      max: validRts.length ? Math.max.apply(null, validRts) : null,
      comparable: validRts.length >= MIN_VALID_SCORED
    };
  }

  /* ---- 自订 jsPsych 插件：一次反应时试次 ---- */
  function SensorCraftReactionPlugin(jsPsych) {
    this.jsPsych = jsPsych;
  }
  SensorCraftReactionPlugin.info = {
    name: 'sensorcraft-reaction',
    version: '1.0.0',
    parameters: {
      phase: { type: 1, default: 'scored' }, // 1 = ParameterType.STRING
      index: { type: 2, default: 0 }, // 2 = ParameterType.INT
      total: { type: 2, default: 15 }, // 2 = ParameterType.INT
      feedback: { type: 0, default: false } // 0 = ParameterType.BOOL
    },
    data: {}
  };
  SensorCraftReactionPlugin.prototype.trial = function (display_element, trial) {
    var self = this;
    var jsPsych = this.jsPsych;
    var done = false;
    var state = 'waiting'; // waiting | go | done
    var onset = null;
    var stalled = false;
    var foreperiod = Math.round(FOREPERIOD_MIN_MS + Math.random() * (FOREPERIOD_MAX_MS - FOREPERIOD_MIN_MS));
    var rafId = 0;
    var prevFrameTime = null;
    var onsetFrameTime = null;
    var pendingStimulus = false;
    var target = null;

    function label() {
      return (trial.phase === 'practice' ? '练习 ' : '计分 ') + (trial.index + 1) + ' / ' + trial.total;
    }

    function render() {
      display_element.innerHTML =
        '<div class="reaction-target state-' + state + '" id="rt-target" role="button" tabindex="0" aria-label="反应目标">' +
        '<div class="reaction-target-text" id="rt-target-text">' + targetText() + '</div>' +
        '<div class="reaction-target-sub">' + label() + '</div>' +
        '</div>';
      target = display_element.querySelector('#rt-target');
      if (target) target.addEventListener('pointerdown', onPointerDown);
    }

    function targetText() {
      if (state === 'waiting') return '等变绿…';
      if (state === 'go') return '点！';
      return '…';
    }

    function setState(next) {
      state = next;
      var text = display_element.querySelector('#rt-target-text');
      if (text) text.textContent = targetText();
      if (target) target.className = 'reaction-target state-' + state;
    }

    function showFeedback(html) {
      setState('done');
      var text = display_element.querySelector('#rt-target-text');
      if (text) text.innerHTML = html;
      if (target) target.className = 'reaction-target state-feedback';
    }

    function finish(data) {
      if (done) return;
      done = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (target) target.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
      data.phase = trial.phase;
      data.index = trial.index;
      data.foreperiod_ms = foreperiod;
      data.stalled = stalled;
      jsPsych.finishTrial(data);
    }

    function finishWithFeedback(data, feedbackHtml) {
      /* 每次都显示当次结果再进下一试：点按后显示毫秒数，抢先 / 超时 /
         卡顿显示原因；练习停 900ms、计分停 700ms。 */
      if (feedbackHtml) {
        showFeedback(feedbackHtml);
        var fbMs = trial.phase === 'practice' ? PRACTICE_FEEDBACK_MS : SCORED_FEEDBACK_MS;
        jsPsych.pluginAPI.setTimeout(function () { finish(data); }, fbMs);
      } else {
        finish(data);
      }
    }

    function onPointerDown() {
      if (done) return;
      if (state === 'waiting') {
        finishWithFeedback(
          { valid: false, reason: 'anticipation', rt: null },
          '太早了！<br><span class="reaction-feedback-sub">等变绿再点</span>'
        );
        return;
      }
      if (state === 'go') {
        var rt = Math.round(performance.now() - onset);
        if (stalled) {
          finishWithFeedback(
            { valid: false, reason: 'frame-stall', rt: rt },
            '这一试作废<br><span class="reaction-feedback-sub">画面卡顿，不计入结果</span>'
          );
        } else {
          finishWithFeedback(
            { valid: true, reason: null, rt: rt },
            rt + ' ms'
          );
        }
      }
    }

    function onVisibility() {
      if (done) return;
      if (document.visibilityState === 'hidden') {
        finish({ valid: false, reason: 'interrupted', rt: null });
      }
    }

    function frameLoop(time) {
      if (done) return;
      if (pendingStimulus) {
        pendingStimulus = false;
        onset = time;
        onsetFrameTime = time;
        if (prevFrameTime !== null && time - prevFrameTime > FRAME_STALL_MS) stalled = true;
        setState('go');
        jsPsych.pluginAPI.setTimeout(function () {
          if (!done && state === 'go') {
            finishWithFeedback(
              { valid: false, reason: 'timeout', rt: null },
              '超时了<br><span class="reaction-feedback-sub">绿灯亮起 2 秒内没点到</span>'
            );
          }
        }, RESPONSE_TIMEOUT_MS);
      } else if (onsetFrameTime !== null && prevFrameTime !== null && onsetFrameTime > prevFrameTime) {
        /* 刺激帧之后的第一个回调：onset 到这一帧的间隔过大也算卡顿。 */
        if (time - onsetFrameTime > FRAME_STALL_MS) stalled = true;
        onsetFrameTime = null;
      }
      prevFrameTime = time;
      rafId = requestAnimationFrame(frameLoop);
    }

    document.addEventListener('visibilitychange', onVisibility);
    render();
    rafId = requestAnimationFrame(frameLoop);
    jsPsych.pluginAPI.setTimeout(function () {
      if (!done) pendingStimulus = true;
    }, foreperiod);
  };

  function readoutHtml(state) {
    return (
      '<div class="readout-title"><span>反应实验室</span><span>REACTION TIME</span></div>' +
      '<div class="readout-row"><span class="readout-label">阶段</span><span class="readout-value">' + state.phase + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">进度</span><span class="readout-value">' + state.progress + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">有效</span><span class="readout-value">' + state.valid + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">抢先</span><span class="readout-value">' + state.anticipations + '</span></div>' +
      '<div class="readout-row"><span class="readout-label">中位反应</span><span class="readout-value">' + state.median + '</span></div>' +
      '<div class="module-note">jsPsych 8.3.0 编排流程，本机运算，不上传。正式测试 15 次里有效满 12 次才有可比分数。</div>'
    );
  }

  SC.registerSensor({
    id: 'reaction-time',
    name: '反应时间',
    en: 'REACTION TIME',
    group: '生物医学',
    icon: 'touch',
    probe: function (feature) {
      if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
        return { status: 'locked', reason: '当前浏览器没有高精度计时器，测不了反应时间。' };
      }
      if (typeof window.PointerEvent === 'undefined' && typeof window.TouchEvent === 'undefined') {
        return { status: 'locked', reason: '当前浏览器不支持触屏点按事件。' };
      }
      return { status: 'ready' };
    },
    mount: function (ctx) {
      var state = {
        phase: '待开始',
        progress: '0 / 18',
        valid: 0,
        anticipations: 0,
        median: '--'
      };
      var jsPsych = null;
      var running = false;
      var completed = false;
      var firstDone = false;
      var lastSummary = null;
      var lastDataJson = null;
      var lastResultsText = null;

      ctx.root.innerHTML =
        '<div class="module module-reaction-time">' +
        '<p class="module-note" id="rt-intro"><strong>玩法：</strong>目标变绿立刻点按。先练 3 次，再正式测 15 次；每次点按后都会显示当次反应时间。正式测试里有效满 12 次才有可比分数；抢先、超时、画面卡顿、切后台都会让当次作废。</p>' +
        '<div id="rt-display" class="reaction-display">' +
        IDLE_HTML +
        '</div>' +
        '<div class="module-toolbar">' +
        '<button class="mc-btn primary" type="button" id="rt-start">开始</button>' +
        '<button class="mc-btn" type="button" id="rt-again" disabled>再测一次</button>' +
        '<button class="mc-btn" type="button" id="rt-export" disabled>导出数据 JSON</button>' +
        '<button class="mc-btn" type="button" id="rt-copy" disabled>复制结果</button>' +
        '<span class="spacer"></span>' +
        '<span class="module-note" id="rt-note">jsPsych 8.3.0 · 本机运算</span>' +
        '</div>' +
        '<div id="rt-results" class="reaction-results" hidden></div>' +
        '<p class="module-note">' + DISCLAIMER_EN + '</p>' +
        '<p class="module-note">中文小结：这只是你在这台手机上的表现，不是脑健康诊断，也不能判断脑震荡、痴呆、ADHD 或开车能力。屏幕与触屏延迟、练习、疲劳、分心都会影响结果；不同次比较请用同一台设备、同样条件。</p>' +
        '</div>';

      var displayEl = ctx.root.querySelector('#rt-display');
      var introEl = ctx.root.querySelector('#rt-intro');
      var startBtn = ctx.root.querySelector('#rt-start');
      var againBtn = ctx.root.querySelector('#rt-again');
      var exportBtn = ctx.root.querySelector('#rt-export');
      var copyBtn = ctx.root.querySelector('#rt-copy');
      var resultsEl = ctx.root.querySelector('#rt-results');
      var note = ctx.root.querySelector('#rt-note');

      function refreshReadout() {
        ctx.setReadout(readoutHtml(state));
      }

      function resetState() {
        state.phase = '待开始';
        state.progress = '0 / 18';
        state.valid = 0;
        state.anticipations = 0;
        state.median = '--';
        lastSummary = null;
        lastDataJson = null;
        lastResultsText = null;
        completed = false;
        copyBtn.disabled = true;
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
        refreshReadout();
      }

      function buildTimeline() {
        var timeline = [];
        var i;
        for (i = 0; i < PRACTICE_TRIALS; i += 1) {
          timeline.push({ type: SensorCraftReactionPlugin, phase: 'practice', index: i, total: PRACTICE_TRIALS, feedback: true });
        }
        for (i = 0; i < SCORED_TRIALS; i += 1) {
          timeline.push({ type: SensorCraftReactionPlugin, phase: 'scored', index: i, total: SCORED_TRIALS, feedback: false });
        }
        return timeline;
      }

      function onTrialFinish(data) {
        var scoredCount = 0;
        var validCount = 0;
        var anticipationCount = 0;
        if (jsPsych) {
          jsPsych.data.get().values().forEach(function (d) {
            if (d.phase !== 'scored') return;
            scoredCount += 1;
            if (d.valid) validCount += 1;
            if (d.reason === 'anticipation') anticipationCount += 1;
          });
        }
        state.phase = data.phase === 'practice' ? '练习' : '计分';
        state.progress = (data.phase === 'practice'
          ? '练习 ' + (data.index + 1) + ' / ' + PRACTICE_TRIALS
          : '计分 ' + (data.index + 1) + ' / ' + SCORED_TRIALS);
        state.valid = validCount + ' / ' + scoredCount;
        state.anticipations = anticipationCount;
        refreshReadout();
      }

      function trialLine(d) {
        var label = (d.phase === 'practice' ? '练习 ' : '计分 ') + (d.index + 1);
        if (d.valid && typeof d.rt === 'number') return { label: label, text: d.rt + ' ms' };
        var reason = d.reason === 'anticipation' ? '抢先 · 作废'
          : d.reason === 'timeout' ? '超时 · 作废'
          : d.reason === 'frame-stall' ? '卡顿 · 作废'
          : d.reason === 'interrupted' ? '中断 · 作废' : '作废';
        return { label: label, text: reason };
      }

      function showResults() {
        if (!ctx.isActive()) return;
        running = false;
        completed = true;
        startBtn.disabled = false;
        startBtn.textContent = '再测一次';
        againBtn.disabled = false;
        exportBtn.disabled = false;
        copyBtn.disabled = false;
        introEl.hidden = false;
        /* 跑完把待开始占位框写回去（同时清掉 jsPsych 残留的空壳），
           两次测试之间不留空框。 */
        displayEl.innerHTML = IDLE_HTML;
        var values = jsPsych.data.get().values();
        var scored = values.filter(function (d) { return d.phase === 'scored'; });
        lastSummary = summarizeScored(scored);
        lastDataJson = jsPsych.data.get().json();
        /* 全部 18 次列表（练习 + 计分，含作废原因），汇总只用计分有效试。 */
        var listRows = values.map(function (d) {
          var line = trialLine(d);
          return '<div class="readout-row"><span class="readout-label">' + line.label + '</span><span class="readout-value">' + line.text + '</span></div>';
        }).join('');
        var listHtml = '<div class="readout-title"><span>全部反应时间</span><span>ALL TRIALS</span></div>' + listRows;
        var listText = values.map(function (d) {
          var line = trialLine(d);
          return line.label + '：' + line.text;
        }).join('\n');
        state.phase = '已完成';
        state.progress = '18 / 18';
        state.valid = lastSummary.valid + ' / ' + lastSummary.total;
        state.anticipations = lastSummary.anticipations;
        state.median = lastSummary.median === null ? '--' : Math.round(lastSummary.median) + ' ms';
        refreshReadout();

        if (!lastSummary.comparable) {
          resultsEl.innerHTML =
            '<div class="readout-title"><span>没有可比分数</span><span>NO SCORE</span></div>' +
            '<div class="readout-row"><span class="readout-label">有效</span><span class="readout-value">' + lastSummary.valid + ' / ' + lastSummary.total + '（需满 12 次）</span></div>' +
            '<div class="readout-row"><span class="readout-label">抢先</span><span class="readout-value">' + lastSummary.anticipations + ' 次</span></div>' +
            '<div class="readout-row"><span class="readout-label">超时</span><span class="readout-value">' + lastSummary.timeouts + ' 次</span></div>' +
            '<div class="readout-row"><span class="readout-label">卡顿作废</span><span class="readout-value">' + lastSummary.frameStalls + ' 次</span></div>' +
            '<div class="readout-row"><span class="readout-label">中断作废</span><span class="readout-value">' + lastSummary.interrupted + ' 次</span></div>' +
            listHtml +
            '<p class="module-note">' + NO_SCORE_EN + '</p>' +
            '<p class="module-note">失败一次不说明反应快慢，只说明这次没测成。请坐稳、保持屏幕常亮，再测一次。</p>';
          lastResultsText = '反应时间测试：没有可比分数（有效 ' + lastSummary.valid + '/' + lastSummary.total + '，需满 12 次）\n' + listText;
          note.textContent = '未达有效次数，未出分数';
        } else {
          resultsEl.innerHTML =
            '<div class="readout-title"><span>计分结果</span><span>RESULTS</span></div>' +
            '<div class="readout-row"><span class="readout-label">中位反应</span><span class="readout-value">' + Math.round(lastSummary.median) + ' ms</span></div>' +
            '<div class="readout-row"><span class="readout-label">四分位距</span><span class="readout-value">' + Math.round(lastSummary.q1) + ' – ' + Math.round(lastSummary.q3) + ' ms</span></div>' +
            '<div class="readout-row"><span class="readout-label">最快 / 最慢</span><span class="readout-value">' + Math.round(lastSummary.min) + ' / ' + Math.round(lastSummary.max) + ' ms</span></div>' +
            '<div class="readout-row"><span class="readout-label">有效</span><span class="readout-value">' + lastSummary.valid + ' / ' + lastSummary.total + ' 次</span></div>' +
            '<div class="readout-row"><span class="readout-label">抢先</span><span class="readout-value">' + lastSummary.anticipations + ' 次</span></div>' +
            listHtml +
            '<p class="module-note">同一台设备、同样条件下的结果才可比。</p>';
          lastResultsText = '反应时间测试：中位 ' + Math.round(lastSummary.median) + ' ms（四分位距 ' +
            Math.round(lastSummary.q1) + '–' + Math.round(lastSummary.q3) + ' ms，最快 ' + Math.round(lastSummary.min) +
            ' ms，最慢 ' + Math.round(lastSummary.max) + ' ms，有效 ' + lastSummary.valid + '/' + lastSummary.total + '）\n' + listText;
          note.textContent = '已完成：中位 ' + Math.round(lastSummary.median) + ' ms';
        }
        resultsEl.hidden = false;
        SC.core.log.add('反应时间测试完成：有效 ' + lastSummary.valid + '/' + lastSummary.total +
          (lastSummary.comparable ? '，中位 ' + Math.round(lastSummary.median) + 'ms' : '，未达有效次数'));
        if (!firstDone) {
          firstDone = true;
          ctx.toast({ icon: 'touch', title: '成就达成！', subtitle: '第一次反应：完成 3 次练习 + 15 次计分' });
        }
        if (lastSummary.comparable && lastSummary.median < 250) {
          ctx.toast({ icon: 'touch', title: '成就达成！', subtitle: '闪电侠：中位反应低于 250ms' });
        }
      }

      function startRun() {
        if (running) return;
        if (typeof window.initJsPsych !== 'function') {
          ctx.showError(new Error('jsPsych 没加载上（js/vendor/jspsych-8.3.0/index.browser.min.js 缺失或被挡），请检查后重开卡片。'), 'JSPSYCH_MISSING');
          return;
        }
        resetState();
        running = true;
        completed = false;
        startBtn.disabled = true;
        startBtn.textContent = '进行中…';
        againBtn.disabled = true;
        exportBtn.disabled = true;
        copyBtn.disabled = true;
        note.textContent = '进行中：等变绿立刻点按目标';
        state.phase = '练习';
        refreshReadout();
        /* 颜色目标就是主窗口：收起提示文字，把目标滚动到屏幕中央，
           整个测试都在同一张卡片内完成，不开新窗口、新标签。 */
        introEl.hidden = true;
        try { displayEl.scrollIntoView({ block: 'center' }); } catch (ignored) {}
        /* 先清掉 #rt-display 里的待开始占位框（和上次跑完残留的空
           jsPsych 壳）：jsPsych 会在里面 append 自己的 #jspsych-content，
           不清就会同时出现两个框。清完再 init，试次框就是唯一的框。 */
        displayEl.innerHTML = '';
        jsPsych = window.initJsPsych({
          display_element: 'rt-display',
          on_trial_finish: onTrialFinish,
          on_finish: showResults
        });
        jsPsych.run(buildTimeline()).catch(function (error) {
          if (!ctx.isActive()) return;
          running = false;
          startBtn.disabled = false;
          startBtn.textContent = '开始';
          ctx.showError(new Error('反应时间测试中途出错：' + (error && error.message ? error.message : error)), 'RT_RUN_FAILED');
        });
        SC.core.log.add('反应时间测试已开始（3 次练习 + 15 次计分）');
      }

      startBtn.addEventListener('click', startRun);
      againBtn.addEventListener('click', startRun);
      exportBtn.addEventListener('click', function () {
        if (!lastDataJson) return;
        var blob = new Blob([lastDataJson], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'sensorcraft-reaction-time-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
        SC.core.log.add('反应时间数据已导出 JSON');
      });

      copyBtn.addEventListener('click', function () {
        if (!lastResultsText) return;
        function done(ok) {
          if (ok) {
            ctx.toast({ icon: 'touch', title: '已复制', subtitle: '结果文本已复制到剪贴板' });
            SC.core.log.add('反应时间结果已复制');
          } else {
            ctx.toast({ icon: 'barrier', title: '复制失败', subtitle: '请改用「导出数据 JSON」' });
          }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lastResultsText).then(function () { done(true); }, function () { done(false); });
        } else {
          /* 旧浏览器兜底：临时文本框 + execCommand。 */
          var ta = document.createElement('textarea');
          ta.value = lastResultsText;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (ignored) {}
          document.body.removeChild(ta);
          done(ok);
        }
      });

      ctx.onCleanup(function () {
        if (jsPsych && running && !completed) {
          try { jsPsych.abortExperiment(); } catch (ignored) {}
        }
        jsPsych = null;
      });
      refreshReadout();
    }
  });

  /* 测试钩子：纯函数单测用，不参与界面逻辑。 */
  SC._reactionTimeTest = {
    medianOf: medianOf,
    quartilesOf: quartilesOf,
    summarizeScored: summarizeScored,
    PRACTICE_TRIALS: PRACTICE_TRIALS,
    SCORED_TRIALS: SCORED_TRIALS,
    MIN_VALID_SCORED: MIN_VALID_SCORED
  };
})(window.SC = window.SC || {});
