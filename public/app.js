const state = {
  language: localStorage.getItem("standupHelper.language") || "en",
  participants: JSON.parse(localStorage.getItem("standupHelper.participants") || "[]"),
  selectedParticipant: null,
  durationSeconds: Number(localStorage.getItem("standupHelper.duration")) || 120,
  remainingSeconds: 120,
  timerStartedAt: null,
  elapsedBeforeStart: 0,
  timerId: null,
  running: false,
  overtimeNotified: false,
  history: JSON.parse(localStorage.getItem("standupHelper.history") || "[]"),
  assignmentCycle: JSON.parse(localStorage.getItem("standupHelper.assignmentCycle") || "[]"),
  currentAssignment: JSON.parse(localStorage.getItem("standupHelper.currentAssignment") || "null"),
  currentCallCycle: JSON.parse(localStorage.getItem("standupHelper.currentCallCycle") || "[]"),
  currentCallAssignment: JSON.parse(localStorage.getItem("standupHelper.currentCallAssignment") || "null"),
  assignmentLoading: false,
  currentCallLoading: false,
};

const ids = [
  "participantForm", "participantNameInput", "clearParticipantsButton",
  "participantsList", "participantCount", "speakerName", "timerStateBadge", "timerRing",
  "timerValue", "timerCaption", "toggleTimerButton", "resetTimerButton", "finishTimerButton",
  "decreaseDuration", "increaseDuration", "durationDisplay", "historyList",
  "clearHistoryButton", "drawButton", "drawResult", "drawProgress", "currentDrawButton",
  "currentDrawResult", "currentDrawProgress", "logoutButton", "toast"
];
const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const translations = {
  en: {
    pageTitle: "Standup Helper — speaker timer", description: "Participant queue, speaker timer, and team activities",
    eyebrow: "Effortless facilitation", heroLine1: "Time for every",
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
    generatingTask: "Generating task…", taskGenerationFailed: "Could not generate a task. Please try again.",
    openRouterNotConfigured: "OpenRouter is not configured for this deployment.",
    openRouterAuthError: "The OpenRouter API key was rejected. Check the key and restart the server.",
    openRouterPaymentRequired: "OpenRouter rejected the request because of the account balance or billing settings.",
    openRouterForbidden: "This API key does not have permission to use the selected model.",
    openRouterContentBlocked: "OpenRouter blocked this request with a content or workspace safety rule.",
    openRouterBadRequest: "The selected model could not accept this task request.",
    openRouterModelNotFound: "The configured OpenRouter model is unavailable or no longer exists.",
    openRouterRateLimit: "The free model rate limit was reached. Try again later.",
    openRouterTimeout: "The free model took too long to respond. Please try again.",
    openRouterPayloadTooLarge: "The request sent to OpenRouter was too large.",
    openRouterUnprocessable: "OpenRouter could not process the task request.",
    openRouterInternalError: "OpenRouter encountered an internal error. Please try again.",
    openRouterProviderError: "The model provider returned an error. Please try again.",
    openRouterUnavailable: "OpenRouter is temporarily unavailable. Please try again later.",
    openRouterGatewayTimeout: "The model provider did not respond in time.",
    openRouterProviderOverloaded: "The free model is overloaded. Please try again shortly.",
    openRouterDnsError: "Could not find the OpenRouter server. Check your internet or DNS settings.",
    openRouterNetworkBlocked: "The connection to OpenRouter was blocked by the system or firewall.",
    openRouterNetworkError: "Could not connect to OpenRouter. Check your internet connection.",
    openRouterInvalidResponse: "The model returned an empty or invalid task. Please try again.",
    openRouterUnknownError: "OpenRouter returned an unexpected error. Please try again.",
    serverUnavailable: "The Standup Helper service is unavailable. Check your connection and try again.",
    serverInvalidResponse: "The service returned an invalid response. Please try again.",
    serverRequestInvalid: "The app sent an invalid request to the service.",
    serverRequestTooLarge: "The task history is too large to send.",
    serverInternalError: "The service encountered an internal error.",
    clientRequestTimeout: "Task generation took too long and was cancelled.",
    retryAfter: "Try again in {seconds} seconds.", errorReference: "Reference",
    logout: "Log out", loggingOut: "Logging out…", logoutFailed: "Could not log out. Please try again.",
    sessionExpired: "Your admin session expired. Sign in again.",
  },
  ru: {
    pageTitle: "Standup Helper — таймер выступлений", description: "Очередь участников, таймер выступлений и командные активности",
    eyebrow: "Фасилитация без суеты", heroLine1: "Каждому — время",
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
    generatingTask: "Генерируем задание…", taskGenerationFailed: "Не удалось сгенерировать задание. Попробуйте ещё раз.",
    openRouterNotConfigured: "OpenRouter не настроен для этого приложения.",
    openRouterAuthError: "OpenRouter отклонил API-ключ. Проверьте ключ и перезапустите сервер.",
    openRouterPaymentRequired: "OpenRouter отклонил запрос из-за баланса или настроек оплаты аккаунта.",
    openRouterForbidden: "У API-ключа нет разрешения на использование выбранной модели.",
    openRouterContentBlocked: "OpenRouter заблокировал запрос правилом безопасности контента или рабочего пространства.",
    openRouterBadRequest: "Выбранная модель не смогла принять запрос на генерацию задания.",
    openRouterModelNotFound: "Настроенная модель OpenRouter недоступна или больше не существует.",
    openRouterRateLimit: "Лимит бесплатной модели исчерпан. Попробуйте позже.",
    openRouterTimeout: "Бесплатная модель отвечает слишком долго. Попробуйте ещё раз.",
    openRouterPayloadTooLarge: "Запрос к OpenRouter оказался слишком большим.",
    openRouterUnprocessable: "OpenRouter не смог обработать запрос на генерацию задания.",
    openRouterInternalError: "Внутренняя ошибка OpenRouter. Попробуйте ещё раз.",
    openRouterProviderError: "Провайдер модели вернул ошибку. Попробуйте ещё раз.",
    openRouterUnavailable: "OpenRouter временно недоступен. Попробуйте позже.",
    openRouterGatewayTimeout: "Провайдер модели не успел ответить.",
    openRouterProviderOverloaded: "Бесплатная модель перегружена. Попробуйте ещё раз чуть позже.",
    openRouterDnsError: "Не удалось найти сервер OpenRouter. Проверьте интернет или настройки DNS.",
    openRouterNetworkBlocked: "Подключение к OpenRouter заблокировано системой или файрволом.",
    openRouterNetworkError: "Не удалось подключиться к OpenRouter. Проверьте интернет-соединение.",
    openRouterInvalidResponse: "Модель вернула пустое или некорректное задание. Попробуйте ещё раз.",
    openRouterUnknownError: "OpenRouter вернул неизвестную ошибку. Попробуйте ещё раз.",
    serverUnavailable: "Сервис Standup Helper недоступен. Проверьте подключение и попробуйте ещё раз.",
    serverInvalidResponse: "Сервис вернул некорректный ответ. Попробуйте ещё раз.",
    serverRequestInvalid: "Приложение отправило сервису некорректный запрос.",
    serverRequestTooLarge: "История заданий слишком велика для отправки.",
    serverInternalError: "В сервисе произошла внутренняя ошибка.",
    clientRequestTimeout: "Генерация заняла слишком много времени и была отменена.",
    retryAfter: "Повторите через {seconds} сек.", errorReference: "Код ошибки",
    logout: "Выйти", loggingOut: "Выходим…", logoutFailed: "Не удалось выйти. Попробуйте ещё раз.",
    sessionExpired: "Сессия администратора закончилась. Войдите снова.",
  },
};

