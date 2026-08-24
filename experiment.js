"use strict";

const CONDITIONS = [
  { id: "C01", ssAmount: 10, ssDelay: 1, llAmount: 12, llDelay: 4 },
  { id: "C02", ssAmount: 10, ssDelay: 1, llAmount: 14, llDelay: 4 },
  { id: "C03", ssAmount: 10, ssDelay: 1, llAmount: 18, llDelay: 4 },
  { id: "C04", ssAmount: 10, ssDelay: 1, llAmount: 24, llDelay: 4 },
  { id: "C05", ssAmount: 20, ssDelay: 1, llAmount: 23, llDelay: 4 },
  { id: "C06", ssAmount: 20, ssDelay: 1, llAmount: 28, llDelay: 4 },
  { id: "C07", ssAmount: 20, ssDelay: 1, llAmount: 36, llDelay: 4 },
  { id: "C08", ssAmount: 20, ssDelay: 1, llAmount: 48, llDelay: 4 },
  { id: "C09", ssAmount: 30, ssDelay: 1, llAmount: 35, llDelay: 4 },
  { id: "C10", ssAmount: 30, ssDelay: 1, llAmount: 42, llDelay: 4 },
  { id: "C11", ssAmount: 30, ssDelay: 1, llAmount: 54, llDelay: 4 },
  { id: "C12", ssAmount: 30, ssDelay: 1, llAmount: 72, llDelay: 4 },
  { id: "C13", ssAmount: 40, ssDelay: 1, llAmount: 46, llDelay: 4 },
  { id: "C14", ssAmount: 40, ssDelay: 1, llAmount: 56, llDelay: 4 },
  { id: "C15", ssAmount: 40, ssDelay: 1, llAmount: 72, llDelay: 4 },
  { id: "C16", ssAmount: 40, ssDelay: 1, llAmount: 96, llDelay: 4 }
];

const PRACTICE_CONDITIONS = [
  { id: "P01", ssAmount: 12, ssDelay: 1, llAmount: 20, llDelay: 4 },
  { id: "P02", ssAmount: 25, ssDelay: 1, llAmount: 30, llDelay: 4 },
  { id: "P03", ssAmount: 35, ssDelay: 1, llAmount: 70, llDelay: 4 }
];

const PROBE_FRACTIONS = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];
const MAX_BASELINE_MS = 12000;
const MIN_VALID_BASELINE_MS = 600;
const ITI_MS = [500, 800];

const jsPsych = initJsPsych({
  on_finish: () => jsPsych.data.get().localSave("csv", `intertemporal_probe_${participantId}.csv`)
});

const urlId = jsPsych.data.getURLVariable("participant_id") || jsPsych.data.getURLVariable("subject");
const participantId = urlId || jsPsych.randomization.randomID(10);
const timeline = [];

jsPsych.data.addProperties({
  participant_id: participantId,
  experiment_version: "prototype_1",
  amount_unit: "CNY",
  delay_unit: "week"
});

function shuffled(array) {
  return jsPsych.randomization.shuffle(array.slice());
}

function optionHtml(option, side) {
  return `<div class="option-card" id="${side}-option">
    <div class="option-label">${side === "left" ? "左侧选项" : "右侧选项"}</div>
    <div class="option-main">
      <span class="option-delay">${option.delay}周后</span>
      <span class="option-amount">${option.amount}元</span>
    </div>
  </div>`;
}

function trialOptions(condition, llSide) {
  const ss = { kind: "SS", amount: condition.ssAmount, delay: condition.ssDelay };
  const ll = { kind: "LL", amount: condition.llAmount, delay: condition.llDelay };
  return llSide === "left" ? { left: ll, right: ss } : { left: ss, right: ll };
}

function conditionData(condition, llSide) {
  return {
    condition_id: condition.id,
    ss_amount: condition.ssAmount,
    ss_delay: condition.ssDelay,
    ll_amount: condition.llAmount,
    ll_delay: condition.llDelay,
    amount_difference: condition.llAmount - condition.ssAmount,
    ll_ss_amount_ratio: condition.llAmount / condition.ssAmount,
    ll_side: llSide
  };
}

function nonAdjacentShuffle(trials) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const candidate = shuffled(trials);
    if (candidate.every((x, i) => i === 0 || x.condition.id !== candidate[i - 1].condition.id)) return candidate;
  }
  throw new Error("无法生成不相邻的condition顺序");
}

