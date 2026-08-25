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
  { id: "P03", ssAmount: 35, ssDelay: 1, llAmount: 70, llDelay: 4 },
  { id: "P04", ssAmount: 18, ssDelay: 1, llAmount: 25, llDelay: 4 },
  { id: "P05", ssAmount: 42, ssDelay: 1, llAmount: 55, llDelay: 4 }
];

const ENCODING_CALIBRATION_CONDITIONS = [
  { id: "E01", ssAmount: 12, ssDelay: 1, llAmount: 15, llDelay: 4 },
  { id: "E02", ssAmount: 14, ssDelay: 1, llAmount: 20, llDelay: 4 },
  { id: "E03", ssAmount: 16, ssDelay: 1, llAmount: 29, llDelay: 4 },
  { id: "E04", ssAmount: 18, ssDelay: 1, llAmount: 23, llDelay: 4 },
  { id: "E05", ssAmount: 22, ssDelay: 1, llAmount: 38, llDelay: 4 },
  { id: "E06", ssAmount: 24, ssDelay: 1, llAmount: 30, llDelay: 4 },
  { id: "E07", ssAmount: 26, ssDelay: 1, llAmount: 47, llDelay: 4 },
  { id: "E08", ssAmount: 28, ssDelay: 1, llAmount: 35, llDelay: 4 },
  { id: "E09", ssAmount: 32, ssDelay: 1, llAmount: 58, llDelay: 4 },
  { id: "E10", ssAmount: 36, ssDelay: 1, llAmount: 45, llDelay: 4 }
];

const PROBE_FRACTIONS = [0 / 5, 1 / 5, 2 / 5, 3 / 5, 4 / 5];
const SCAN_DURATIONS_MS = [100, 300, 500, 700, 900, 1100, 1300, 1500];
const MAX_BASELINE_MS = 12000;
const MIN_VALID_BASELINE_MS = 600;
const DEFAULT_ENCODING_MS = 700;
const DEFAULT_EXECUTION_MS = 200;
const MIN_VALID_ENCODING_MS = 200;
const MAX_VALID_ENCODING_MS = 3000;
const MIN_DECISION_COMPONENT_MS = 100;
const CLICK_RESPONSE_LIMIT_MS = 1500;
const ITI_MS = [500, 800];

const jsPsych = initJsPsych({
  on_finish: () => jsPsych.data.get().localSave("csv", `intertemporal_preference_${participantId}.csv`)
});

const urlId = jsPsych.data.getURLVariable("participant_id") || jsPsych.data.getURLVariable("subject");
const participantId = urlId || jsPsych.randomization.randomID(10);
const timeline = [];
const scanCheckState = {
  duration: null,
  firstAnswer: null,
  direction: null,
  minYes: Infinity,
  complete: false,
  trialCount: 0,
  currentCondition: null,
  currentLlSide: null,
  hitSafetyLimit: false
};

jsPsych.data.addProperties({
  participant_id: participantId,
  experiment_version: "prototype_7_no_chinrest",
  amount_unit: "CNY",
  delay_unit: "week"
});

function shuffled(array) {
  return jsPsych.randomization.shuffle(array.slice());
}

function optionHtml(option, side) {
  return `<div class="option-card" id="${side}-option">
    <div class="option-main">
      <span class="option-delay">${option.delay}周后</span>
      <span class="option-amount">${option.amount}元</span>
    </div>
  </div>`;
}

