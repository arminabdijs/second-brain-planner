
const STORAGE_KEY = "google_m3_second_brain_v7_24h";

const defaultState = {
  dailyFocus: "",
  tasks: [],
  habits: [],
  projects: [],
  timeBlocks: {},
  customSpans: [],
  history: {},
};

function loadState() {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return JSON.parse(JSON.stringify(defaultState));
    const parsed = JSON.parse(item);
    if (!parsed.customSpans) parsed.customSpans = [];
    if (!parsed.timeBlocks) parsed.timeBlocks = {};
    if (!parsed.history) parsed.history = {};
    return parsed;
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

let state = loadState();
let currentTaskFilter = "all";
let editingHour = null;
let chartInstance = null;
let activeTimelineTab = "grid";

let alarmAudioElement = null;
let synthAlarmInterval = null;
let testSoundTimeout = null;
let currentAlarmSetting = localStorage.getItem("chosen_alarm_sound") || "synth-bell";
let customAudioDataUrl = localStorage.getItem("custom_alarm_data_url") || null;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateParaCounters();
    calculatePerformanceScore();
  } catch (e) {
    console.error("خطا در ذخیره‌سازی استیت:", e);
  }
}

const weekDays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function updateLiveClock() {
  const now = new Date();
  document.getElementById("clockHours").textContent = String(now.getHours()).padStart(2, "0");
  document.getElementById("clockMinutes").textContent = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("clockSeconds").textContent = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("dayNameDisplay").textContent = weekDays[now.getDay()];

  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  document.getElementById("dateDisplay").textContent = now.toLocaleDateString("fa-IR", options);
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

function updateDailyFocus(val) {
  state.dailyFocus = val;
  saveState();
}

let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

function playSynthesizedSound(type) {
  try {
    const ctx = getAudioContext();
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
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 1.3);
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
    console.warn("خطای خروجی صدا:", e);
  }
}

function playBeep() {
  playSynthesizedSound("synth-digital");
}

function triggerAlarmPlayback() {
  stopAlarmPlayback();

  if (currentAlarmSetting.startsWith("synth-")) {
    playSynthesizedSound(currentAlarmSetting);
    synthAlarmInterval = setInterval(() => {
      playSynthesizedSound(currentAlarmSetting);
    }, 1800);
  } else if (currentAlarmSetting === "custom-file" && customAudioDataUrl) {
    try {
      alarmAudioElement = new Audio(customAudioDataUrl);
      alarmAudioElement.loop = true;
      alarmAudioElement.play().catch((err) => {
        console.warn("پخش فایل به دلیل محدودیت مرورگر مسدود شد؛ سوئیچ به سینت‌سایزر:", err);
        playSynthesizedSound("synth-bell");
      });
    } catch (err) {
      playSynthesizedSound("synth-bell");
    }
  } else {
    playSynthesizedSound("synth-bell");
    synthAlarmInterval = setInterval(() => {
      playSynthesizedSound("synth-bell");
    }, 1800);
  }
}

function stopAlarmPlayback() {
  if (synthAlarmInterval) {
    clearInterval(synthAlarmInterval);
    synthAlarmInterval = null;
  }
  if (alarmAudioElement) {
    alarmAudioElement.pause();
    alarmAudioElement.currentTime = 0;
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
    subtitleElem.textContent = isWork ? "خسته نباشید! یک بازه کاری را با موفقیت تمام کردید. زمان استراحت است." : "استراحت شما تکمیل شد. آماده برای شروع بازه تمرکز عمیق جدید شوید.";
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
  if (!box) return;
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
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    customAudioDataUrl = e.target.result;

    try {
      localStorage.setItem("custom_alarm_data_url", customAudioDataUrl);
      localStorage.setItem("custom_alarm_filename", file.name);

      const fileLabel = document.getElementById("customFileName");
      if (fileLabel) fileLabel.textContent = `ذخیره دائمی شد: ${file.name}`;

      currentAlarmSetting = "custom-file";
      localStorage.setItem("chosen_alarm_sound", "custom-file");
    } catch (err) {
      alert("حجم فایل برای ذخیره خودکار زیاد است، لطفاً یک فایل کم‌حجم‌تر انتخاب کنید.");
    }
  };
  reader.readAsDataURL(file);
}