function tr(key) {
  return translations[state.language][key] || key;
}

function localizedTask(assignment) {
  return state.language === "ru"
    ? assignment.taskRu || assignment.task || assignment.taskEn || ""
    : assignment.taskEn || assignment.task || assignment.taskRu || "";
}

function applyLanguage(language) {
  state.language = language === "ru" ? "ru" : "en";
  localStorage.setItem("standupHelper.language", state.language);
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
  localStorage.setItem("standupHelper.participants", JSON.stringify(state.participants));
}

function saveAssignmentState() {
  localStorage.setItem("standupHelper.assignmentCycle", JSON.stringify(state.assignmentCycle));
  localStorage.setItem("standupHelper.currentAssignment", JSON.stringify(state.currentAssignment));
}

function saveCurrentCallState() {
  localStorage.setItem("standupHelper.currentCallCycle", JSON.stringify(state.currentCallCycle));
  localStorage.setItem("standupHelper.currentCallAssignment", JSON.stringify(state.currentCallAssignment));
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

function recentGeneratedTasks(type) {
  return state.history
    .filter((item) => item.type === type)
    .slice(0, 12)
    .map((item) => item.taskEn || item.taskRu || item.task)
    .filter(Boolean);
}

async function requestGeneratedTask(kind, historyType) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65_000);
  let response;
  try {
    response = await fetch("/api/task", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, recentTasks: recentGeneratedTasks(historyType) }),
    });
  } catch (fetchError) {
    const error = new Error(fetchError.name === "AbortError" ? "CLIENT_REQUEST_TIMEOUT" : "SERVER_UNAVAILABLE");
    error.code = fetchError.name === "AbortError" ? "CLIENT_REQUEST_TIMEOUT" : "SERVER_UNAVAILABLE";
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error("SERVER_INVALID_RESPONSE");
    error.code = "SERVER_INVALID_RESPONSE";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.code || "OPENROUTER_ERROR");
    error.code = payload.code || "OPENROUTER_ERROR";
    error.requestId = payload.requestId;
    error.retryAfterSeconds = payload.retryAfterSeconds;
    if (error.code === "AUTH_REQUIRED") {
      window.setTimeout(() => window.location.replace("/"), 1200);
    }
    throw error;
  }
  if (!payload.taskEn || !payload.taskRu) {
    const error = new Error("INVALID_MODEL_RESPONSE");
    error.code = "INVALID_MODEL_RESPONSE";
    throw error;
  }
  return payload;
}