function scanOptionHtml(side) {
  return `<div class="option-card" id="${side}-option">
    <div class="option-main">
      <span class="option-delay">X周后</span>
      <span class="option-amount">XX元</span>
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

function encodingCalibrationTrial(spec, index) {
  const condition = spec.condition;
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: [" "],
    stimulus: `<div class="decision-wrap">
      <div class="decision-prompt">目光扫过左右两个选项后，请立即按空格键</div>
      <div class="options">
        ${scanOptionHtml("left")}
        ${scanOptionHtml("right")}
      </div>
      <div class="key-hint">扫过两边后立即按空格</div>
    </div>`,
    data: {
      phase: "encoding_calibration",
      calibration_trial_index: index + 1,
      ...conditionData(condition, spec.llSide)
    },
    on_finish: data => {
      data.encoding_rt = data.rt;
    },
    post_trial_gap: jsPsych.randomization.sampleWithoutReplacement(ITI_MS, 1)[0]
  };
}

function executionCalibrationTrial(index) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: [" "],
    stimulus: `<div class="page">
      <div style="font-size:56px;font-weight:700;">现在</div>
      <div class="key-hint">看到画面立即按空格</div>
    </div>`,
    data: {
      phase: "execution_calibration",
      calibration_trial_index: index + 1
    },
    on_finish: data => {
      data.execution_rt = data.rt;
    },
    post_trial_gap: jsPsych.randomization.sampleWithoutReplacement(ITI_MS, 1)[0]
  };
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

function mouseCenterTrial(phase, sessionId, index) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    choices: "NO_KEYS",
    stimulus: `<div class="mouse-center-page">
      <button type="button" class="mouse-start-target" id="mouse-start-target">点击此处开始</button>
      <p class="session-note">请将鼠标移到这里</p>
    </div>`,
    data: {
      phase,
      session_id: sessionId,
      session_trial_index: index + 1
    },
    on_load: () => {
      const target = document.getElementById("mouse-start-target");
      target.addEventListener("click", () => {
        jsPsych.finishTrial({ mouse_center_confirmed: true });
      }, { once: true });
    }
  };
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

function medianValidCalibration(phase, field, fallback) {
  const values = jsPsych.data.get().filter({ phase })
    .select(field).values
    .map(Number)
    .filter(x => Number.isFinite(x) && x >= MIN_VALID_ENCODING_MS && x <= MAX_VALID_ENCODING_MS)
    .sort((a, b) => a - b);
  if (!values.length) return fallback;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function participantReadAndPressTime() {
  return medianValidCalibration("encoding_calibration", "encoding_rt", DEFAULT_ENCODING_MS);
}

function participantExecutionTime() {
  return medianValidCalibration("execution_calibration", "execution_rt", DEFAULT_EXECUTION_MS);
}

function participantEncodingTime() {
  const checkRows = jsPsych.data.get().filter({ phase: "scan_threshold_check_response" }).values();
  const checkYesDurations = checkRows.filter(row => row.can_scan_all === true)
    .map(row => Number(row.scan_duration_ms)).filter(Number.isFinite);
  if (checkYesDurations.length) return Math.min(...checkYesDurations);
  const checkDurations = checkRows.map(row => Number(row.scan_duration_ms)).filter(Number.isFinite);
  if (checkDurations.length) return Math.max(...checkDurations);
  const initialRows = jsPsych.data.get().filter({ phase: "scan_threshold_response" }).values();
  const consistentYesDurations = SCAN_DURATIONS_MS.filter(duration => {
    const rowsAtDuration = initialRows.filter(row => Number(row.scan_duration_ms) === duration);
    return rowsAtDuration.length >= 2 && rowsAtDuration.filter(row => row.can_scan_all === true).length >= 2;
  });
  return consistentYesDurations.length
    ? Math.min(...consistentYesDurations)
    : Math.max(...SCAN_DURATIONS_MS);
}

function baselineSummary(conditionId) {
  const rows = jsPsych.data.get().filter({ phase: "baseline", condition_id: conditionId }).values();
  const valid = rows.map(x => Number(x.decision_rt)).filter(validBaselineRt);
  const fallback = participantFallbackRt();
  let totalBase;
  let source;
  if (valid.length === 2) {
    totalBase = Math.sqrt(valid[0] * valid[1]);
    source = "condition_geometric_mean";
  } else if (valid.length === 1) {
    totalBase = valid[0];
    source = "single_valid_condition_rt";
  } else {
    totalBase = fallback;
    source = "participant_median_fallback";
  }
  const encodingTime = participantEncodingTime();
  const unboundedDecisionBase = totalBase - encodingTime;
  const decisionBase = Math.max(MIN_DECISION_COMPONENT_MS, unboundedDecisionBase);
  const choices = rows.map(x => x.choice).filter(Boolean);
  return {
    baseline_rt: decisionBase,
    baseline_total_rt: totalBase,
    scan_threshold_ms: encodingTime,
    encoding_time_ms: encodingTime,
    baseline_decision_rt: decisionBase,
    decision_rt_was_clamped: unboundedDecisionBase < MIN_DECISION_COMPONENT_MS,
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
  let responseTimerId;
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
        <div class="click-now-cue">立即点击</div>
        <div class="preference-line-wrap">
          <div class="line-anchor left-anchor" aria-hidden="true"></div>
          <div class="preference-line" id="preference-line">
            <div class="line-midpoint"></div>
            <div class="preference-marker" id="preference-marker" hidden></div>
          </div>
          <div class="line-anchor right-anchor" aria-hidden="true"></div>
        </div>
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
      const plannedDecisionDelay = baseline.baseline_decision_rt * spec.fraction;
      const plannedDelay = baseline.encoding_time_ms + plannedDecisionDelay;
      timerId = window.setTimeout(() => {
        const actualProbeOnset = performance.now();
        const probeArea = document.getElementById("probe-area");
        const stimulusPanel = document.getElementById("stimulus-panel");
        const preferenceLine = document.getElementById("preference-line");
        const preferenceMarker = document.getElementById("preference-marker");
        const masks = ["#%#", "%&#", "&%&", "#&#"];
        stimulusPanel.querySelector(".decision-prompt").style.visibility = "hidden";
        stimulusPanel.querySelectorAll(".option-card").forEach(card => {
          const main = card.querySelector(".option-main");
          card.classList.add("masked-option");
          main.classList.add("mask-content");
          const first = jsPsych.randomization.sampleWithoutReplacement(masks, 1)[0];
          const second = jsPsych.randomization.sampleWithoutReplacement(masks, 1)[0];
          main.innerHTML = `<span class="option-delay">${first}</span><span class="option-amount">${second}</span>`;
        });
        probeArea.hidden = false;
        let finished = false;
        let latestRaw = 50;
        const positionFromEvent = event => {
          const rect = preferenceLine.getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
          return { x, raw: Math.round((x / rect.width) * 100) };
        };
        const trackMouse = event => {
          const position = positionFromEvent(event);
          latestRaw = position.raw;
          preferenceMarker.hidden = false;
          preferenceMarker.style.left = `${position.x}px`;
        };
        const finishResponse = (raw, timedOut, clicked) => {
          if (finished) return;
          finished = true;
          window.clearTimeout(responseTimerId);
          document.removeEventListener("mousemove", trackMouse);
          const llPreference = raw === null ? null : (spec.llSide === "right" ? raw : 100 - raw);
          jsPsych.finishTrial({
            ...baseline,
            planned_probe_ms: plannedDelay,
            planned_decision_fraction_ms: plannedDecisionDelay,
            actual_probe_ms: actualProbeOnset - stimulusOnset,
            probe_timing_error_ms: actualProbeOnset - stimulusOnset - plannedDelay,
            line_raw: raw,
            line_ll_preference: llPreference,
            line_clicked: clicked,
            line_timed_out: timedOut,
            line_response_limit_ms: CLICK_RESPONSE_LIMIT_MS,
            line_rt: performance.now() - actualProbeOnset
          });
        };
        document.addEventListener("mousemove", trackMouse);
        preferenceLine.addEventListener("click", event => {
          latestRaw = positionFromEvent(event).raw;
          finishResponse(latestRaw, false, true);
        }, { once: true });
        responseTimerId = window.setTimeout(() => finishResponse(latestRaw, true, false), CLICK_RESPONSE_LIMIT_MS);
      }, plannedDelay);
    },
    on_finish: () => {
      window.clearTimeout(timerId);
      window.clearTimeout(responseTimerId);
    },
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

function confirmPage(html, data = {}) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="page">${html}</div>`,
    choices: ["确认"],
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
      <p>后续阶段中，两个选项的金额和时间会在你思考时被随机字符覆盖。覆盖后，请立即在横线上点击，报告你在覆盖那一刻的偏好程度。</p>
  <p>每题开始前请点击屏幕中央，并让鼠标停在中央；内容被覆盖后再移向横线。圆点会跟随鼠标移动，第一次点击会直接提交。</p></div>`, { phase: "instruction" }));

const practiceTimeline = [];
practiceTimeline.push(spacePage(`<h2>二项选择练习</h2>
  <p>下面先完成5道最终选择练习题。偏好左侧按F键，偏好右侧按J键。</p>`, {
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

practiceTimeline.push(confirmPage(`<h2>中途偏好报告练习</h2>
  <p>下面完成5道练习。金额和时间会被随机字符覆盖；覆盖后，请在1.5秒内将鼠标移到横线上的合适位置并单击。</p>
  <p>每题先点击屏幕中央，并让鼠标停在中央，等内容被覆盖后再移动。圆点会跟随鼠标，第一次点击会立即提交。</p>
  <p>请报告覆盖那一刻的偏好，不要在覆盖后继续比较。</p>`, {
  phase: "probe_practice_instruction"
}));
PROBE_FRACTIONS.forEach((fraction, index) => {
  practiceTimeline.push(mouseCenterTrial("probe_practice_mouse_center", 0, index));
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

timeline.push(spacePage(`<h2>快速扫视测量</h2>
  <p>接下来有16道题。8种呈现时间各出现两次，顺序随机。</p>
  <p>每道题中，左右两边会短暂出现“X周后 / XX元”，随后自动消失。</p>
  <p>请在内容出现时快速扫视左右两边。内容消失后，请报告刚才是否有足够时间让目光扫过左右两边的全部内容。</p>
  <p class="key-hint">F = 没能全部扫过　　J = 能够全部扫过</p></div>`, {
  phase: "scan_threshold_instruction"
}));

const repeatedScanDurations = shuffled(SCAN_DURATIONS_MS.flatMap(duration => [duration, duration]));
repeatedScanDurations.forEach((duration, index) => {
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<div class="fixation">+</div>',
    choices: "NO_KEYS",
    trial_duration: 500,
    data: { phase: "scan_threshold_fixation", calibration_trial_index: index + 1 }
  });
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="decision-wrap"><div class="options">
      ${scanOptionHtml("left")}${scanOptionHtml("right")}
    </div></div>`,
    choices: "NO_KEYS",
    trial_duration: duration,
    data: {
      phase: "scan_threshold_stimulus",
      calibration_trial_index: index + 1,
      scan_duration_ms: duration
    }
  });
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="page"><h2>刚才有足够时间扫过左右两边的全部内容吗？</h2>
      <p class="key-hint">F = 没有　　J = 有</p></div>`,
    choices: ["f", "j"],
    data: {
      phase: "scan_threshold_response",
      calibration_trial_index: index + 1,
      scan_duration_ms: duration
    },
    on_finish: data => {
      data.can_scan_all = data.response === "j";
    }
  });
});

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => `<div class="page"><h2>初步测量完成</h2>
    <p>接下来会使用真实的金额和时间进一步确认你的扫视时间。</p>
    <p>每题内容消失后，仍请按F或J报告是否有足够时间扫过左右两边的全部内容。</p>
    <p class="session-note">按空格键继续</p></div>`,
  choices: [" "],
  data: { phase: "scan_threshold_initial_summary" },
  on_start: trial => {
    trial.data.initial_scan_threshold_ms = participantEncodingTime();
  }
});

const scanCheckConditions = shuffled(CONDITIONS);
const adaptiveScanCheck = {
  timeline: [
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="fixation">+</div>',
      choices: "NO_KEYS",
      trial_duration: 500,
      data: { phase: "scan_threshold_check_fixation" }
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: () => {
        if (!scanCheckState.currentCondition) {
          scanCheckState.currentCondition = scanCheckConditions[scanCheckState.trialCount % scanCheckConditions.length];
          scanCheckState.currentLlSide = Math.random() < 0.5 ? "left" : "right";
        }
        const options = trialOptions(scanCheckState.currentCondition, scanCheckState.currentLlSide);
        return `<div class="decision-wrap"><div class="options">
          ${optionHtml(options.left, "left")}${optionHtml(options.right, "right")}
        </div></div>`;
      },
      choices: "NO_KEYS",
      trial_duration: () => scanCheckState.duration,
      data: { phase: "scan_threshold_check_stimulus" },
      on_finish: data => {
        Object.assign(data, {
          scan_check_trial_index: scanCheckState.trialCount + 1,
          scan_duration_ms: scanCheckState.duration,
          ...conditionData(scanCheckState.currentCondition, scanCheckState.currentLlSide)
        });
      }
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `<div class="page"><h2>刚才有足够时间扫过左右两边的全部内容吗？</h2>
        <p class="key-hint">F = 没有　　J = 有</p></div>`,
      choices: ["f", "j"],
      data: { phase: "scan_threshold_check_response" },
      on_start: trial => {
        Object.assign(trial.data, {
          scan_check_trial_index: scanCheckState.trialCount + 1,
          scan_duration_ms: scanCheckState.duration,
          scan_check_direction: scanCheckState.direction || "initial",
          ...conditionData(scanCheckState.currentCondition, scanCheckState.currentLlSide)
        });
      },
      on_finish: data => {
        const canScan = data.response === "j";
        data.can_scan_all = canScan;
        if (canScan) scanCheckState.minYes = Math.min(scanCheckState.minYes, scanCheckState.duration);

        if (scanCheckState.firstAnswer === null) {
          scanCheckState.firstAnswer = canScan;
          scanCheckState.direction = canScan ? "down" : "up";
          data.answer_changed = false;
        } else {
          data.answer_changed = canScan !== scanCheckState.firstAnswer;
          if (data.answer_changed) scanCheckState.complete = true;
        }

        scanCheckState.trialCount += 1;
        if (!scanCheckState.complete) {
          const step = scanCheckState.direction === "down" ? -50 : 50;
          const nextDuration = scanCheckState.duration + step;
          if (nextDuration < 50) {
            scanCheckState.duration = 50;
            scanCheckState.complete = true;
          } else if (nextDuration > 3000) {
            scanCheckState.duration = 3000;
            scanCheckState.complete = true;
            scanCheckState.hitSafetyLimit = true;
          } else {
            scanCheckState.duration = nextDuration;
          }
        }
        if (scanCheckState.trialCount >= 12) {
          scanCheckState.complete = true;
          scanCheckState.hitSafetyLimit = true;
        }
        data.final_scan_threshold_ms = Number.isFinite(scanCheckState.minYes)
          ? scanCheckState.minYes
          : scanCheckState.duration;
        scanCheckState.currentCondition = null;
        scanCheckState.currentLlSide = null;
      }
    }
  ],
  on_timeline_start: () => {
    if (scanCheckState.duration === null) scanCheckState.duration = participantEncodingTime();
  },
  loop_function: () => !scanCheckState.complete
};
timeline.push(adaptiveScanCheck);

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => `<div class="page"><h2>快速扫视测量完成</h2>
    <p>程序已经根据真实金额和时间确定你的个人扫视时间。</p>
    <p class="session-note">按空格键进入正式实验</p></div>`,
  choices: [" "],
  data: { phase: "scan_threshold_summary" },
  on_start: trial => {
    trial.data.initial_scan_threshold_ms = jsPsych.data.get()
      .filter({ phase: "scan_threshold_initial_summary" }).select("initial_scan_threshold_ms").values[0];
    trial.data.scan_threshold_ms = participantEncodingTime();
    trial.data.encoding_time_ms = participantEncodingTime();
    trial.data.scan_check_trials = scanCheckState.trialCount;
    trial.data.scan_check_direction = scanCheckState.direction;
    trial.data.scan_check_hit_safety_limit = scanCheckState.hitSafetyLimit;
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
  timeline.push(confirmPage(`<h2>Session ${sessionId}</h2>
    <p>本阶段中，两个选项的金额和时间会在你思考时被随机字符覆盖。覆盖后，请立即在横线上点击，报告覆盖那一刻的偏好。</p>`, {
    phase: "session_start",
    session_id: sessionId
  }));
  specs.forEach((spec, index) => {
    timeline.push(mouseCenterTrial("probe_mouse_center", sessionId, index));
    timeline.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="fixation">+</div>', choices: "NO_KEYS", trial_duration: 500 });
    timeline.push(probeTrial(spec, sessionId, index));
  });
});

timeline.push(spacePage("<h2>实验结束</h2><p>感谢你的参与。</p>", { phase: "experiment_end" }));

timeline.push({ type: jsPsychFullscreen, fullscreen_mode: false, delay_after: 0 });
jsPsych.run(timeline);
