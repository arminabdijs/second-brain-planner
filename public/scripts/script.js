"use strict";

const STORAGE_KEY = "google_m3_second_brain_v7_24h";
const TIMER_STORAGE_KEY = `${STORAGE_KEY}_timer_v4`;

function getTehranShamsiDateKey(offsetDays = 0) {
  const targetDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(targetDate);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return `${year}/${month}/${day}`;
}

function getDetailedShamsiDate(offsetDays = 0) {
  const targetDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return formatter.format(targetDate);
}

function getPast30DaysCompactLabels() {
  const labels = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
      timeZone: "Asia/Tehran",
      day: "numeric",
    }).format(targetDate);

    const weekLetter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      weekday: "narrow",
    }).format(targetDate);

    labels.push([dayNum, weekLetter]);
  }

  return labels;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const DEFAULT_ROUTINE_SPANS = [
  {
    id: 101,
    start: "00:00",
    end: "06:15",
    title: "خواب عمیق و ریکاوری",
    type: "fitness",
    done: false,
  },
  {
    id: 102,
    start: "06:15",
    end: "06:45",
    title: "بیداری، کشش و صبحانه",
    type: "routine",
    done: false,
  },
  {
    id: 103,
    start: "06:45",
    end: "07:45",
    title: "زبان انگلیسی",
    type: "deep",
    done: false,
  },
  {
    id: 104,
    start: "07:45",
    end: "08:00",
    title: "استراحت و چای",
    type: "fitness",
    done: false,
  },
  {
    id: 105,
    start: "08:00",
    end: "10:30",
    title: "توسعه عمیق جاوااسکریپت",
    type: "deep",
    done: false,
  },
  {
    id: 106,
    start: "10:30",
    end: "11:00",
    title: "پیاده‌روی و استراحت",
    type: "fitness",
    done: false,
  },
  {
    id: 107,
    start: "11:00",
    end: "13:00",
    title: "تمرین و حل چالش‌های الگوریتم",
    type: "deep",
    done: false,
  },
  {
    id: 108,
    start: "13:00",
    end: "14:30",
    title: "ناهار و استراحت نیمروزی",
    type: "routine",
    done: false,
  },
  {
    id: 109,
    start: "14:30",
    end: "17:00",
    title: "پروژه‌های اجرایی و توسعه",
    type: "deep",
    done: false,
  },
  {
    id: 110,
    start: "17:00",
    end: "18:00",
    title: "ورزش و فعالیت بدنی",
    type: "fitness",
    done: false,
  },
  {
    id: 111,
    start: "18:00",
    end: "20:30",
    title: "مطالعه آزاد و بازبینی کدها",
    type: "deep",
    done: false,
  },
  {
    id: 112,
    start: "20:30",
    end: "23:00",
    title: "شام، خانواده و روتین شبانگاهی",
    type: "routine",
    done: false,
  },
];

const defaultState = {
  activeDate: getTehranShamsiDateKey(),
  dailyFocus: "",
  tasks: [],
  habits: [],
  projects: [],
  timeBlocks: {},
  customSpans: JSON.parse(JSON.stringify(DEFAULT_ROUTINE_SPANS)),
  daysArchive: {},
  history: {},
};

function loadState() {
  try {
    const item = localStorage.getItem(STORAGE_KEY);

    if (!item) {
      return JSON.parse(JSON.stringify(defaultState));
    }

    const parsed = JSON.parse(item);

    if (!parsed.activeDate) {
      parsed.activeDate = getTehranShamsiDateKey();
    }

    if (typeof parsed.dailyFocus !== "string") {
      parsed.dailyFocus = "";
    }

    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = [];
    }

    if (!Array.isArray(parsed.habits)) {
      parsed.habits = [];
    }

    if (!Array.isArray(parsed.projects)) {
      parsed.projects = [];
    }

    if (!Array.isArray(parsed.customSpans)) {
      parsed.customSpans = [];
    }

    if (!parsed.timeBlocks || typeof parsed.timeBlocks !== "object") {
      parsed.timeBlocks = {};
    }

    if (!parsed.daysArchive || typeof parsed.daysArchive !== "object") {
      parsed.daysArchive = {};
    }

    if (!parsed.history || typeof parsed.history !== "object") {
      parsed.history = {};
    }

    return parsed;
  } catch (e) {
    console.error("Load state error:", e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

let state = loadState();

let currentTaskFilter = "all";
let editingHour = null;
let chartInstance = null;
let activeTimelineTab = "custom";

let alarmAudioElement = null;
let alarmSourceNode = null;
let alarmGainNode = null;
let testSoundTimeout = null;
let alarmBufferCache = new Map();

let currentAlarmSetting = localStorage.getItem("chosen_alarm_sound") || "synth-bell";

let customAudioDataUrl = localStorage.getItem("custom_alarm_data_url") || null;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    updateParaCounters();
    calculatePerformanceScore();
  } catch (e) {
    console.error("Save error:", e);
  }
}

function ensureSpansAvailable() {
  if (!Array.isArray(state.customSpans) || state.customSpans.length === 0) {
    let foundInArchive = false;

    if (state.daysArchive) {
      const dates = Object.keys(state.daysArchive);

      for (let i = dates.length - 1; i >= 0; i--) {
        const d = state.daysArchive[dates[i]];

        if (d && Array.isArray(d.customSpans) && d.customSpans.length > 0) {
          state.customSpans = d.customSpans.map((s) => ({
            ...s,
            done: false,
          }));

          foundInArchive = true;
          break;
        }
      }
    }

    if (!foundInArchive) {
      state.customSpans = JSON.parse(JSON.stringify(DEFAULT_ROUTINE_SPANS));
    }

    saveState();
  }
}

function checkDayRollover() {
  const todayTehran = getTehranShamsiDateKey();

  if (!state.activeDate || state.activeDate !== todayTehran) {
    const prevDate = state.activeDate || getTehranShamsiDateKey(-1);

    state.daysArchive[prevDate] = {
      dailyFocus: state.dailyFocus,
      timeBlocks: { ...state.timeBlocks },
      customSpans: state.customSpans.map((s) => ({
        ...s,
      })),
      tasks: state.tasks.map((t) => ({
        ...t,
      })),
      habits: state.habits.map((h) => ({
        ...h,
      })),
    };

    const hTotal = state.habits.length;
    const hDone = state.habits.filter((h) => h.doneToday).length;

    const hScore = hTotal ? (hDone / hTotal) * 40 : 0;

    const tTotal = state.tasks.length;
    const tDone = state.tasks.filter((t) => t.done).length;

    const tScore = tTotal ? (tDone / tTotal) * 40 : 0;

    const spanDone = state.customSpans.filter((s) => s.done).length;

    const blockTotal = Object.keys(state.timeBlocks).length;

    const bScore = Math.min(20, ((spanDone + blockTotal) / 5) * 20);

    state.history[prevDate] = Math.round(hScore + tScore + bScore);

    state.habits.forEach((h) => {
      if (!h.doneToday) {
        h.streak = 0;
      }

      h.doneToday = false;
    });

    state.tasks.forEach((t) => {
      t.done = false;
    });

    state.customSpans.forEach((s) => {
      s.done = false;
    });

    state.timeBlocks = {};
    state.dailyFocus = "";
    state.activeDate = todayTehran;
    state.history[todayTehran] = 0;

    saveState();

    const focusInput = document.getElementById("dailyFocusInput");

    if (focusInput) {
      focusInput.value = "";
    }

    renderTasks();
    renderHabits();
    renderTimeline();
    renderProjects();
    initChart();
  }
}