function baselineTrial(spec, index) {
  const condition = spec.condition;
  const options = trialOptions(condition, spec.llSide);
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: ["f", "j"],
    stimulus: `<div class="decision-wrap">
      <div class="decision-prompt">请选择你更偏好的选项</div>
      <div class="options">
        ${optionHtml(options.left, "left")}
        ${optionHtml(options.right, "right")}
      </div>
      <div class="key-hint">左侧按 F　　右侧按 J</div>
    </div>`,
    data: {
      phase: "baseline",
      session_id: 1,
      session_trial_index: index + 1,
      position_version: spec.llSide,
      ...conditionData(condition, spec.llSide)
    },
    on_finish: data => {
      const side = data.response === "f" ? "left" : "right";
      const choice = options[side].kind;
      data.choice_side = side;
      data.choice = choice;
      data.chose_ll = choice === "LL" ? 1 : 0;
      data.decision_rt = data.rt;
    },
    post_trial_gap: jsPsych.randomization.sampleWithoutReplacement(ITI_MS, 1)[0]
  };
}

function practiceTrial(condition, index) {
  const spec = { condition, llSide: index % 2 === 0 ? "left" : "right" };
  const trial = baselineTrial(spec, index);
  trial.data = {
    ...trial.data,
    phase: "practice",
    session_id: 0,
    session_trial_index: index + 1
  };
  return trial;
}

function probePracticeTrial(condition, fraction, index) {
  const spec = {
    condition,
    fraction,
    llSide: index % 2 === 0 ? "right" : "left"
  };
  const trial = probeTrial(spec, 0, index);
  trial.data = {
    ...trial.data,
    phase: "probe_practice",
    session_id: 0,
    session_trial_index: index + 1,
    practice_probe_fraction: fraction
  };
  return trial;
}

function validBaselineRt(rt) {
  return Number.isFinite(rt) && rt >= MIN_VALID_BASELINE_MS && rt <= MAX_BASELINE_MS;
}

function participantFallbackRt() {
  const rts = jsPsych.data.get().filter({ phase: "baseline" }).select("decision_rt").values
    .filter(validBaselineRt).sort((a, b) => a - b);
  if (!rts.length) return 3000;
  const mid = Math.floor(rts.length / 2);
  return rts.length % 2 ? rts[mid] : (rts[mid - 1] + rts[mid]) / 2;
}

function baselineSummary(conditionId) {
  const rows = jsPsych.data.get().filter({ phase: "baseline", condition_id: conditionId }).values();
  const valid = rows.map(x => Number(x.decision_rt)).filter(validBaselineRt);
  const fallback = participantFallbackRt();
  let base;
  let source;
  if (valid.length === 2) {
    base = Math.sqrt(valid[0] * valid[1]);
    source = "condition_geometric_mean";
  } else if (valid.length === 1) {
    base = valid[0];
    source = "single_valid_condition_rt";
  } else {
    base = fallback;
    source = "participant_median_fallback";
  }
  const choices = rows.map(x => x.choice).filter(Boolean);
  return {
    baseline_rt: base,
    baseline_rt_source: source,
    baseline_choice_consistent: choices.length === 2 ? choices[0] === choices[1] : null,
    baseline_choice_1: choices[0] || null,
    baseline_choice_2: choices[1] || null
  };
}

/*
 * 每个condition的10个探针trial被分成五组，每组2题：
 * - 每个探针session中，每个condition恰好2题；
 * - 同一fraction的左右版本位于不同session；
 * - 每个condition在每个session中恰好一个LL-left和一个LL-right；
 * - 每个fraction在各session出现6或7次（总计32次）。
 *
 * 对每个condition随机生成一个五节点环。五个fraction分别占据五条边，
 * 每条边的两个端点分配左右翻转版本。因此每个session节点的度数为2，
 * 且恰好收到一个LL-left和一个LL-right trial。
 */
function buildBalancedProbeSessions() {
  const sessionLabels = shuffled([0, 1, 2, 3, 4]);
  const rotations = [];
  for (let r = 0; r < 5; r++) {
    for (let repeat = 0; repeat < 3; repeat++) rotations.push(r);
  }
  rotations.push(Math.floor(Math.random() * 5));
  const cycles = shuffled(rotations).map(r =>
    Array.from({ length: 5 }, (_, f) => sessionLabels[(r + f) % 5])
  );

  const sessions = Array.from({ length: 5 }, () => []);
  shuffled(CONDITIONS).forEach((condition, conditionIndex) => {
    const cycle = cycles[conditionIndex];
    const flip = Math.random() < 0.5;
    const side = label => flip ? (label === "left" ? "right" : "left") : label;
    PROBE_FRACTIONS.forEach((fraction, f) => {
      sessions[cycle[f]].push({ condition, fraction, llSide: side("left") });
      sessions[cycle[(f + 1) % 5]].push({ condition, fraction, llSide: side("right") });
    });
  });

  return sessions.map((trials, sessionIndex) => {
    const ordered = nonAdjacentShuffle(trials);
    if (ordered.length !== 32) throw new Error(`Session ${sessionIndex + 2} trial数不是32`);
    return ordered;
  });
}