function testCurrentAlarmSound() {
  stopAlarmPlayback();
  triggerAlarmPlayback();
  testSoundTimeout = setTimeout(() => {
    stopAlarmPlayback();
  }, 3000);
}


let timerTotalSeconds = 25 * 60;
let timerRemaining = 25 * 60;
let timerInterval = null;
let timerMode = "work";

function renderTimerNumbers() {
  const mins = Math.floor(timerRemaining / 60);
  const secs = timerRemaining % 60;
  const inputMin = document.getElementById("inputTimerMin");
  const inputSec = document.getElementById("inputTimerSec");

  if (document.activeElement !== inputMin) {
    inputMin.value = String(mins).padStart(2, "0");
  }
  if (document.activeElement !== inputSec) {
    inputSec.value = String(secs).padStart(2, "0");
  }
}

function onTimerInputFocus(input) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    updateTimerButtonUI();
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
  let val = parseInt(input.value) || 0;
  val = Math.max(0, Math.min(180, val));
  input.value = String(val).padStart(2, "0");
  syncTimerFromInputs();
}

function onTimerSecBlur(input) {
  let val = parseInt(input.value) || 0;
  val = Math.max(0, Math.min(59, val));
  input.value = String(val).padStart(2, "0");
  syncTimerFromInputs();
}

function syncTimerFromInputs() {
  const m = parseInt(document.getElementById("inputTimerMin").value) || 0;
  const s = parseInt(document.getElementById("inputTimerSec").value) || 0;
  const total = m * 60 + s;
  timerTotalSeconds = total > 0 ? total : 60;
  timerRemaining = timerTotalSeconds;
  document.getElementById("timerBadge").textContent = `${Math.round(timerTotalSeconds / 60)} دقیقه`;
  renderTimerNumbers();
}

function updateTimerButtonUI() {
  const btn = document.getElementById("btnTimerToggle");
  if (!btn) return;
  if (timerInterval) {
    btn.innerHTML = `<span class="material-symbols-rounded text-sm filled">pause</span><span>توقف</span>`;
    btn.className = "px-4 py-2 text-xs font-bold rounded-full bg-[#f2b8b5] text-[#601410] hover:bg-[#ffdad6] transition flex items-center gap-1";
  } else {
    btn.innerHTML = `<span class="material-symbols-rounded text-sm filled">play_arrow</span><span>شروع</span>`;
    btn.className = "px-4 py-2 text-xs font-bold rounded-full bg-[#a8c7fa] text-[#04305c] hover:bg-[#c2e7ff] transition flex items-center gap-1";
  }
}

function toggleTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  } else {
    if (timerRemaining <= 0) timerRemaining = timerTotalSeconds;
    timerInterval = setInterval(() => {
      if (timerRemaining > 0) {
        timerRemaining -= 1;
        renderTimerNumbers();
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        updateTimerButtonUI();
        showAlarmModal();
      }
    }, 1000);
  }
  updateTimerButtonUI();
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRemaining = timerTotalSeconds;
  renderTimerNumbers();
  updateTimerButtonUI();
}

function switchTimerMode() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (timerMode === "work") {
    timerMode = "break";
    timerTotalSeconds = 5 * 60;
    document.getElementById("timerBadge").textContent = "استراحت (۵ دقیقه)";
    document.getElementById("timerBadge").className = "text-[10px] px-2.5 py-0.5 rounded-full bg-[#173822] text-[#85e4a0] font-medium";
  } else {
    timerMode = "work";
    timerTotalSeconds = 25 * 60;
    document.getElementById("timerBadge").textContent = "تمرکز (۲۵ دقیقه)";
    document.getElementById("timerBadge").className = "text-[10px] px-2.5 py-0.5 rounded-full bg-[#0842a0] text-[#d3e3fd] font-medium";
  }
  resetTimer();
}


