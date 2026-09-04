const state = {
  language: localStorage.getItem("meetPace.language") || "en",
  participants: JSON.parse(localStorage.getItem("meetPace.participants") || "[]"),
  selectedParticipant: null,
  durationSeconds: Number(localStorage.getItem("meetPace.duration")) || 120,
  remainingSeconds: 120,
  timerStartedAt: null,
  elapsedBeforeStart: 0,
  timerId: null,
  running: false,
  overtimeNotified: false,
  history: JSON.parse(localStorage.getItem("meetPace.history") || "[]"),
  assignmentCycle: JSON.parse(localStorage.getItem("meetPace.assignmentCycle") || "[]"),
  currentAssignment: JSON.parse(localStorage.getItem("meetPace.currentAssignment") || "null"),
  currentCallCycle: JSON.parse(localStorage.getItem("meetPace.currentCallCycle") || "[]"),
  currentCallAssignment: JSON.parse(localStorage.getItem("meetPace.currentCallAssignment") || "null"),
};

const ids = [
  "participantForm", "participantNameInput", "clearParticipantsButton",
  "participantsList", "participantCount", "speakerName", "timerStateBadge", "timerRing",
  "timerValue", "timerCaption", "toggleTimerButton", "resetTimerButton", "finishTimerButton",
  "decreaseDuration", "increaseDuration", "durationDisplay", "historyList",
  "clearHistoryButton", "drawButton", "drawResult", "drawProgress", "currentDrawButton",
  "currentDrawResult", "currentDrawProgress", "toast"
];
const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const tasks = [
  { id: "joke", en: "Find and tell a short joke", ru: "Найти и рассказать короткий анекдот" },
  { id: "fact", en: "Prepare an unusual fact that will surprise the team", ru: "Подготовить необычный факт, который удивит команду" },
  { id: "question", en: "Start the call with a question of the day", ru: "Начать звонок с вопроса дня для всех участников" },
  { id: "recommendation", en: "Recommend a movie, book, or podcast", ru: "Порекомендовать фильм, книгу или подкаст" },
  { id: "lifehack", en: "Share a useful work hack", ru: "Показать полезный рабочий лайфхак" },
  { id: "discovery", en: "Prepare a one-minute story about a recent discovery", ru: "Подготовить минутную историю о недавнем открытии" },
  { id: "warmup", en: "Come up with a quick warm-up before the discussion", ru: "Придумать лёгкую разминку перед обсуждением" },
  { id: "win", en: "Share a small win from the past week", ru: "Рассказать о маленькой победе за последнюю неделю" },
];
const currentCallTasks = [
  { id: "funny-story", en: "Tell a funny story from your life", ru: "Рассказать забавную историю из жизни" },
  { id: "unexpected-skill", en: "Share an unexpected skill or talent", ru: "Рассказать о неожиданном навыке или таланте" },
  { id: "two-truths", en: "Tell two truths and one lie about yourself", ru: "Рассказать о себе две правды и одну ложь" },
  { id: "dream-trip", en: "Describe your dream trip in one minute", ru: "За минуту описать путешествие своей мечты" },
  { id: "childhood", en: "Share a favorite childhood memory", ru: "Поделиться любимым воспоминанием из детства" },
  { id: "superpower", en: "Choose a superpower and explain why", ru: "Выбрать суперспособность и объяснить свой выбор" },
  { id: "good-news", en: "Share one piece of good news", ru: "Поделиться одной хорошей новостью" },
  { id: "desk-object", en: "Show an object nearby and tell its story", ru: "Показать предмет рядом и рассказать его историю" },
];