setInterval(checkDayRollover, 10000);

const persianWeekDays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه"];

function updateLiveClock() {
  const now = new Date();

  const tehranTimeStr = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Tehran",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const [hours, minutes, seconds] = tehranTimeStr.split(":");

  const hElem = document.getElementById("clockHours");

  const mElem = document.getElementById("clockMinutes");

  const sElem = document.getElementById("clockSeconds");

  const dElem = document.getElementById("dayNameDisplay");

  const dateElem = document.getElementById("dateDisplay");

  if (hElem) {
    hElem.textContent = hours;
  }

  if (mElem) {
    mElem.textContent = minutes;
  }

  if (sElem) {
    sElem.textContent = seconds;
  }

  if (dElem) {
    const tehranDayIndex = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Tehran",
      }),
    ).getDay();

    dElem.textContent = persianWeekDays[tehranDayIndex];
  }

  if (dateElem) {
    const dateOptions = {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    };

    dateElem.textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", dateOptions).format(now);
  }
}

setInterval(updateLiveClock, 1000);

function updateDailyFocus(val) {
  state.dailyFocus = val;
  saveState();
}

let sharedAudioCtx = null;

function getAudioContext() {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    return sharedAudioCtx;
  } catch (e) {
    console.warn("AudioContext error:", e);
    return null;
  }
}

async function resumeAudioContext() {
  const ctx = getAudioContext();

  if (!ctx) {
    return null;
  }

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch (e) {
    console.warn("AudioContext resume error:", e);
  }

  return ctx;
}

function primeAudio() {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function playSynthesizedSound(type) {
  try {
    const ctx = getAudioContext();

    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;

    if (type === "synth-digital") {
      [880, 1174, 1480].forEach((freq, i) => {
        const osc = ctx.createOscillator();

        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "square";

        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.12, now + i * 0.1);

        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.08);

        osc.start(now + i * 0.1);

        osc.stop(now + i * 0.1 + 0.09);
      });
    } else if (type === "synth-zen") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();

        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";

        osc.frequency.setValueAtTime(freq, now + i * 0.18);

        gain.gain.setValueAtTime(0.15, now + i * 0.18);

        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 1.2);

        osc.start(now + i * 0.1);

        osc.stop(now + i * 0.1 + 0.19);
      });
    } else {
      const osc = ctx.createOscillator();

      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";

      osc.frequency.setValueAtTime(659.25, now);

      gain.gain.setValueAtTime(0.25, now);

      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      osc.start(now);
      osc.stop(now + 1.5);
    }
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

function createAlarmBuffer(type) {
  const ctx = getAudioContext();

  if (!ctx) {
    return null;
  }

  if (alarmBufferCache.has(type)) {
    return alarmBufferCache.get(type);
  }

  const sampleRate = ctx.sampleRate;

  let duration = 3.2;

  if (type === "synth-digital") {
    duration = 2.4;
  } else if (type === "synth-zen") {
    duration = 5.4;
  }

  const frameCount = Math.floor(sampleRate * duration);

  const buffer = ctx.createBuffer(1, frameCount, sampleRate);

  const data = buffer.getChannelData(0);

  function addTone({ start, frequency, length, volume, waveform = "sine", decay = 4 }) {
    const startIndex = Math.floor(start * sampleRate);

    const endIndex = Math.min(frameCount, startIndex + Math.floor(length * sampleRate));

    for (let i = startIndex; i < endIndex; i++) {
      const t = (i - startIndex) / sampleRate;

      const progress = t / length;

      let wave;

      if (waveform === "square") {
        wave = Math.sin(2 * Math.PI * frequency * t) >= 0 ? 1 : -1;
      } else if (waveform === "triangle") {
        wave = 2 * Math.abs(2 * (frequency * t - Math.floor(frequency * t + 0.5))) - 1;
      } else {
        wave = Math.sin(2 * Math.PI * frequency * t);
      }

      const attack = Math.min(1, progress * 80);

      const release = Math.max(0, 1 - progress);

      const envelope = Math.pow(attack * release, Math.max(1, decay));

      data[i] += wave * volume * envelope;
    }
  }

  if (type === "synth-digital") {
    const tones = [880, 1174, 1480, 1174, 880, 1480];

    tones.forEach((frequency, index) => {
      addTone({
        start: index * 0.16,
        frequency,
        length: 0.12,
        volume: 0.18,
        waveform: "square",
        decay: 1.8,
      });
    });

    tones.forEach((frequency, index) => {
      addTone({
        start: 1.35 + index * 0.16,
        frequency: frequency / 2,
        length: 0.12,
        volume: 0.14,
        waveform: "square",
        decay: 1.8,
      });
    });
  } else if (type === "synth-zen") {
    const notes = [
      [523.25, 0],
      [659.25, 0.45],
      [783.99, 0.9],
      [1046.5, 1.35],
      [783.99, 2.15],
      [659.25, 2.6],
      [523.25, 3.05],
    ];

    notes.forEach(([frequency, start]) => {
      addTone({
        start,
        frequency,
        length: 1.25,
        volume: 0.12,
        waveform: "sine",
        decay: 2.2,
      });
    });
  } else {
    const bells = [
      {
        start: 0,
        frequency: 659.25,
      },
      {
        start: 0.12,
        frequency: 987.77,
      },
      {
        start: 0.24,
        frequency: 1318.51,
      },
      {
        start: 1.55,
        frequency: 659.25,
      },
      {
        start: 1.67,
        frequency: 987.77,
      },
      {
        start: 1.79,
        frequency: 1318.51,
      },
    ];

    bells.forEach(({ start, frequency }) => {
      addTone({
        start,
        frequency,
        length: 1.05,
        volume: 0.18,
        waveform: "sine",
        decay: 1.9,
      });

      addTone({
        start,
        frequency: frequency * 2,
        length: 0.8,
        volume: 0.045,
        waveform: "sine",
        decay: 2.2,
      });
    });
  }

  alarmBufferCache.set(type, buffer);

  return buffer;
}