function probeTrial(spec, sessionId, index) {
  const condition = spec.condition;
  const options = trialOptions(condition, spec.llSide);
  let timerId;
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: "NO_KEYS",
    stimulus: `<div class="decision-wrap">
      <div id="stimulus-panel">
      <div class="decision-prompt">请观察两个选项，并考虑你此刻更偏好哪一个</div>
      <div class="options">
        ${optionHtml(options.left, "left")}
        ${optionHtml(options.right, "right")}
      </div>
      </div>
      <div class="probe-area" id="probe-area" hidden>
        <div class="probe-question">此时此刻，你更偏好哪一个选项？</div>
        <div class="range-row">
          <div class="range-anchor">0<br>完全偏好左侧</div>
          <input id="preference-slider" type="range" min="0" max="100" step="1" value="50">
          <div class="range-anchor">100<br>完全偏好右侧</div>
        </div>
        <div class="range-value" id="range-value">请移动滑块</div>
        <button class="submit-probe" id="submit-probe" disabled>提交</button>
      </div>
    </div>`,
    data: {
      phase: "probe",
      session_id: sessionId,
      session_trial_index: index + 1,
      probe_fraction: spec.fraction,
      position_version: spec.llSide,
      ...conditionData(condition, spec.llSide)
    },
    on_load: () => {
      const stimulusOnset = performance.now();
      const baseline = baselineSummary(condition.id);
      const plannedDelay = baseline.baseline_rt * spec.fraction;
      timerId = window.setTimeout(() => {
        const actualProbeOnset = performance.now();
        const probeArea = document.getElementById("probe-area");
        const stimulusPanel = document.getElementById("stimulus-panel");
        const slider = document.getElementById("preference-slider");
        const valueText = document.getElementById("range-value");
        const submit = document.getElementById("submit-probe");
        stimulusPanel.remove();
        probeArea.hidden = false;
        let moved = false;
        const update = () => {
          moved = true;
          valueText.textContent = `当前选择：${slider.value}`;
          submit.disabled = false;
        };
        slider.addEventListener("input", update);
        submit.addEventListener("click", () => {
          if (!moved) return;
          const raw = Number(slider.value);
          const llPreference = spec.llSide === "right" ? raw : 100 - raw;
          jsPsych.finishTrial({
            ...baseline,
            planned_probe_ms: plannedDelay,
            actual_probe_ms: actualProbeOnset - stimulusOnset,
            probe_timing_error_ms: actualProbeOnset - stimulusOnset - plannedDelay,
            slider_raw: raw,
            slider_ll_preference: llPreference,
            slider_rt: performance.now() - actualProbeOnset
          });
        }, { once: true });
      }, plannedDelay);
    },
    on_finish: () => window.clearTimeout(timerId),
    post_trial_gap: jsPsych.randomization.sampleWithoutReplacement(ITI_MS, 1)[0]
  };
}