const translations = {
  en: {
    pageTitle: "Meet Pace — speaker timer", description: "Participant queue and speaker timer",
    localSession: "Local session", eyebrow: "Effortless facilitation", heroLine1: "Time for every",
    heroLine2: "voice to be heard.", heroCopy: "Add participants, choose a speaker, and keep the conversation moving.",
    newParticipant: "New participant", namePlaceholder: "First and last name", add: "Add",
    savedLocally: "The list is saved in this browser", queue: "Queue",
    participants: "Participants", clearList: "Clear list", speakingNow: "Speaking now",
    talkLimit: "Talk time limit", nextCall: "Next call", randomTask: "Random task",
    drawCopy: "The draw completes a full round — everyone gets a task before the queue starts over.",
    drawParticipant: "Draw a participant", today: "Today", actionLog: "Activity log", clear: "Clear",
    emptyTitle: "The queue is empty", emptyCopy: "Add your first participant using the form above.",
    selectParticipant: "Select a participant", ready: "Ready", paused: "Paused", running: "Talk in progress",
    warning: "Time is running out", overtime: "Overtime", talkCaption: "for this talk", timeUp: "over the limit",
    startTimer: "Start timer", pauseTimer: "Pause timer", resetTimer: "Reset timer", finishTalk: "Finish talk",
    decreaseTime: "Decrease time", increaseTime: "Increase time", inQueue: "In queue", selected: "Selected",
    start: "Start", delete: "Delete", enterName: "Enter a participant name",
    duplicate: "A participant with this name already exists", added: "added to the queue",
    removed: "removed from the queue", assignmentGoesTo: "Task assigned to", drawPlaceholder: "Who will be next?",
    progressEmpty: "Add participants to start the draw", progressDone: "Round complete — the next draw starts a new one",
    progressRemaining: "Remaining in this round", logEmpty: "Completed talks and assigned tasks will appear here.",
    taskPrefix: "Task", drawLabel: "Draw", timeFinished: "Time is up for", listCleared: "Participant list cleared",
    currentCall: "This call", spontaneousTask: "Spontaneous task",
    currentDrawCopy: "Pick someone for a light, spontaneous task during the current conversation.",
    currentDrawParticipant: "Draw for this call", currentDrawPlaceholder: "Who gets the next task?",
    callTaskPrefix: "Call task", currentLabel: "This call",
  },
  ru: {
    pageTitle: "Meet Pace — таймер выступлений", description: "Очередь участников и таймер выступлений",
    localSession: "Локальная сессия", eyebrow: "Фасилитация без суеты", heroLine1: "Каждому — время",
    heroLine2: "быть услышанным.", heroCopy: "Добавьте участников, выберите выступающего и держите обсуждение в ритме.",
    newParticipant: "Новый участник", namePlaceholder: "Имя и фамилия", add: "Добавить",
    savedLocally: "Список сохранится в этом браузере", queue: "Очередь",
    participants: "Участники", clearList: "Очистить список", speakingNow: "Сейчас говорит",
    talkLimit: "Лимит выступления", nextCall: "Следующий звонок", randomTask: "Случайное задание",
    drawCopy: "Жребий проходит по полному кругу — каждый получит задание до того, как очередь начнётся заново.",
    drawParticipant: "Выбрать участника", today: "Сегодня", actionLog: "Лог действий", clear: "Очистить",
    emptyTitle: "Очередь пока пуста", emptyCopy: "Добавьте первого участника в форме выше.",
    selectParticipant: "Выберите участника", ready: "Готов", paused: "Пауза", running: "Идёт выступление",
    warning: "Время заканчивается", overtime: "Сверх лимита", talkCaption: "на выступление", timeUp: "сверх лимита",
    startTimer: "Запустить таймер", pauseTimer: "Поставить на паузу", resetTimer: "Сбросить таймер", finishTalk: "Завершить выступление",
    decreaseTime: "Уменьшить время", increaseTime: "Увеличить время", inQueue: "В очереди", selected: "Выбран",
    start: "Начать", delete: "Удалить", enterName: "Введите имя участника",
    duplicate: "Участник с таким именем уже есть", added: "добавлен в очередь",
    removed: "удалён из очереди", assignmentGoesTo: "Задание получает", drawPlaceholder: "Кто будет следующим?",
    progressEmpty: "Добавьте участников для жеребьёвки", progressDone: "Круг завершён — следующий жребий начнёт новый",
    progressRemaining: "До конца круга", logEmpty: "Выступления и выданные задания появятся здесь.",
    taskPrefix: "Задание", drawLabel: "Жребий", timeFinished: "Время закончилось для", listCleared: "Список участников очищен",
    currentCall: "На этом звонке", spontaneousTask: "Импровизационное задание",
    currentDrawCopy: "Выберите участника для лёгкого спонтанного задания прямо во время разговора.",
    currentDrawParticipant: "Выбрать на этот звонок", currentDrawPlaceholder: "Кому достанется задание?",
    callTaskPrefix: "Задание на звонке", currentLabel: "Сейчас",
  },
};