function playContinuousSynthAlarm(type) {
  stopAlarmPlayback();

  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  const startPlayback = () => {
    try {
      if (ctx.state !== "running") {
        return;
      }

      const buffer = createAlarmBuffer(type);

      if (!buffer) {
        return;
      }

      alarmSourceNode = ctx.createBufferSource();

      alarmGainNode = ctx.createGain();

      alarmSourceNode.buffer = buffer;

      alarmSourceNode.loop = true;

      alarmGainNode.gain.setValueAtTime(0.38, ctx.currentTime);

      alarmSourceNode.connect(alarmGainNode);

      alarmGainNode.connect(ctx.destination);

      alarmSourceNode.start(0);
    } catch (e) {
      console.warn("Continuous alarm error:", e);
    }
  };

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(startPlayback)
      .catch(() => {});
  } else {
    startPlayback();
  }
}

function playBeep() {
  playSynthesizedSound("synth-digital");
}

function triggerAlarmPlayback() {
  stopAlarmPlayback();

  if (currentAlarmSetting.startsWith("synth-")) {
    playContinuousSynthAlarm(currentAlarmSetting);

    return;
  }

  if (currentAlarmSetting === "custom-file" && customAudioDataUrl) {
    try {
      alarmAudioElement = new Audio(customAudioDataUrl);

      alarmAudioElement.loop = true;

      alarmAudioElement.preload = "auto";

      alarmAudioElement.volume = 1;

      alarmAudioElement.currentTime = 0;

      const promise = alarmAudioElement.play();

      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {
          playContinuousSynthAlarm("synth-bell");
        });
      }
    } catch (e) {
      playContinuousSynthAlarm("synth-bell");
    }

    return;
  }

  playContinuousSynthAlarm("synth-bell");
}

function stopAlarmPlayback() {
  if (alarmSourceNode) {
    try {
      alarmSourceNode.stop();
    } catch (e) {}

    try {
      alarmSourceNode.disconnect();
    } catch (e) {}

    alarmSourceNode = null;
  }

  if (alarmGainNode) {
    try {
      alarmGainNode.disconnect();
    } catch (e) {}

    alarmGainNode = null;
  }

  if (alarmAudioElement) {
    try {
      alarmAudioElement.pause();
      alarmAudioElement.currentTime = 0;
      alarmAudioElement.removeAttribute("src");
      alarmAudioElement.load();
    } catch (e) {}

    alarmAudioElement = null;
  }

  if (testSoundTimeout) {
    clearTimeout(testSoundTimeout);

    testSoundTimeout = null;
  }
}

function showAlarmModal() {
  const isWork = timerMode === "work";

  const titleElem = document.getElementById("alarmTitle");

  const subtitleElem = document.getElementById("alarmSubtitle");

  if (titleElem) {
    titleElem.textContent = isWork ? "زمان تمرکز به پایان رسید!" : "استراحت پایان یافت!";
  }

  if (subtitleElem) {
    subtitleElem.textContent = isWork ? "یک بازه کاری را به پایان رساندید. وقت استراحت است." : "استراحت پایان یافت. آماده شروع تمرکز عمیق شوید.";
  }

  const select = document.getElementById("alarmSoundSelect");

  if (select) {
    select.value = currentAlarmSetting;

    toggleCustomUploadBox(currentAlarmSetting);
  }

  openModal("alarmModal");

  triggerAlarmPlayback();
}

function dismissAlarm(shouldSwitchMode = true) {
  stopAlarmPlayback();

  closeModal("alarmModal");

  if (shouldSwitchMode) {
    switchTimerMode();
  } else {
    resetTimer();
  }
}

function changeAlarmSound(val) {
  currentAlarmSetting = val;

  localStorage.setItem("chosen_alarm_sound", val);

  toggleCustomUploadBox(val);
}

function toggleCustomUploadBox(val) {
  const box = document.getElementById("customSoundUploadBox");

  if (!box) {
    return;
  }

  if (val === "custom-file") {
    box.classList.remove("hidden");

    const savedName = localStorage.getItem("custom_alarm_filename");

    const fileLabel = document.getElementById("customFileName");

    if (savedName && fileLabel) {
      fileLabel.textContent = `فایل فعال: ${savedName}`;
    }
  } else {
    box.classList.add("hidden");
  }
}

function handleCustomAudioFile(event) {
  const file = event.target?.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      customAudioDataUrl = e.target.result;

      localStorage.setItem("custom_alarm_data_url", customAudioDataUrl);

      localStorage.setItem("custom_alarm_filename", file.name);

      const fileLabel = document.getElementById("customFileName");

      if (fileLabel) {
        fileLabel.textContent = `فایل فعال: ${file.name}`;
      }

      currentAlarmSetting = "custom-file";

      localStorage.setItem("chosen_alarm_sound", "custom-file");
    } catch (e) {
      console.error("Custom audio save error:", e);

      alert("ذخیره فایل صدا انجام نشد. ممکن است حجم فایل از ظرفیت localStorage بیشتر باشد.");
    }
  };

  reader.readAsDataURL(file);
}

function testCurrentAlarmSound() {
  stopAlarmPlayback();

  primeAudio();

  triggerAlarmPlayback();

  testSoundTimeout = setTimeout(stopAlarmPlayback, 5000);
}

let timerTotalSeconds = 25 * 60;

let timerRemaining = 25 * 60;

let timerInterval = null;

let timerMode = "work";

let timerDeadline = null;

let timerAlarmPending = false;

let timerCompletionHandled = false;

function saveTimerState() {
  try {
    const timerState = {
      version: 4,
      mode: timerMode,
      totalSeconds: timerTotalSeconds,
      remaining: timerRemaining,
      deadline: timerDeadline,
      running: timerInterval !== null && timerDeadline !== null,
      alarmPending: timerAlarmPending,
      savedAt: Date.now(),
    };

    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
  } catch (e) {
    console.error("Timer state save error:", e);
  }
}

function renderTimerNumbers() {
  const safeRemaining = Math.max(0, Math.floor(Number.isFinite(timerRemaining) ? timerRemaining : 0));

  const mins = Math.floor(safeRemaining / 60);

  const secs = safeRemaining % 60;

  const inputMin = document.getElementById("inputTimerMin");

  const inputSec = document.getElementById("inputTimerSec");

  if (inputMin && document.activeElement !== inputMin) {
    inputMin.value = String(mins).padStart(2, "0");
  }

  if (inputSec && document.activeElement !== inputSec) {
    inputSec.value = String(secs).padStart(2, "0");
  }
}