function filterTasks(type) {
  currentTaskFilter = type;
  ["all", "high", "pending"].forEach((t) => {
    const btn = document.getElementById(`filter-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = "text-[10px] px-3 py-1 rounded-full bg-[#a8c7fa] text-[#04305c] font-bold transition";
      } else {
        btn.className = "text-[10px] px-3 py-1 rounded-full bg-[#272a31] text-[#8e9198] transition";
      }
    }
  });
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById("tasksList");
  if (!container) return;
  container.innerHTML = "";

  let list = state.tasks;
  if (currentTaskFilter === "high") list = state.tasks.filter((t) => t.priority === "high");
  else if (currentTaskFilter === "pending") list = state.tasks.filter((t) => !t.done);

  const doneCount = state.tasks.filter((t) => t.done).length;
  document.getElementById("tasksCounter").textContent = `${doneCount} / ${state.tasks.length}`;

  if (list.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-[#8e9198]">تسکی در این بخش وجود ندارد</div>`;
    return;
  }

  list.forEach((task) => {
    const project = state.projects.find((p) => p.id === task.projectId);
    const card = document.createElement("div");
    card.className = "flex items-center justify-between p-2.5 rounded-2xl bg-[#171a1f] border border-[#2d3139] hover:border-[#44474e] transition group";

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
        <button onclick="toggleTask(${task.id})" class="w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${task.done ? "bg-[#a8c7fa] border-[#a8c7fa] text-[#04305c]" : "border-[#44474e] hover:border-[#a8c7fa]"}">
          ${task.done ? '<span class="material-symbols-rounded text-sm font-bold">check</span>' : ""}
        </button>
        <div class="flex flex-col truncate">
          <span class="text-xs ${task.done ? "line-through text-[#8e9198]" : "text-[#e2e2e6]"} truncate">${task.title}</span>
          ${project ? `<span class="text-[10px] text-[#d0bcff] truncate">${project.title}</span>` : ""}
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[9px] px-2 py-0.5 rounded-full font-medium ${badge}">${badgeText}</span>
        <button onclick="deleteTask(${task.id})" class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5">
          <span class="material-symbols-rounded text-sm">close</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    saveState();
    renderTasks();
    renderProjects();
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  saveState();
  renderTasks();
  renderProjects();
}

function createTask() {
  const titleInput = document.getElementById("taskTitleInput");
  const title = titleInput.value.trim();
  const priority = document.getElementById("taskPriorityInput").value;
  const projectId = parseInt(document.getElementById("taskProjectSelect").value) || null;
  if (!title) return;

  state.tasks.push({ id: Date.now(), title, priority, projectId, done: false });
  saveState();
  renderTasks();
  renderProjects();
  closeModal("taskModal");
  titleInput.value = "";
}


function renderHabits() {
  const container = document.getElementById("habitsList");
  if (!container) return;
  container.innerHTML = "";

  const total = state.habits.length;
  const done = state.habits.filter((h) => h.doneToday).length;
  const score = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("habitsScore").textContent = `${score}%`;

  if (total === 0) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-[#8e9198]">عادت فعالی تعریف نشده است</div>`;
    return;
  }

  state.habits.forEach((h) => {
    const card = document.createElement("div");
    card.className = "flex items-center justify-between p-2.5 rounded-2xl bg-[#171a1f] border border-[#2d3139] group";
    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <button onclick="toggleHabit(${h.id})" class="w-6 h-6 rounded-lg border flex items-center justify-center transition ${h.doneToday ? "bg-[#6dd58c] border-[#6dd58c] text-[#0a3818]" : "border-[#44474e] hover:border-[#6dd58c]"}">
          ${h.doneToday ? '<span class="material-symbols-rounded text-sm font-bold">check</span>' : ""}
        </button>
        <span class="text-xs ${h.doneToday ? "text-[#8e9198] line-through" : "text-[#e2e2e6]"}">${h.title}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] m3-num-font text-[#ffd99f] bg-[#3b2d00] px-2 py-0.5 rounded-full flex items-center gap-0.5">
          🔥 ${h.streak}d
        </span>
        <button onclick="deleteHabit(${h.id})" class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5">
          <span class="material-symbols-rounded text-sm">close</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (habit) {
    habit.doneToday = !habit.doneToday;
    if (habit.doneToday) habit.streak += 1;
    else habit.streak = Math.max(0, habit.streak - 1);
    saveState();
    renderHabits();
  }
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  saveState();
  renderHabits();
}

function createHabit() {
  const input = document.getElementById("habitTitleInput");
  const title = input.value.trim();
  if (!title) return;

  state.habits.push({ id: Date.now(), title, streak: 1, doneToday: false });
  saveState();
  renderHabits();
  closeModal("habitModal");
  input.value = "";
}


function renderProjects() {
  const container = document.getElementById("projectsList");
  const select = document.getElementById("taskProjectSelect");
  if (!container || !select) return;

  container.innerHTML = "";
  select.innerHTML = '<option value="">مستقل (بدون پروژه)</option>';

  document.getElementById("projectsCount").textContent = `${state.projects.length} پروژه`;

  if (state.projects.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-[#8e9198]">پروژه‌ای ثبت نشده است</div>`;
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
    card.className = "p-3 rounded-2xl bg-[#171a1f] border border-[#2d3139] group";
    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[#e2e2e6]">${p.title}</span>
          <span class="text-[9px] px-2 py-0.5 rounded-full bg-[#381e72] text-[#e8def8]">${p.category || "عمومی"}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs m3-num-font text-[#d0bcff] font-bold">${progress}%</span>
          <button onclick="deleteProject(${p.id})" class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-0.5">
            <span class="material-symbols-rounded text-sm">close</span>
          </button>
        </div>
      </div>
      <div class="w-full bg-[#272a31] h-1.5 rounded-full overflow-hidden">
        <div class="bg-[#d0bcff] h-full rounded-full transition-all duration-300" style="width: ${progress}%"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

function deleteProject(id) {
  state.projects = state.projects.filter((p) => p.id !== id);
  state.tasks.forEach((t) => {
    if (t.projectId === id) t.projectId = null;
  });
  saveState();
  renderProjects();
  renderTasks();
}

function createProject() {
  const titleInput = document.getElementById("projectTitleInput");
  const catInput = document.getElementById("projectCategoryInput");
  const title = titleInput.value.trim();
  const category = catInput.value.trim() || "عمومی";
  if (!title) return;

  state.projects.push({ id: Date.now(), title, category });
  saveState();
  renderProjects();
  closeModal("projectModal");
  titleInput.value = "";
  catInput.value = "";
}


const hours24Full = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0") + ":00");

function switchTimelineTab(tab) {
  activeTimelineTab = tab;
  const btnGrid = document.getElementById("tabBtnGrid");
  const btnCustom = document.getElementById("tabBtnCustom");
  const viewGrid = document.getElementById("timelineGridView");
  const viewCustom = document.getElementById("timelineCustomView");

  if (!btnGrid || !btnCustom || !viewGrid || !viewCustom) return;

  if (tab === "grid") {
    btnGrid.className = "text-[10px] px-3 py-1 rounded-full bg-[#a8c7fa] text-[#04305c] font-bold transition";
    btnCustom.className = "text-[10px] px-3 py-1 rounded-full text-[#8e9198] hover:text-white transition";
    viewGrid.classList.remove("hidden");
    viewCustom.classList.add("hidden");
    viewCustom.classList.remove("flex");
  } else {
    btnCustom.className = "text-[10px] px-3 py-1 rounded-full bg-[#ffe08b] text-[#3f2e00] font-bold transition";
    btnGrid.className = "text-[10px] px-3 py-1 rounded-full text-[#8e9198] hover:text-white transition";
    viewGrid.classList.add("hidden");
    viewCustom.classList.remove("hidden");
    viewCustom.classList.add("flex");
  }
}

function renderTimeline() {
  render24HourGrid();
  renderCustomSpans();
}

function render24HourGrid() {
  const container = document.getElementById("timelineGridView");
  if (!container) return;
  container.innerHTML = "";
  const currentHourStr = String(new Date().getHours()).padStart(2, "0") + ":00";

  hours24Full.forEach((hour) => {
    const item = state.timeBlocks[hour];
    const isCurrent = hour === currentHourStr;
    const card = document.createElement("div");

    let style = "bg-[#171a1f] border-[#2d3139] text-[#8e9198] hover:border-[#44474e]";
    if (item) {
      if (item.type === "deep") style = "bg-[#004a77]/35 border-[#004a77] text-[#c2e7ff]";
      else if (item.type === "meeting") style = "bg-[#381e72]/35 border-[#552e9c] text-[#e8def8]";
      else if (item.type === "fitness") style = "bg-[#1b3724]/35 border-[#265335] text-[#85e4a0]";
      else style = "bg-[#3b2d00]/35 border-[#574300] text-[#ffd99f]";
    }

    if (isCurrent) style += " ring-1 ring-[#a8c7fa]";

    card.className = `p-2 rounded-2xl border text-center transition cursor-pointer flex flex-col justify-center min-h-[58px] ${style}`;
    card.onclick = () => openBlockModal(hour);

    card.innerHTML = `
      <div class="text-[10px] m3-clock-font font-bold mb-0.5 flex items-center justify-center gap-1 ${isCurrent ? "text-[#a8c7fa]" : "text-[#8e9198]"}">
        <span>${hour}</span>
        ${isCurrent ? '<span class="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] animate-ping"></span>' : ""}
      </div>
      <div class="text-[10px] truncate font-medium">${item ? item.title : "آزاد"}</div>
    `;
    container.appendChild(card);
  });
}

function renderCustomSpans() {
  const container = document.getElementById("timelineCustomView");
  const countBadge = document.getElementById("customSpansCount");
  if (!container) return;
  if (countBadge) countBadge.textContent = state.customSpans.length;
  container.innerHTML = "";

  if (state.customSpans.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-xs text-[#8e9198] flex flex-col items-center gap-2">
        <span class="material-symbols-rounded text-2xl">more_time</span>
        <span>هیچ بازه زمانی دلخواهی ثبت نشده است. دکمه «+ بازه دلخواه» را در بالای صفحه بزنید.</span>
      </div>
    `;
    return;
  }

  state.customSpans.sort((a, b) => a.start.localeCompare(b.start));

  state.customSpans.forEach((span) => {
    let badgeColor = "bg-[#004a77]/40 text-[#c2e7ff] border-[#004a77]";
    let typeName = "کار عمیق";
    if (span.type === "meeting") {
      badgeColor = "bg-[#381e72]/40 text-[#e8def8] border-[#552e9c]";
      typeName = "جلسه";
    } else if (span.type === "fitness") {
      badgeColor = "bg-[#1b3724]/40 text-[#85e4a0] border-[#265335]";
      typeName = "ورزش/استراحت";
    } else if (span.type === "routine") {
      badgeColor = "bg-[#3b2d00]/40 text-[#ffd99f] border-[#574300]";
      typeName = "روتین";
    }

    const item = document.createElement("div");
    item.className = "flex items-center justify-between p-3 rounded-2xl bg-[#171a1f] border border-[#2d3139] hover:border-[#44474e] transition group";
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="font-mono text-xs text-[#a8c7fa] bg-[#111318] px-2.5 py-1 rounded-xl border border-[#2d3139]" dir="ltr">
          ${span.start} - ${span.end}
        </div>
        <div class="flex flex-col">
          <span class="text-xs font-bold text-[#e2e2e6]">${span.title}</span>
          <span class="text-[9px] text-[#8e9198]">${typeName}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[9px] px-2 py-0.5 rounded-full border ${badgeColor}">${typeName}</span>
        <button onclick="deleteCustomSpan(${span.id})" class="text-[#8e9198] hover:text-[#ffb4ab] opacity-0 group-hover:opacity-100 transition p-1">
          <span class="material-symbols-rounded text-sm">close</span>
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function openBlockModal(hour) {
  editingHour = hour;
  document.getElementById("timeBlockTitle").textContent = `برنامه‌ریزی ساعت ${hour}`;
  const cur = state.timeBlocks[hour];
  document.getElementById("timeBlockInput").value = cur ? cur.title : "";
  document.getElementById("timeBlockType").value = cur ? cur.type : "deep";
  openModal("timeBlockModal");
}

function saveActiveBlock() {
  if (!editingHour) return;
  const title = document.getElementById("timeBlockInput").value.trim();
  const type = document.getElementById("timeBlockType").value;
  if (title) state.timeBlocks[editingHour] = { title, type };
  else delete state.timeBlocks[editingHour];

  saveState();
  renderTimeline();
  closeModal("timeBlockModal");
}

function deleteActiveBlock() {
  if (!editingHour) return;
  delete state.timeBlocks[editingHour];
  saveState();
  renderTimeline();
  closeModal("timeBlockModal");
}

function openCustomBlockModal() {
  openModal("customBlockModal");
}

function saveCustomTimeSpan() {
  const start = document.getElementById("customStartTime").value;
  const end = document.getElementById("customEndTime").value;
  const title = document.getElementById("customActivityTitle").value.trim();
  const type = document.getElementById("customActivityType").value;

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
  });

  saveState();
  renderTimeline();
  closeModal("customBlockModal");
  document.getElementById("customActivityTitle").value = "";
  switchTimelineTab("custom");
}

function deleteCustomSpan(id) {
  state.customSpans = state.customSpans.filter((s) => s.id !== id);
  saveState();
  renderTimeline();
}

function clearTimeline() {
  if (confirm("تمام بلوک‌های ساعتی و بازه‌های دلخواه امروز پاکسازی شوند؟")) {
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

  if (pProj) pProj.textContent = state.projects.length;
  if (pTask) pTask.textContent = state.tasks.filter((t) => !t.done).length;
  if (pHab) pHab.textContent = state.habits.length;
  if (pBlk) pBlk.textContent = Object.keys(state.timeBlocks).length + state.customSpans.length;
}

function initChart() {
  const canvas = document.getElementById("performanceChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`);

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "امتیاز عملکرد",
          data: Array(30).fill(0),
          borderColor: "#a8c7fa",
          backgroundColor: "rgba(168, 199, 250, 0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#04305c",
          pointBorderColor: "#a8c7fa",
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255, 255, 255, 0.02)" }, ticks: { color: "#8e9198", font: { family: "Vazirmatn", size: 9 } } },
        y: { grid: { color: "rgba(255, 255, 255, 0.04)" }, ticks: { color: "#8e9198", font: { family: "Vazirmatn", size: 9 } }, min: 0, max: 100 },
      },
    },
  });
}

function calculatePerformanceScore() {
  if (!chartInstance) return;

  const hCount = state.habits.length;
  const hDone = state.habits.filter((h) => h.doneToday).length;
  const hScore = hCount ? (hDone / hCount) * 40 : 0;

  const tCount = state.tasks.length;
  const tDone = state.tasks.filter((t) => t.done).length;
  const tScore = tCount ? (tDone / tCount) * 40 : 0;

  const totalBlocks = Object.keys(state.timeBlocks).length + state.customSpans.length;
  const bScore = Math.min(20, (totalBlocks / 5) * 20);

  const total = Math.round(hScore + tScore + bScore);
  const key = new Date().toISOString().slice(0, 10);
  state.history[key] = total;

  const historyData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    historyData.push(state.history[k] || (i === 0 ? total : 0));
  }

  chartInstance.data.datasets[0].data = historyData;
  chartInstance.update();
}


function openModal(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.classList.remove("hidden");
    elem.classList.add("flex");
  }
}

function closeModal(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.classList.add("hidden");
    elem.classList.remove("flex");
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `google_m3_second_brain_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.habits)) {
        state = parsed;
        if (!state.customSpans) state.customSpans = [];
        if (!state.timeBlocks) state.timeBlocks = {};
        if (!state.history) state.history = {};
        saveState();
        location.reload();
      } else {
        alert("فرمت فایل بکاپ معتبر نیست.");
      }
    } catch (err) {
      alert("خطا در پردازش فایل بکاپ.");
    }
  };
  reader.readAsText(file);
}


document.addEventListener("DOMContentLoaded", () => {
  const focusInput = document.getElementById("dailyFocusInput");
  if (focusInput) focusInput.value = state.dailyFocus || "";

  renderTasks();
  renderHabits();
  renderProjects();
  renderTimeline();
  initChart();
  calculatePerformanceScore();
  renderTimerNumbers();
  updateParaCounters();
});