function taskErrorMessage(error) {
  const keys = {
    OPENROUTER_NOT_CONFIGURED: "openRouterNotConfigured",
    OPENROUTER_AUTH_ERROR: "openRouterAuthError",
    OPENROUTER_PAYMENT_REQUIRED: "openRouterPaymentRequired",
    OPENROUTER_FORBIDDEN: "openRouterForbidden",
    OPENROUTER_CONTENT_BLOCKED: "openRouterContentBlocked",
    OPENROUTER_BAD_REQUEST: "openRouterBadRequest",
    OPENROUTER_MODEL_NOT_FOUND: "openRouterModelNotFound",
    OPENROUTER_RATE_LIMIT: "openRouterRateLimit",
    OPENROUTER_TIMEOUT: "openRouterTimeout",
    OPENROUTER_PAYLOAD_TOO_LARGE: "openRouterPayloadTooLarge",
    OPENROUTER_UNPROCESSABLE_REQUEST: "openRouterUnprocessable",
    OPENROUTER_INTERNAL_ERROR: "openRouterInternalError",
    OPENROUTER_PROVIDER_ERROR: "openRouterProviderError",
    OPENROUTER_UNAVAILABLE: "openRouterUnavailable",
    OPENROUTER_GATEWAY_TIMEOUT: "openRouterGatewayTimeout",
    OPENROUTER_PROVIDER_OVERLOADED: "openRouterProviderOverloaded",
    OPENROUTER_DNS_ERROR: "openRouterDnsError",
    OPENROUTER_NETWORK_BLOCKED: "openRouterNetworkBlocked",
    OPENROUTER_NETWORK_ERROR: "openRouterNetworkError",
    OPENROUTER_INVALID_RESPONSE: "openRouterInvalidResponse",
    OPENROUTER_ERROR: "openRouterUnknownError",
    INVALID_MODEL_RESPONSE: "openRouterInvalidResponse",
    SERVER_UNAVAILABLE: "serverUnavailable",
    SERVER_INVALID_RESPONSE: "serverInvalidResponse",
    INVALID_JSON: "serverRequestInvalid",
    INVALID_TASK_KIND: "serverRequestInvalid",
    INVALID_RECENT_TASKS: "serverRequestInvalid",
    UNSUPPORTED_MEDIA_TYPE: "serverRequestInvalid",
    METHOD_NOT_ALLOWED: "serverRequestInvalid",
    INVALID_URL: "serverRequestInvalid",
    REQUEST_TOO_LARGE: "serverRequestTooLarge",
    INTERNAL_SERVER_ERROR: "serverInternalError",
    CLIENT_REQUEST_TIMEOUT: "clientRequestTimeout",
    AUTH_REQUIRED: "sessionExpired",
  };
  let message = tr(keys[error.code] || "taskGenerationFailed");
  if (Number.isFinite(error.retryAfterSeconds)) {
    message += ` ${tr("retryAfter").replace("{seconds}", Math.ceil(error.retryAfterSeconds))}`;
  }
  if (error.requestId && ["INTERNAL_SERVER_ERROR", "OPENROUTER_ERROR"].includes(error.code)) {
    message += ` ${tr("errorReference")}: ${String(error.requestId).slice(0, 8)}`;
  }
  return message;
}