function onTimerInputFocus(input) {
  if (timerInterval || timerDeadline !== null) {
    pauseTimer();
  }

  input.select();
}

function onTimerInputKeyDown(e, input) {
  if (e.key === "Enter") {
    e.preventDefault();
    input.blur();
  }
}

function onTimerMinBlur(input) {
  let val = parseInt(input.value, 10);

  if (Number.isNaN(val)) {
    val = 0;
  }

  val = Math.max(0, Math.min(180, val));

  input.value = String(val).padStart(2, "0");

  syncTimerFromInputs();
}

function onTimerSecBlur(input) {
  let val = parseInt(input.value, 10);

  if (Number.isNaN(val)) {
    val = 0;
  }

  val = Math.max(0, Math.min(59, val));

  input.value = String(val).padStart(2, "0");

  syncTimerFromInputs();
}

function syncTimerFromInputs() {
  const minElem = document.getElementById("inputTimerMin");

  const secElem = document.getElementById("inputTimerSec");

  const m = parseInt(minElem?.value ?? "25", 10) || 0;

  const s = parseInt(secElem?.value ?? "0", 10) || 0;

  const total = m * 60 + s;

  timerTotalSeconds = total > 0 ? total : 60;

  timerRemaining = timerTotalSeconds;

  timerDeadline = null;

  timerAlarmPending = false;

  timerCompletionHandled = false;

  updateTimerBadge();
  renderTimerNumbers();
  updateTimerButtonUI();
  saveTimerState();
}

function updateTimerButtonUI() {
  const btn = document.getElementById("btnTimerToggle");

  if (!btn) {
    return;
  }

  if (timerInterval) {
    btn.innerHTML = `
      <span class="material-symbols-rounded text-sm filled">
        pause
      </span>
      <span>توقف</span>
    `;

    btn.className = "px-4 py-2 text-xs font-bold rounded-full " + "bg-[#f2b8b5] text-[#601410] " + "hover:bg-[#ffdad6] transition " + "flex items-center gap-1";
  } else {
    btn.innerHTML = `
      <span class="material-symbols-rounded text-sm filled">
        play_arrow
      </span>
      <span>شروع</span>
    `;

    btn.className = "px-4 py-2 text-xs font-bold rounded-full " + "bg-[#a8c7fa] text-[#04305c] " + "hover:bg-[#c2e7ff] transition " + "flex items-center gap-1";
  }
}

function syncTimerRemaining() {
  if (timerDeadline === null) {
    return;
  }

  const remainingMs = timerDeadline - Date.now();

  timerRemaining = Math.max(0, Math.ceil(remainingMs / 1000));

  renderTimerNumbers();

  if (remainingMs <= 0) {
    finishTimer();
  }
}

function startTimerLoop() {
  if (timerInterval) {
    return;
  }

  timerInterval = setInterval(syncTimerRemaining, 250);

  syncTimerRemaining();
  updateTimerButtonUI();
}

function finishTimer() {
  if (timerCompletionHandled) {
    return;
  }

  timerCompletionHandled = true;

  if (timerInterval) {
    clearInterval(timerInterval);

    timerInterval = null;
  }

  timerDeadline = null;
  timerRemaining = 0;
  timerAlarmPending = true;

  saveTimerState();

  renderTimerNumbers();
  updateTimerButtonUI();

  if (document.readyState === "interactive" || document.readyState === "complete") {
    showAlarmModal();
  }
}

function startTimer() {
  primeAudio();

  if (!Number.isFinite(timerRemaining) || timerRemaining <= 0) {
    timerRemaining = timerTotalSeconds;
  }

  timerDeadline = Date.now() + timerRemaining * 1000;

  timerAlarmPending = false;

  timerCompletionHandled = false;

  saveTimerState();
  startTimerLoop();
}

function pauseTimer() {
  if (timerDeadline !== null) {
    const remainingMs = timerDeadline - Date.now();

    timerRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
  }

  if (timerInterval) {
    clearInterval(timerInterval);

    timerInterval = null;
  }

  timerDeadline = null;
  timerCompletionHandled = false;

  renderTimerNumbers();
  updateTimerButtonUI();
  saveTimerState();
}

function toggleTimer() {
  if (timerInterval) {
    pauseTimer();
    return;
  }

  if (!Number.isFinite(timerRemaining) || timerRemaining <= 0) {
    timerRemaining = timerTotalSeconds;
  }

  startTimer();
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);

    timerInterval = null;
  }

  timerDeadline = null;
  timerAlarmPending = false;
  timerCompletionHandled = false;
  timerRemaining = timerTotalSeconds;

  renderTimerNumbers();
  updateTimerButtonUI();
  saveTimerState();
}

function switchTimerMode() {
  if (timerInterval) {
    clearInterval(timerInterval);

    timerInterval = null;
  }

  timerDeadline = null;
  timerAlarmPending = false;
  timerCompletionHandled = false;

  if (timerMode === "work") {
    timerMode = "break";

    timerTotalSeconds = 5 * 60;

    timerRemaining = timerTotalSeconds;
  } else {
    timerMode = "work";

    timerTotalSeconds = 25 * 60;

    timerRemaining = timerTotalSeconds;
  }

  updateTimerBadge();
  renderTimerNumbers();
  updateTimerButtonUI();
  saveTimerState();
}

function restoreTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);

    if (!raw) {
      updateTimerBadge();
      renderTimerNumbers();
      updateTimerButtonUI();
      return;
    }

    const saved = JSON.parse(raw);

    if (!saved || typeof saved !== "object") {
      return;
    }

    if (saved.mode === "work" || saved.mode === "break") {
      timerMode = saved.mode;
    }

    if (Number.isFinite(saved.totalSeconds) && saved.totalSeconds > 0) {
      timerTotalSeconds = Math.floor(saved.totalSeconds);
    }

    if (Number.isFinite(saved.remaining) && saved.remaining >= 0) {
      timerRemaining = saved.remaining;
    } else {
      timerRemaining = timerTotalSeconds;
    }

    timerAlarmPending = Boolean(saved.alarmPending);

    if (saved.deadline !== null && Number.isFinite(saved.deadline)) {
      timerDeadline = Number(saved.deadline);
    } else {
      timerDeadline = null;
    }

    if (timerDeadline !== null) {
      const remainingMs = timerDeadline - Date.now();

      if (remainingMs > 0) {
        timerRemaining = Math.ceil(remainingMs / 1000);

        timerAlarmPending = false;

        timerCompletionHandled = false;

        updateTimerBadge();
        renderTimerNumbers();
        startTimerLoop();

        return;
      }

      timerDeadline = null;

      timerRemaining = 0;
      timerAlarmPending = true;
      timerCompletionHandled = false;

      saveTimerState();

      updateTimerBadge();
      renderTimerNumbers();
      updateTimerButtonUI();

      return;
    }

    updateTimerBadge();
    renderTimerNumbers();
    updateTimerButtonUI();
  } catch (e) {
    console.error("Timer restore error:", e);

    timerDeadline = null;
    timerAlarmPending = false;
    timerCompletionHandled = false;
  }
}