function spacePage(html, data = {}) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="page">${html}<p class="session-note">按空格键继续</p></div>`,
    choices: [" "],
    data
  };
}

function sessionStart(sessionNumber, message) {
  return spacePage(`<h2>Session ${sessionNumber}</h2><p>${message}</p>`, {
    phase: "session_start",
    session_id: sessionNumber
  });
}

function oneMinuteRest(nextSessionNumber) {
  let intervalId;
  let keyHandler;
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: "NO_KEYS",
    stimulus: `<div class="page"><h2>休息</h2>
      <p>请休息片刻。距离下一阶段还有</p>
      <p id="rest-clock" style="font-size:42px;font-weight:650;">1:00</p>
      <p class="session-note" id="rest-message">倒计时结束后可以继续</p></div>`,
    data: { phase: "rest", before_session_id: nextSessionNumber },
    on_load: () => {
      const endTime = performance.now() + 60000;
      const clock = document.getElementById("rest-clock");
      const message = document.getElementById("rest-message");
      intervalId = window.setInterval(() => {
        const remaining = Math.max(0, endTime - performance.now());
        const seconds = Math.ceil(remaining / 1000);
        clock.textContent = `0:${String(seconds).padStart(2, "0")}`;
        if (remaining <= 0) {
          window.clearInterval(intervalId);
          clock.textContent = "0:00";
          message.textContent = "休息结束，按空格键进入下一阶段";
          keyHandler = event => {
            if (event.code === "Space") {
              document.removeEventListener("keydown", keyHandler);
              jsPsych.finishTrial({ rest_duration_ms: 60000 });
            }
          };
          document.addEventListener("keydown", keyHandler);
        }
      }, 100);
    },
    on_finish: () => {
      window.clearInterval(intervalId);
      if (keyHandler) document.removeEventListener("keydown", keyHandler);
    }
  };
}

timeline.push({
  type: jsPsychFullscreen,
  fullscreen_mode: true,
  message: "<p>实验即将开始，请关闭可能造成干扰的程序。</p>",
  button_label: "进入全屏"
});

timeline.push(spacePage(`<div class="instruction"><h2>实验说明</h2>
  <p>你将看到两个在不同时间获得不同金额的选项。所有选择均无对错，请按照自己的真实偏好作答。</p>
  <p>第一阶段需要选择最终更偏好的选项：偏好左侧请按F键，偏好右侧请按J键。后续阶段会在思考过程中询问你“此时此刻”的偏好。</p></div>`, { phase: "instruction" }));

timeline.push(spacePage(`<div class="instruction"><h2>注意</h2>
  <p>后续阶段到达探针时间时，两个选项会立即消失。请根据选项消失那一刻的偏好完成滑块；提交后该题直接结束，不再做最终二选一。</p>
  <p>滑块必须移动后才能提交。</p></div>`, { phase: "instruction" }));

const practiceTimeline = [];
practiceTimeline.push(spacePage(`<h2>二项选择练习</h2>
  <p>下面先完成3道最终选择练习题。偏好左侧按F键，偏好右侧按J键。</p>`, {
  phase: "practice_instruction"
}));
PRACTICE_CONDITIONS.forEach((condition, index) => {
  practiceTimeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<div class="fixation">+</div>',
    choices: "NO_KEYS",
    trial_duration: 500,
    data: { phase: "practice_fixation" }
  });
  practiceTimeline.push(practiceTrial(condition, index));
});

practiceTimeline.push(spacePage(`<h2>思维探针练习</h2>
  <p>下面完成3道探针练习。两个选项会在思考过程中消失；请报告选项消失那一刻的即时偏好。</p>
  <p>刺激消失后不会再次显示，请在刺激呈现期间认真阅读。</p>`, {
  phase: "probe_practice_instruction"
}));
[1 / 6, 3 / 6, 5 / 6].forEach((fraction, index) => {
  practiceTimeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<div class="fixation">+</div>',
    choices: "NO_KEYS",
    trial_duration: 500,
    data: { phase: "probe_practice_fixation" }
  });
  practiceTimeline.push(probePracticeTrial(PRACTICE_CONDITIONS[index], fraction, index));
});

practiceTimeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="page"><h2>练习结束</h2>
    <p>如果已经熟悉两种任务，请按J键进入正式实验。</p>
    <p>如果还不熟悉，请按F键重新完成整套练习。</p>
    <p class="key-hint">F = 重做练习　　J = 进入正式实验</p></div>`,
  choices: ["f", "j"],
  data: { phase: "practice_familiarity_check" },
  on_finish: data => {
    data.practice_action = data.response === "f" ? "repeat" : "continue";
  }
});

timeline.push({
  timeline: practiceTimeline,
  loop_function: data => {
    const check = data.filter({ phase: "practice_familiarity_check" }).last(1).values()[0];
    return check && check.practice_action === "repeat";
  }
});

timeline.push(sessionStart(1, "本阶段请在两个选项中选择最终更偏好的一个：左侧按F键，右侧按J键。"));

const baselineSpecs = [];
CONDITIONS.forEach(condition => {
  const firstSide = Math.random() < 0.5 ? "left" : "right";
  baselineSpecs.push({ condition, llSide: firstSide });
  baselineSpecs.push({ condition, llSide: firstSide === "left" ? "right" : "left" });
});
nonAdjacentShuffle(baselineSpecs).forEach((spec, index) => {
  timeline.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fixation">+</div>', choices: "NO_KEYS", trial_duration: 500 });
  timeline.push(baselineTrial(spec, index));
});

const probeSessions = buildBalancedProbeSessions();
probeSessions.forEach((specs, probeSessionIndex) => {
  const sessionId = probeSessionIndex + 2;
  timeline.push(oneMinuteRest(sessionId));
  timeline.push(sessionStart(sessionId, "本阶段的探针时间会在1/6、2/6、3/6、4/6和5/6之间混合呈现。请报告刺激消失时的即时偏好。"));
  specs.forEach((spec, index) => {
    timeline.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fixation">+</div>', choices: "NO_KEYS", trial_duration: 500 });
    timeline.push(probeTrial(spec, sessionId, index));
  });
});

timeline.push(spacePage("<h2>实验结束</h2><p>感谢你的参与。</p>", { phase: "experiment_end" }));

timeline.push({ type: jsPsychFullscreen, fullscreen_mode: false, delay_after: 0 });
jsPsych.run(timeline);