async function drawAssignment() {
  if (!state.participants.length || state.assignmentLoading) return;
  pruneAssignmentCycle();
  let eligible = state.participants.filter((participant) => !state.assignmentCycle.includes(participant.id));
  if (!eligible.length) {
    state.assignmentCycle = [];
    eligible = [...state.participants];
  }

  const participant = randomItem(eligible);
  state.assignmentLoading = true;
  renderDraw();
  try {
    const generated = await requestGeneratedTask("next", "assignment");
    const assignment = {
      id: crypto.randomUUID(),
      type: "assignment",
      participantId: participant.id,
      participantName: participant.displayName,
      taskEn: generated.taskEn,
      taskRu: generated.taskRu,
      task: state.language === "ru" ? generated.taskRu : generated.taskEn,
      model: generated.model,
      finishedAt: new Date().toISOString(),
    };

    state.assignmentCycle.push(participant.id);
    state.currentAssignment = assignment;
    state.history.unshift(assignment);
    state.history = state.history.slice(0, 50);
    localStorage.setItem("standupHelper.history", JSON.stringify(state.history));
    saveAssignmentState();
    renderHistory();
    showToast(`${tr("assignmentGoesTo")} ${participant.displayName}`);
  } catch (error) {
    showToast(taskErrorMessage(error), true);
  } finally {
    state.assignmentLoading = false;
    renderDraw();
  }
}

async function drawCurrentCallAssignment() {
  if (!state.participants.length || state.currentCallLoading) return;
  pruneCurrentCallCycle();
  let eligible = state.participants.filter((participant) => !state.currentCallCycle.includes(participant.id));
  if (!eligible.length) {
    state.currentCallCycle = [];
    eligible = [...state.participants];
  }

  const participant = randomItem(eligible);
  state.currentCallLoading = true;
  renderCurrentDraw();
  try {
    const generated = await requestGeneratedTask("current", "current-assignment");
    const assignment = {
      id: crypto.randomUUID(),
      type: "current-assignment",
      participantId: participant.id,
      participantName: participant.displayName,
      taskEn: generated.taskEn,
      taskRu: generated.taskRu,
      task: state.language === "ru" ? generated.taskRu : generated.taskEn,
      model: generated.model,
      finishedAt: new Date().toISOString(),
    };

    state.currentCallCycle.push(participant.id);
    state.currentCallAssignment = assignment;
    state.history.unshift(assignment);
    state.history = state.history.slice(0, 50);
    localStorage.setItem("standupHelper.history", JSON.stringify(state.history));
    saveCurrentCallState();
    renderHistory();
    showToast(`${tr("assignmentGoesTo")} ${participant.displayName}`);
  } catch (error) {
    showToast(taskErrorMessage(error), true);
  } finally {
    state.currentCallLoading = false;
    renderCurrentDraw();
  }
}

function renderDraw() {
  pruneAssignmentCycle();
  els.drawButton.disabled = state.participants.length === 0 || state.assignmentLoading;
  els.drawButton.classList.toggle("loading", state.assignmentLoading);
  els.drawButton.querySelector("span").textContent = tr(state.assignmentLoading ? "generatingTask" : "drawParticipant");
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
  els.currentDrawButton.disabled = state.participants.length === 0 || state.currentCallLoading;
  els.currentDrawButton.classList.toggle("loading", state.currentCallLoading);
  els.currentDrawButton.querySelector("span").textContent = tr(state.currentCallLoading ? "generatingTask" : "currentDrawParticipant");
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
    taskText.textContent = localizedTask(assignment);
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
  localStorage.setItem("standupHelper.duration", String(state.durationSeconds));
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
    localStorage.setItem("standupHelper.history", JSON.stringify(state.history));
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
      taskText.textContent = localizedTask(item);
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
  els.toast.setAttribute("role", error ? "alert" : "status");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.className = "toast", error ? 6000 : 3200);
}

async function logout() {
  if (els.logoutButton.disabled) return;
  els.logoutButton.disabled = true;
  els.logoutButton.textContent = tr("loggingOut");
  try {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("LOGOUT_FAILED");
    window.location.replace("/");
  } catch {
    els.logoutButton.disabled = false;
    els.logoutButton.textContent = tr("logout");
    showToast(tr("logoutFailed"), true);
  }
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
  localStorage.removeItem("standupHelper.history");
  renderHistory();
});
els.drawButton.addEventListener("click", drawAssignment);
els.currentDrawButton.addEventListener("click", drawCurrentCallAssignment);
els.logoutButton.addEventListener("click", logout);
document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

state.remainingSeconds = state.durationSeconds;
applyLanguage(state.language);