function updateTimerBadge() {
  const badge = document.getElementById("timerBadge");

  if (!badge) {
    return;
  }

  if (timerMode === "break") {
    badge.textContent = `استراحت (${Math.ceil(timerTotalSeconds / 60)} دقیقه)`;

    badge.className = "text-[10px] px-2.5 py-0.5 rounded-full " + "bg-[#173822] text-[#85e4a0] font-medium";
  } else {
    badge.textContent = `تمرکز (${Math.ceil(timerTotalSeconds / 60)} دقیقه)`;

    badge.className = "text-[10px] px-2.5 py-0.5 rounded-full " + "bg-[#0842a0] text-[#d3e3fd] font-medium";
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncTimerRemaining();

    if (timerDeadline !== null && !timerInterval) {
      startTimerLoop();
    }

    if (timerAlarmPending && !alarmSourceNode && !alarmAudioElement) {
      showAlarmModal();
    }

    updateTimerButtonUI();
  }
});

window.addEventListener("focus", () => {
  syncTimerRemaining();

  if (timerDeadline !== null && !timerInterval) {
    startTimerLoop();
  }

  updateTimerButtonUI();
});

window.addEventListener("pageshow", () => {
  syncTimerRemaining();

  if (timerDeadline !== null && !timerInterval) {
    startTimerLoop();
  }

  if (timerAlarmPending && !alarmSourceNode && !alarmAudioElement) {
    showAlarmModal();
  }

  updateTimerButtonUI();
});

window.addEventListener("pagehide", () => {
  if (timerDeadline !== null) {
    saveTimerState();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== TIMER_STORAGE_KEY) {
    return;
  }

  if (!event.newValue) {
    return;
  }

  restoreTimerState();
});

document.addEventListener("pointerdown", primeAudio, {
  once: true,
  passive: true,
});

function filterTasks(type) {
  currentTaskFilter = type;

  ["all", "high", "pending"].forEach((t) => {
    const btn = document.getElementById(`filter-${t}`);

    if (btn) {
      if (t === type) {
        btn.className = "text-[10px] px-3 py-1 rounded-full " + "bg-[#a8c7fa] text-[#04305c] " + "font-bold transition";
      } else {
        btn.className = "text-[10px] px-3 py-1 rounded-full " + "bg-[#272a31] text-[#8e9198] transition";
      }
    }
  });

  renderTasks();
}