function tr(key) {
  return translations[state.language][key] || key;
}

function localizedTask(assignment) {
  const task = tasks.find((item) => item.id === assignment.taskId)
    || tasks.find((item) => item.ru === assignment.task || item.en === assignment.task);
  return task ? task[state.language] : assignment.task;
}

function localizedCurrentCallTask(assignment) {
  const task = currentCallTasks.find((item) => item.id === assignment.taskId)
    || currentCallTasks.find((item) => item.ru === assignment.task || item.en === assignment.task);
  return task ? task[state.language] : assignment.task;
}

function applyLanguage(language) {
  state.language = language === "ru" ? "ru" : "en";
  localStorage.setItem("meetPace.language", state.language);
  document.documentElement.lang = state.language;
  document.title = tr("pageTitle");
  document.querySelector('meta[name="description"]').content = tr("description");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = tr(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.resetTimerButton.title = tr("resetTimer");
  els.finishTimerButton.title = tr("finishTalk");
  els.decreaseDuration.setAttribute("aria-label", tr("decreaseTime"));
  els.increaseDuration.setAttribute("aria-label", tr("increaseTime"));
  if (!state.selectedParticipant) els.speakerName.textContent = tr("selectParticipant");
  renderParticipants();
  renderTimer();
  renderDraw();
  renderCurrentDraw();
  renderHistory();
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function avatarColor(value) {
  const colors = ["#456D61", "#6A5C87", "#A05C4A", "#386A8C", "#7B6A3D", "#567649"];
  const hash = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function saveParticipants() {
  localStorage.setItem("meetPace.participants", JSON.stringify(state.participants));
}

function saveAssignmentState() {
  localStorage.setItem("meetPace.assignmentCycle", JSON.stringify(state.assignmentCycle));
  localStorage.setItem("meetPace.currentAssignment", JSON.stringify(state.currentAssignment));
}

function saveCurrentCallState() {
  localStorage.setItem("meetPace.currentCallCycle", JSON.stringify(state.currentCallCycle));
  localStorage.setItem("meetPace.currentCallAssignment", JSON.stringify(state.currentCallAssignment));
}

function pruneAssignmentCycle() {
  const participantIds = new Set(state.participants.map((participant) => participant.id));
  state.assignmentCycle = state.assignmentCycle.filter((id) => participantIds.has(id));
  saveAssignmentState();
}

function pruneCurrentCallCycle() {
  const participantIds = new Set(state.participants.map((participant) => participant.id));
  state.currentCallCycle = state.currentCallCycle.filter((id) => participantIds.has(id));
  saveCurrentCallState();
}

function addParticipant(displayName) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    showToast(tr("enterName"), true);
    return;
  }
  if (state.participants.some((participant) => participant.displayName.toLocaleLowerCase("ru") === normalized.toLocaleLowerCase("ru"))) {
    showToast(tr("duplicate"), true);
    return;
  }
  state.participants.push({ id: crypto.randomUUID(), displayName: normalized });
  saveParticipants();
  renderParticipants();
  renderDraw();
  renderCurrentDraw();
  els.participantNameInput.value = "";
  els.participantNameInput.focus();
  showToast(`${normalized} ${tr("added")}`);
}

function removeParticipant(id) {
  const participant = state.participants.find((item) => item.id === id);
  if (!participant) return;
  if (state.selectedParticipant?.id === id) clearCurrentSpeaker();
  state.participants = state.participants.filter((item) => item.id !== id);
  saveParticipants();
  pruneAssignmentCycle();
  pruneCurrentCallCycle();
  renderParticipants();
  renderDraw();
  renderCurrentDraw();
  showToast(`${participant.displayName} ${tr("removed")}`);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function drawAssignment() {
  if (!state.participants.length) return;
  pruneAssignmentCycle();
  let eligible = state.participants.filter((participant) => !state.assignmentCycle.includes(participant.id));
  if (!eligible.length) {
    state.assignmentCycle = [];
    eligible = [...state.participants];
  }

  const participant = randomItem(eligible);
  const previousTaskId = state.currentAssignment?.taskId;
  const availableTasks = tasks.filter((task) => task.id !== previousTaskId);
  const task = randomItem(availableTasks.length ? availableTasks : tasks);
  const assignment = {
    id: crypto.randomUUID(),
    type: "assignment",
    participantId: participant.id,
    participantName: participant.displayName,
    taskId: task.id,
    task: task[state.language],
    finishedAt: new Date().toISOString(),
  };

  state.assignmentCycle.push(participant.id);
  state.currentAssignment = assignment;
  state.history.unshift(assignment);
  state.history = state.history.slice(0, 50);
  localStorage.setItem("meetPace.history", JSON.stringify(state.history));
  saveAssignmentState();
  renderDraw();
  renderHistory();
  showToast(`${tr("assignmentGoesTo")} ${participant.displayName}`);
}

function drawCurrentCallAssignment() {
  if (!state.participants.length) return;
  pruneCurrentCallCycle();
  let eligible = state.participants.filter((participant) => !state.currentCallCycle.includes(participant.id));
  if (!eligible.length) {
    state.currentCallCycle = [];
    eligible = [...state.participants];
  }

  const participant = randomItem(eligible);
  const previousTaskId = state.currentCallAssignment?.taskId;
  const availableTasks = currentCallTasks.filter((task) => task.id !== previousTaskId);
  const task = randomItem(availableTasks.length ? availableTasks : currentCallTasks);
  const assignment = {
    id: crypto.randomUUID(),
    type: "current-assignment",
    participantId: participant.id,
    participantName: participant.displayName,
    taskId: task.id,
    task: task[state.language],
    finishedAt: new Date().toISOString(),
  };

  state.currentCallCycle.push(participant.id);
  state.currentCallAssignment = assignment;
  state.history.unshift(assignment);
  state.history = state.history.slice(0, 50);
  localStorage.setItem("meetPace.history", JSON.stringify(state.history));
  saveCurrentCallState();
  renderCurrentDraw();
  renderHistory();
  showToast(`${tr("assignmentGoesTo")} ${participant.displayName}`);
}

function renderDraw() {
  pruneAssignmentCycle();
  els.drawButton.disabled = state.participants.length === 0;
  const remaining = Math.max(0, state.participants.length - state.assignmentCycle.length);
  const participantWord = state.language === "ru"
    ? wordForm(remaining, "участник", "участника", "участников")
    : remaining === 1 ? "participant" : "participants";
  const progressText = state.participants.length
    ? remaining
      ? `${tr("progressRemaining")}: ${remaining} ${participantWord}`
      : tr("progressDone")
    : tr("progressEmpty");

  if (!state.currentAssignment) {
    els.drawResult.className = "draw-result";
    els.drawResult.innerHTML = `
      <span class="draw-placeholder-icon">?</span>
      <div><strong>${tr("drawPlaceholder")}</strong><small id="drawProgress"></small></div>`;
  } else {
    const assignment = state.currentAssignment;
    els.drawResult.className = "draw-result assigned";
    els.drawResult.innerHTML = "";
    const avatar = document.createElement("span");
    avatar.className = "draw-avatar";
    avatar.style.background = avatarColor(assignment.participantName);
    avatar.textContent = initials(assignment.participantName);
    const content = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = assignment.participantName;
    const taskText = document.createElement("div");
    taskText.className = "draw-task";
    taskText.textContent = localizedTask(assignment);
    const progress = document.createElement("small");
    progress.id = "drawProgress";
    content.append(name, taskText, progress);
    els.drawResult.append(avatar, content);
  }
  document.getElementById("drawProgress").textContent = progressText;
}

function renderCurrentDraw() {
  pruneCurrentCallCycle();
  els.currentDrawButton.disabled = state.participants.length === 0;
  const remaining = Math.max(0, state.participants.length - state.currentCallCycle.length);
  const participantWord = state.language === "ru"
    ? wordForm(remaining, "участник", "участника", "участников")
    : remaining === 1 ? "participant" : "participants";
  const progressText = state.participants.length
    ? remaining
      ? `${tr("progressRemaining")}: ${remaining} ${participantWord}`
      : tr("progressDone")
    : tr("progressEmpty");

  if (!state.currentCallAssignment) {
    els.currentDrawResult.className = "draw-result";
    els.currentDrawResult.innerHTML = `
      <span class="draw-placeholder-icon">?</span>
      <div><strong>${tr("currentDrawPlaceholder")}</strong><small id="currentDrawProgress"></small></div>`;
  } else {
    const assignment = state.currentCallAssignment;
    els.currentDrawResult.className = "draw-result assigned";
    els.currentDrawResult.innerHTML = "";
    const avatar = document.createElement("span");
    avatar.className = "draw-avatar";
    avatar.style.background = avatarColor(assignment.participantName);
    avatar.textContent = initials(assignment.participantName);
    const content = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = assignment.participantName;
    const taskText = document.createElement("div");
    taskText.className = "draw-task";
    taskText.textContent = localizedCurrentCallTask(assignment);
    const progress = document.createElement("small");
    progress.id = "currentDrawProgress";
    content.append(name, taskText, progress);
    els.currentDrawResult.append(avatar, content);
  }
  document.getElementById("currentDrawProgress").textContent = progressText;
}

function wordForm(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function renderParticipants() {
  els.participantCount.textContent = state.participants.length;
  els.clearParticipantsButton.disabled = state.participants.length === 0;
  if (!state.participants.length) {
    els.participantsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-orbit"><span></span></div>
        <h3>${tr("emptyTitle")}</h3>
        <p>${tr("emptyCopy")}</p>
      </div>`;
    return;
  }

  els.participantsList.replaceChildren(...state.participants.map((participant) => {
    const row = document.createElement("div");
    row.className = `participant${state.selectedParticipant?.id === participant.id ? " active" : ""}`;

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.background = avatarColor(participant.displayName);
    avatar.textContent = initials(participant.displayName);

    const info = document.createElement("span");
    info.className = "participant-info";
    const name = document.createElement("span");
    name.className = "participant-name";
    name.textContent = participant.displayName;
    const meta = document.createElement("span");
    meta.className = "participant-meta";
    const dot = document.createElement("span");
    dot.className = "presence-dot";
    meta.append(dot, tr("inQueue"));
    info.append(name, meta);

    const actions = document.createElement("span");
    actions.className = "participant-actions";
    const start = document.createElement("button");
    start.type = "button";
    start.className = "speak-button";
    start.textContent = state.selectedParticipant?.id === participant.id ? tr("selected") : tr("start");
    start.addEventListener("click", () => selectParticipant(participant));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-participant";
    remove.textContent = "×";
    remove.title = `${tr("delete")} ${participant.displayName}`;
    remove.setAttribute("aria-label", `${tr("delete")} ${participant.displayName}`);
    remove.addEventListener("click", () => removeParticipant(participant.id));
    actions.append(start, remove);

    row.append(avatar, info, actions);
    return row;
  }));
}

function selectParticipant(participant) {
  if (state.running && state.selectedParticipant?.id !== participant.id) finishTalk();
  state.selectedParticipant = participant;
  resetTimer(false);
  els.speakerName.textContent = participant.displayName;
  els.toggleTimerButton.disabled = false;
  els.resetTimerButton.disabled = false;
  els.finishTimerButton.disabled = false;
  renderParticipants();
  startTimer();
}

function setDuration(seconds) {
  state.durationSeconds = Math.max(30, Math.min(900, seconds));
  localStorage.setItem("meetPace.duration", String(state.durationSeconds));
  if (!state.running) state.remainingSeconds = state.durationSeconds;
  renderTimer();
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function elapsedSeconds() {
  if (!state.timerStartedAt) return state.elapsedBeforeStart;
  return state.elapsedBeforeStart + (Date.now() - state.timerStartedAt) / 1000;
}

function renderTimer() {
  const elapsed = state.durationSeconds - state.remainingSeconds;
  const progress = Math.max(0, Math.min(100, elapsed / state.durationSeconds * 100));
  const warning = state.remainingSeconds <= Math.min(30, state.durationSeconds * .25);
  const overtime = state.remainingSeconds < 0;
  els.timerRing.style.setProperty("--progress", progress.toFixed(2));
  els.timerRing.classList.toggle("warning", warning && state.selectedParticipant);
  els.timerValue.textContent = overtime ? `+${formatDuration(Math.abs(state.remainingSeconds))}` : formatDuration(state.remainingSeconds);
  els.durationDisplay.textContent = formatDuration(state.durationSeconds).replace(/^0/, "");
  els.toggleTimerButton.classList.toggle("paused", state.running);
  els.toggleTimerButton.setAttribute("aria-label", state.running ? tr("pauseTimer") : tr("startTimer"));
  els.resetTimerButton.setAttribute("aria-label", tr("resetTimer"));
  els.finishTimerButton.setAttribute("aria-label", tr("finishTalk"));
  els.timerStateBadge.textContent = overtime ? tr("overtime") : warning && state.running ? tr("warning") : state.running ? tr("running") : state.selectedParticipant ? tr("paused") : tr("ready");
  els.timerStateBadge.className = `timer-state${warning && state.running ? " warning" : state.running ? " running" : ""}`;
  els.timerCaption.textContent = overtime ? tr("timeUp") : tr("talkCaption");
}

function tick() {
  state.remainingSeconds = state.durationSeconds - elapsedSeconds();
  renderTimer();
  if (state.remainingSeconds <= 0 && !state.overtimeNotified) {
    state.overtimeNotified = true;
    showToast(`${tr("timeFinished")} ${state.selectedParticipant?.displayName || ""}`);
  }
}

function startTimer() {
  if (!state.selectedParticipant || state.running) return;
  state.timerStartedAt = Date.now();
  state.running = true;
  state.timerId = window.setInterval(tick, 200);
  renderTimer();
}

function pauseTimer() {
  if (!state.running) return;
  state.elapsedBeforeStart = elapsedSeconds();
  state.timerStartedAt = null;
  state.running = false;
  window.clearInterval(state.timerId);
  state.timerId = null;
  renderTimer();
}

function resetTimer(updateUi = true) {
  if (state.timerId) window.clearInterval(state.timerId);
  state.running = false;
  state.timerStartedAt = null;
  state.elapsedBeforeStart = 0;
  state.remainingSeconds = state.durationSeconds;
  state.timerId = null;
  state.overtimeNotified = false;
  if (updateUi) renderTimer();
}

function clearCurrentSpeaker() {
  resetTimer(false);
  state.selectedParticipant = null;
  els.speakerName.textContent = tr("selectParticipant");
  els.toggleTimerButton.disabled = true;
  els.resetTimerButton.disabled = true;
  els.finishTimerButton.disabled = true;
  renderTimer();
}

function finishTalk() {
  if (!state.selectedParticipant) return;
  const used = elapsedSeconds();
  if (used >= 1) {
    state.history.unshift({
      id: crypto.randomUUID(),
      type: "talk",
      participantName: state.selectedParticipant.displayName,
      duration: Math.round(used),
      limitSeconds: state.durationSeconds,
      overLimit: used > state.durationSeconds,
      finishedAt: new Date().toISOString(),
    });
    state.history = state.history.slice(0, 50);
    localStorage.setItem("meetPace.history", JSON.stringify(state.history));
  }
  clearCurrentSpeaker();
  renderParticipants();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = `<p class="history-empty">${tr("logEmpty")}</p>`;
    return;
  }
  els.historyList.replaceChildren(...state.history.map((item) => {
    const row = document.createElement("div");
    const isNextAssignment = item.type === "assignment";
    const isCurrentAssignment = item.type === "current-assignment";
    const isAssignment = isNextAssignment || isCurrentAssignment;
    const isOverLimit = !isAssignment && (item.overLimit === true || (Number.isFinite(item.limitSeconds) && item.duration > item.limitSeconds));
    row.className = `history-item${isOverLimit ? " over-limit" : ""}`;
    const icon = document.createElement("span");
    icon.className = `history-icon${isNextAssignment ? " assignment" : isCurrentAssignment ? " current-assignment" : ""}`;
    icon.textContent = isAssignment ? "★" : initials(item.participantName);
    const info = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = isAssignment
      ? `${tr(isCurrentAssignment ? "callTaskPrefix" : "taskPrefix")}: ${item.participantName}`
      : item.participantName;
    const time = document.createElement("small");
    time.textContent = new Date(item.finishedAt).toLocaleTimeString(state.language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });
    info.append(title);
    if (isAssignment) {
      const taskText = document.createElement("div");
      taskText.className = "history-task";
      taskText.textContent = isCurrentAssignment ? localizedCurrentCallTask(item) : localizedTask(item);
      info.append(taskText);
    }
    info.append(time);
    const duration = document.createElement("span");
    duration.className = "history-duration";
    duration.textContent = isAssignment ? tr(isCurrentAssignment ? "currentLabel" : "drawLabel") : formatDuration(item.duration);
    row.append(icon, info, duration);
    return row;
  }));
}

function showToast(message, error = false) {
  els.toast.textContent = message;
  els.toast.className = `toast show${error ? " error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.className = "toast", 3200);
}

els.participantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addParticipant(els.participantNameInput.value);
});

els.clearParticipantsButton.addEventListener("click", () => {
  state.participants = [];
  state.assignmentCycle = [];
  state.currentAssignment = null;
  state.currentCallCycle = [];
  state.currentCallAssignment = null;
  saveParticipants();
  saveAssignmentState();
  saveCurrentCallState();
  clearCurrentSpeaker();
  renderParticipants();
  renderDraw();
  renderCurrentDraw();
  showToast(tr("listCleared"));
});

els.toggleTimerButton.addEventListener("click", () => state.running ? pauseTimer() : startTimer());
els.resetTimerButton.addEventListener("click", () => resetTimer());
els.finishTimerButton.addEventListener("click", finishTalk);
els.decreaseDuration.addEventListener("click", () => setDuration(state.durationSeconds - 30));
els.increaseDuration.addEventListener("click", () => setDuration(state.durationSeconds + 30));
els.clearHistoryButton.addEventListener("click", () => {
  state.history = [];
  localStorage.removeItem("meetPace.history");
  renderHistory();
});
els.drawButton.addEventListener("click", drawAssignment);
els.currentDrawButton.addEventListener("click", drawCurrentCallAssignment);
document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

state.remainingSeconds = state.durationSeconds;
applyLanguage(state.language);