function renderTasks() {
  const container = document.getElementById("tasksList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  let list = state.tasks;

  if (currentTaskFilter === "high") {
    list = state.tasks.filter((t) => t.priority === "high");
  } else if (currentTaskFilter === "pending") {
    list = state.tasks.filter((t) => !t.done);
  }

  const doneCount = state.tasks.filter((t) => t.done).length;

  const counterElem = document.getElementById("tasksCounter");

  if (counterElem) {
    counterElem.textContent = `${doneCount} / ${state.tasks.length}`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-xs text-[#8e9198]">
        تسکی در این بخش وجود ندارد
      </div>
    `;

    return;
  }

  list.forEach((task) => {
    const project = state.projects.find((p) => p.id === task.projectId);

    const card = document.createElement("div");

    card.className = "flex items-center justify-between " + "p-2.5 rounded-2xl " + "bg-[#171a1f] border border-[#2d3139] " + "hover:border-[#44474e] transition group";

    let badge = "bg-[#272a31] text-[#c4c7c5]";

    let badgeText = "عادی";

    if (task.priority === "high") {
      badge = "bg-[#410002] text-[#ffdad6]";

      badgeText = "فوری";
    } else if (task.priority === "medium") {
      badge = "bg-[#3b2d00] text-[#ffe08b]";

      badgeText = "مهم";
    }

    card.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 overflow-hidden ml-2">
        <button
          onclick="toggleTask(${task.id})"
          class="w-5 h-5 rounded-lg border flex items-center justify-center transition flex-shrink-0 ${task.done ? "bg-[#a8c7fa] border-[#a8c7fa] text-[#04305c]" : "border-[#44474e] hover:border-[#a8c7fa]"}"
        >
          ${task.done ? '<span class="material-symbols-rounded text-sm font-bold">check</span>' : ""}
        </button>

        <div class="flex flex-col truncate">
          <span class="text-xs ${task.done ? "line-through text-[#8e9198]" : "text-[#e2e2e6]"} truncate">
            ${escapeHtml(task.title)}
          </span>

          ${
            project
              ? `
                <span class="text-[10px] text-[#d0bcff] truncate">
                  ${escapeHtml(project.title)}
                </span>
              `
              : ""
          }
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-[9px] px-2 py-0.5 rounded-full font-medium ${badge}">
          ${badgeText}
        </span>

        <button
          onclick="deleteTask(${task.id})"
          class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5"
        >
          <span class="material-symbols-rounded text-sm">
            close
          </span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);

  if (!task) {
    return;
  }

  task.done = !task.done;

  saveState();
  renderTasks();
  renderProjects();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);

  saveState();
  renderTasks();
  renderProjects();
}

function createTask() {
  const titleInput = document.getElementById("taskTitleInput");

  const title = titleInput?.value.trim();

  const priority = document.getElementById("taskPriorityInput")?.value;

  const projectId = parseInt(document.getElementById("taskProjectSelect")?.value, 10) || null;

  if (!title) {
    return;
  }

  state.tasks.push({
    id: Date.now(),
    title,
    priority,
    projectId,
    done: false,
  });

  saveState();
  renderTasks();
  renderProjects();
  closeModal("taskModal");

  if (titleInput) {
    titleInput.value = "";
  }
}

function renderHabits() {
  const container = document.getElementById("habitsList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const total = state.habits.length;

  const done = state.habits.filter((h) => h.doneToday).length;

  const score = total ? Math.round((done / total) * 100) : 0;

  const scoreBadge = document.getElementById("habitsScore");

  if (scoreBadge) {
    scoreBadge.textContent = `${score}%`;
  }

  if (total === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-xs text-[#8e9198]">
        عادت فعالی تعریف نشده است
      </div>
    `;

    return;
  }

  state.habits.forEach((h) => {
    const card = document.createElement("div");

    card.className = "flex items-center justify-between " + "p-2.5 rounded-2xl " + "bg-[#171a1f] border border-[#2d3139] group";

    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <button
          onclick="toggleHabit(${h.id})"
          class="w-6 h-6 rounded-lg border flex items-center justify-center transition ${h.doneToday ? "bg-[#6dd58c] border-[#6dd58c] text-[#0a3818]" : "border-[#44474e] hover:border-[#6dd58c]"}"
        >
          ${h.doneToday ? '<span class="material-symbols-rounded text-sm font-bold">check</span>' : ""}
        </button>

        <span class="text-xs ${h.doneToday ? "text-[#8e9198] line-through" : "text-[#e2e2e6]"}">
          ${escapeHtml(h.title)}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[10px] m3-num-font text-[#ffd99f] bg-[#3b2d00] px-2 py-0.5 rounded-full flex items-center gap-0.5">
          🔥 ${h.streak || 0} روز
        </span>

        <button
          onclick="deleteHabit(${h.id})"
          class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5"
        >
          <span class="material-symbols-rounded text-sm">
            close
          </span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function toggleHabit(id) {
  const habit = state.habits.find((h) => h.id === id);

  if (!habit) {
    return;
  }

  habit.doneToday = !habit.doneToday;

  if (habit.doneToday) {
    habit.streak = (habit.streak || 0) + 1;
  } else {
    habit.streak = Math.max(0, (habit.streak || 1) - 1);
  }

  saveState();
  renderHabits();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);

  saveState();
  renderHabits();
}

function createHabit() {
  const input = document.getElementById("habitTitleInput");

  const title = input?.value.trim();

  if (!title) {
    return;
  }

  state.habits.push({
    id: Date.now(),
    title,
    streak: 0,
    doneToday: false,
  });

  saveState();
  renderHabits();
  closeModal("habitModal");

  if (input) {
    input.value = "";
  }
}

function renderProjects() {
  const container = document.getElementById("projectsList");

  const select = document.getElementById("taskProjectSelect");

  if (!container || !select) {
    return;
  }

  container.innerHTML = "";

  select.innerHTML = '<option value="">مستقل (بدون پروژه)</option>';

  const pCount = document.getElementById("projectsCount");

  if (pCount) {
    pCount.textContent = `${state.projects.length} پروژه`;
  }

  if (state.projects.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-xs text-[#8e9198]">
        پروژه‌ای ثبت نشده است
      </div>
    `;

    return;
  }

  state.projects.forEach((p) => {
    const pTasks = state.tasks.filter((t) => t.projectId === p.id);

    const progress = pTasks.length ? Math.round((pTasks.filter((t) => t.done).length / pTasks.length) * 100) : 0;

    const opt = document.createElement("option");

    opt.value = p.id;
    opt.textContent = p.title;

    select.appendChild(opt);

    const card = document.createElement("div");

    card.className = "p-3 rounded-2xl bg-[#171a1f] " + "border border-[#2d3139] group";

    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[#e2e2e6]">
            ${escapeHtml(p.title)}
          </span>

          <span class="text-[9px] px-2 py-0.5 rounded-full bg-[#381e72] text-[#e8def8]">
            ${escapeHtml(p.category || "عمومی")}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs m3-num-font text-[#d0bcff] font-bold">
            ${progress}%
          </span>

          <button
            onclick="deleteProject(${p.id})"
            class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5"
          >
            <span class="material-symbols-rounded text-sm">
              close
            </span>
          </button>
        </div>
      </div>

      <div class="w-full bg-[#272a31] h-1.5 rounded-full overflow-hidden">
        <div
          class="bg-[#d0bcff] h-full rounded-full transition-all duration-300"
          style="width: ${progress}%"
        ></div>
      </div>
    `;

    container.appendChild(card);
  });
}

function deleteProject(id) {
  state.projects = state.projects.filter((p) => p.id !== id);

  state.tasks.forEach((t) => {
    if (t.projectId === id) {
      t.projectId = null;
    }
  });

  saveState();
  renderProjects();
  renderTasks();
}

function createProject() {
  const titleInput = document.getElementById("projectTitleInput");

  const catInput = document.getElementById("projectCategoryInput");

  const title = titleInput?.value.trim();

  const category = catInput?.value.trim() || "عمومی";

  if (!title) {
    return;
  }

  state.projects.push({
    id: Date.now(),
    title,
    category,
  });

  saveState();
  renderProjects();
  closeModal("projectModal");

  if (titleInput) {
    titleInput.value = "";
  }

  if (catInput) {
    catInput.value = "";
  }
}

const hours24Full = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0") + ":00");

function switchTimelineTab(tab) {
  activeTimelineTab = tab;

  const btnGrid = document.getElementById("tabBtnGrid");

  const btnCustom = document.getElementById("tabBtnCustom");

  const viewGrid = document.getElementById("timelineGridView");

  const viewCustom = document.getElementById("timelineCustomView");

  if (!btnGrid || !btnCustom || !viewGrid || !viewCustom) {
    return;
  }

  if (tab === "grid") {
    btnGrid.className = "text-[10px] px-3 py-1 rounded-full " + "bg-[#a8c7fa] text-[#04305c] " + "font-bold transition";

    btnCustom.className = "text-[10px] px-3 py-1 rounded-full " + "text-[#8e9198] hover:text-white transition";

    viewGrid.classList.remove("hidden");

    viewCustom.classList.add("hidden");

    viewCustom.classList.remove("flex");
  } else {
    btnCustom.className = "text-[10px] px-3 py-1 rounded-full " + "bg-[#ffe08b] text-[#3f2e00] " + "font-bold transition";

    btnGrid.className = "text-[10px] px-3 py-1 rounded-full " + "text-[#8e9198] hover:text-white transition";

    viewGrid.classList.add("hidden");

    viewCustom.classList.remove("hidden");

    viewCustom.classList.add("flex");
  }
}

function renderTimeline() {
  render24HourGrid();
  renderCustomSpans();
  switchTimelineTab(activeTimelineTab);
}

function render24HourGrid() {
  const container = document.getElementById("timelineGridView");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const now = new Date();

  const tehranHour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  }).format(now);

  const currentHourStr = String(tehranHour).padStart(2, "0") + ":00";

  hours24Full.forEach((hour) => {
    const item = state.timeBlocks[hour];

    const isCurrent = hour === currentHourStr;

    const card = document.createElement("div");

    let style = "bg-[#171a1f] " + "border-[#2d3139] " + "text-[#8e9198] " + "hover:border-[#44474e]";

    if (item) {
      if (item.type === "deep") {
        style = "bg-[#004a77]/35 " + "border-[#004a77] " + "text-[#c2e7ff]";
      } else if (item.type === "meeting") {
        style = "bg-[#381e72]/35 " + "border-[#552e9c] " + "text-[#e8def8]";
      } else if (item.type === "fitness") {
        style = "bg-[#1b3724]/35 " + "border-[#265335] " + "text-[#85e4a0]";
      } else {
        style = "bg-[#3b2d00]/35 " + "border-[#574300] " + "text-[#ffd99f]";
      }
    }

    if (isCurrent) {
      style += " ring-1 ring-[#a8c7fa]";
    }

    card.className = `p-2 rounded-2xl border text-center ` + `transition cursor-pointer flex flex-col ` + `justify-center min-h-[58px] ${style}`;

    card.onclick = () => openBlockModal(hour);

    card.innerHTML = `
        <div class="text-[10px] m3-clock-font font-bold mb-0.5 flex items-center justify-center gap-1 ${isCurrent ? "text-[#a8c7fa]" : "text-[#8e9198]"}">
          <span>${hour}</span>

          ${
            isCurrent
              ? `
                <span
                  class="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] animate-ping"
                ></span>
              `
              : ""
          }
        </div>

        <div class="text-[10px] truncate font-medium">
          ${item ? escapeHtml(item.title) : "آزاد"}
        </div>
      `;

    container.appendChild(card);
  });
}

function renderCustomSpans() {
  const container = document.getElementById("timelineCustomView");

  const countBadge = document.getElementById("customSpansCount");

  if (!container) {
    return;
  }

  if (countBadge) {
    countBadge.textContent = state.customSpans.length;
  }

  container.innerHTML = "";

  if (state.customSpans.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-xs text-[#8e9198] flex flex-col items-center gap-2">
        <span class="material-symbols-rounded text-2xl">
          more_time
        </span>

        <span>
          هیچ بازه زمانی دلخواهی ثبت نشده است.
          دکمه «+ بازه دلخواه» را بزنید.
        </span>
      </div>
    `;

    return;
  }

  const sortedSpans = [...state.customSpans].sort((a, b) => a.start.localeCompare(b.start));

  sortedSpans.forEach((span) => {
    let badgeColor = "bg-[#004a77]/40 " + "text-[#c2e7ff] " + "border-[#004a77]";

    let typeName = "کار عمیق";

    if (span.type === "meeting") {
      badgeColor = "bg-[#381e72]/40 " + "text-[#e8def8] " + "border-[#552e9c]";

      typeName = "جلسه";
    } else if (span.type === "fitness") {
      badgeColor = "bg-[#1b3724]/40 " + "text-[#85e4a0] " + "border-[#265335]";

      typeName = "ورزش/استراحت";
    } else if (span.type === "routine") {
      badgeColor = "bg-[#3b2d00]/40 " + "text-[#ffd99f] " + "border-[#574300]";

      typeName = "روتین";
    }

    const item = document.createElement("div");

    item.className = "flex items-center justify-between " + "p-3 rounded-2xl " + "bg-[#171a1f] border border-[#2d3139] " + "hover:border-[#44474e] transition group " + (span.done ? "opacity-60" : "");

    item.innerHTML = `
        <div class="flex items-center gap-3">
          <button
            onclick="toggleCustomSpanDone(${span.id})"
            class="w-5 h-5 rounded-lg border flex items-center justify-center transition flex-shrink-0 ${span.done ? "bg-[#ffd99f] border-[#ffd99f] text-[#3b2d00]" : "border-[#44474e] hover:border-[#ffd99f]"}"
          >
            ${span.done ? '<span class="material-symbols-rounded text-sm font-bold">check</span>' : ""}
          </button>

          <div
            class="font-mono text-xs text-[#a8c7fa] bg-[#111318] px-2.5 py-1 rounded-xl border border-[#2d3139]"
            dir="ltr"
          >
            ${escapeHtml(span.start)} -
            ${escapeHtml(span.end)}
          </div>

          <div class="flex flex-col">
            <span class="text-xs font-bold ${span.done ? "line-through text-[#8e9198]" : "text-[#e2e2e6]"}">
              ${escapeHtml(span.title)}
            </span>

            <span class="text-[9px] text-[#8e9198]">
              ${typeName}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="text-[9px] px-2 py-0.5 rounded-full border ${badgeColor}"
          >
            ${typeName}
          </span>

          <button
            onclick="deleteCustomSpan(${span.id})"
            class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-1"
          >
            <span class="material-symbols-rounded text-sm">
              close
            </span>
          </button>
        </div>
      `;

    container.appendChild(item);
  });
}

function toggleCustomSpanDone(id) {
  const s = state.customSpans.find((item) => item.id === id);

  if (!s) {
    return;
  }

  s.done = !s.done;

  saveState();
  renderCustomSpans();
}

function openBlockModal(hour) {
  editingHour = hour;

  const titleElem = document.getElementById("timeBlockTitle");

  if (titleElem) {
    titleElem.textContent = `برنامه‌ریزی ساعت ${hour}`;
  }

  const cur = state.timeBlocks[hour];

  const titleInput = document.getElementById("timeBlockInput");

  const typeInput = document.getElementById("timeBlockType");

  if (titleInput) {
    titleInput.value = cur?.title || "";
  }

  if (typeInput) {
    typeInput.value = cur?.type || "deep";
  }

  openModal("timeBlockModal");
}

function saveActiveBlock() {
  if (!editingHour) {
    return;
  }

  const input = document.getElementById("timeBlockInput");

  const typeInput = document.getElementById("timeBlockType");

  const title = input?.value.trim() || "";

  const type = typeInput?.value || "deep";

  if (title) {
    state.timeBlocks[editingHour] = {
      title,
      type,
    };
  } else {
    delete state.timeBlocks[editingHour];
  }

  saveState();
  renderTimeline();
  closeModal("timeBlockModal");
}

function deleteActiveBlock() {
  if (!editingHour) {
    return;
  }

  delete state.timeBlocks[editingHour];

  saveState();
  renderTimeline();
  closeModal("timeBlockModal");
}

function openCustomBlockModal() {
  openModal("customBlockModal");
}

function saveCustomTimeSpan() {
  const start = document.getElementById("customStartTime")?.value || "";

  const end = document.getElementById("customEndTime")?.value || "";

  const title = document.getElementById("customActivityTitle")?.value.trim() || "";

  const type = document.getElementById("customActivityType")?.value || "deep";

  if (!title) {
    alert("لطفاً عنوان فعالیت را وارد کنید.");

    return;
  }

  state.customSpans.push({
    id: Date.now(),
    start,
    end,
    title,
    type,
    done: false,
  });

  saveState();
  renderTimeline();
  closeModal("customBlockModal");

  const titleInput = document.getElementById("customActivityTitle");

  if (titleInput) {
    titleInput.value = "";
  }

  switchTimelineTab("custom");
}

function deleteCustomSpan(id) {
  state.customSpans = state.customSpans.filter((s) => s.id !== id);

  saveState();
  renderTimeline();
}

function clearTimeline() {
  if (confirm("تمام بلوک‌های ساعتی و بازه‌های دلخواه پاکسازی شوند؟")) {
    state.timeBlocks = {};
    state.customSpans = [];

    saveState();
    renderTimeline();
  }
}

function updateParaCounters() {
  const pProj = document.getElementById("paraProjects");

  const pTask = document.getElementById("paraTasks");

  const pHab = document.getElementById("paraHabits");

  const pBlk = document.getElementById("paraBlocks");

  if (pProj) {
    pProj.textContent = state.projects.length;
  }

  if (pTask) {
    pTask.textContent = state.tasks.filter((t) => !t.done).length;
  }

  if (pHab) {
    pHab.textContent = state.habits.length;
  }

  if (pBlk) {
    pBlk.textContent = Object.keys(state.timeBlocks).length + state.customSpans.length;
  }
}

function initChart() {
  const canvas = document.getElementById("performanceChart");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 160);

  gradient.addColorStop(0, "rgba(168, 199, 250, 0.32)");

  gradient.addColorStop(0.6, "rgba(168, 199, 250, 0.05)");

  gradient.addColorStop(1, "rgba(168, 199, 250, 0)");

  const compactLabels = getPast30DaysCompactLabels();

  const fullDateTooltips = [];

  for (let i = 29; i >= 0; i--) {
    fullDateTooltips.push(getDetailedShamsiDate(-i));
  }

  chartInstance = new Chart(ctx, {
    type: "line",

    data: {
      labels: compactLabels,

      datasets: [
        {
          label: "Performance",

          data: Array(30).fill(0),

          borderColor: "#a8c7fa",

          borderWidth: 2.2,

          backgroundColor: gradient,

          fill: true,

          tension: 0.35,

          pointRadius: 0,

          pointHoverRadius: 5,

          pointBackgroundColor: "#a8c7fa",

          pointHoverBackgroundColor: "#ffffff",

          pointBorderColor: "#04305c",

          pointHoverBorderColor: "#a8c7fa",

          pointBorderWidth: 2,

          pointHoverBorderWidth: 2.5,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      layout: {
        padding: {
          right: 12,
          left: 4,
          top: 10,
          bottom: 2,
        },
      },

      interaction: {
        mode: "index",
        intersect: false,
      },

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          backgroundColor: "#1e222b",

          titleColor: "#ffd99f",

          bodyColor: "#e2e2e6",

          borderColor: "#323742",

          borderWidth: 1,

          padding: 12,

          cornerRadius: 14,

          displayColors: false,

          rtl: true,

          titleFont: {
            family: "Vazirmatn",
            size: 12,
            weight: "bold",
          },

          bodyFont: {
            family: "Vazirmatn",
            size: 11,
          },

          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;

              return `📅 ${fullDateTooltips[idx]}`;
            },

            label: (item) => `⚡ بازدهی و عملکرد: ${item.raw}٪`,
          },
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },

          border: {
            display: true,
            color: "rgba(255, 255, 255, 0.08)",
          },

          ticks: {
            color: function (context) {
              return context.index === 29 ? "#ffd99f" : "#8e9198";
            },

            font: {
              family: "Roboto Flex, Vazirmatn, sans-serif",
              size: 8.5,

              weight: function (context) {
                return context.index === 29 ? "bold" : "normal";
              },

              lineHeight: 1.15,
            },

            maxRotation: 0,

            autoSkip: false,

            padding: 4,
          },
        },

        y: {
          position: "left",

          min: 0,

          max: 100,

          border: {
            display: false,

            dash: [4, 4],
          },

          grid: {
            color: "rgba(255, 255, 255, 0.03)",
          },

          ticks: {
            stepSize: 25,

            color: "#686c75",

            font: {
              family: "Roboto Flex, sans-serif",

              size: 10,
            },

            padding: 8,

            callback: (val) => val + "%",
          },
        },
      },
    },
  });
}

function calculatePerformanceScore() {
  if (!chartInstance) {
    return;
  }

  const hCount = state.habits.length;

  const hDone = state.habits.filter((h) => h.doneToday).length;

  const hScore = hCount ? (hDone / hCount) * 40 : 0;

  const tCount = state.tasks.length;

  const tDone = state.tasks.filter((t) => t.done).length;

  const tScore = tCount ? (tDone / tCount) * 40 : 0;

  const spanDone = state.customSpans.filter((s) => s.done).length;

  const blockTotal = Object.keys(state.timeBlocks).length;

  const totalCovered = spanDone + blockTotal;

  const bScore = Math.min(20, (totalCovered / 5) * 20);

  const todayScore = Math.round(hScore + tScore + bScore);

  const todayKey = state.activeDate;

  state.history[todayKey] = todayScore;

  const historyData = [];

  for (let i = 29; i >= 0; i--) {
    const k = getTehranShamsiDateKey(-i);

    historyData.push(state.history[k] ?? (k === todayKey ? todayScore : 0));
  }

  chartInstance.data.datasets[0].data = historyData;

  chartInstance.update("none");
}

function openModal(id) {
  const elem = document.getElementById(id);

  if (!elem) {
    return;
  }

  elem.classList.remove("hidden");

  elem.classList.add("flex");
}

function closeModal(id) {
  const elem = document.getElementById(id);

  if (!elem) {
    return;
  }

  elem.classList.add("hidden");

  elem.classList.remove("flex");
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `second_brain_backup_${state.activeDate.replace(/\//g, "-")}.json`;

  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBackup(e) {
  const file = e.target?.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);

      if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.habits)) {
        state = parsed;

        if (!Array.isArray(state.customSpans)) {
          state.customSpans = [];
        }

        if (!state.timeBlocks || typeof state.timeBlocks !== "object") {
          state.timeBlocks = {};
        }

        if (!Array.isArray(state.projects)) {
          state.projects = [];
        }

        saveState();
        location.reload();
      } else {
        alert("فرمت فایل معتبر نیست.");
      }
    } catch (err) {
      console.error("Import error:", err);

      alert("خطا در خواندن فایل.");
    }
  };

  reader.readAsText(file);
}

function initializeApp() {
  ensureSpansAvailable();
  checkDayRollover();
  updateLiveClock();

  const focusInput = document.getElementById("dailyFocusInput");

  if (focusInput) {
    focusInput.value = state.dailyFocus || "";
  }

  renderTasks();
  renderHabits();
  renderProjects();
  renderTimeline();

  initChart();
  calculatePerformanceScore();

  updateTimerBadge();
  restoreTimerState();

  renderTimerNumbers();
  updateTimerButtonUI();
  updateParaCounters();

  if (timerAlarmPending) {
    setTimeout(() => {
      showAlarmModal();
    }, 0);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, {
    once: true,
  });
} else {
  initializeApp();
}
