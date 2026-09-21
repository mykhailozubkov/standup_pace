const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let room = null;
let meetingState = { activeMeeting: null, recentMeetings: [] };
let speechState = { activeSpeech: null, recentSpeeches: [] };
let assignmentState = {
  activeMeetingId: null,
  currentDraw: { available: false, cycleNumber: 1, remaining: 0, total: 0, latestAssignment: null },
  nextDraw: { available: false, cycleNumber: 1, remaining: 0, total: 0, latestAssignment: null },
  recentAssignments: [],
  myAssignments: [],
};
let assignmentLoadingKind = null;
let quizzes = [];
let quizGameState = { currentGame: null, games: [] };
let roomSocket = null;
let roomSocketRetry = 0;
let roomSocketRetryTimer = null;
let realtimeRefreshTimer = null;
let realtimeStopped = false;

const translations = {
  en: {
    pageTitle: "Standup Helper — room",
    description: "Standup Helper room",
    allRooms: "All rooms",
    loading: "Loading room…",
    room: "Room",
    roomCopy: "The shared space for participants, speaking time, tasks, and team quizzes.",
    inviteCode: "Invitation code",
    copyCode: "Copy code",
    copied: "Code copied",
    people: "People",
    members: "Members",
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    you: "You",
    settings: "Settings",
    defaultTalk: "Default talk limit",
    settingsReadOnlyCopy: "Room administrators manage these settings.",
    roomName: "Room name",
    talkLimitSeconds: "Talk limit in seconds",
    saveSettings: "Save settings",
    settingsSaved: "Room settings saved",
    makeAdmin: "Make admin",
    makeMember: "Make member",
    removeMember: "Remove",
    roleSaved: "Member role updated",
    memberRemoved: "Member removed",
    removeConfirm: "Remove this participant from the room:",
    roomAccess: "Room access",
    membership: "Membership",
    ownerMembershipCopy: "Archiving closes this room for every participant. This cannot be undone from the app yet.",
    memberMembershipCopy: "You can leave this room. You can join it again later with the invitation code.",
    leaveRoom: "Leave room",
    archiveRoom: "Archive room",
    leaveConfirm: "Leave this room?",
    archiveConfirm: "Archive this room for every participant?",
    invalidRoomName: "Enter a room name up to 120 characters.",
    invalidTalkLimit: "Talk time must be between 15 and 3600 seconds.",
    forbidden: "You do not have permission for this action.",
    conflict: "This action conflicts with the current room state.",
    requestFailed: "The change could not be saved.",
    standup: "Standup",
    activeMeeting: "Meeting in progress",
    noActiveMeeting: "No active meeting",
    activeMeetingTitle: "The team is meeting now",
    noActiveMeetingTitle: "Ready for the next standup",
    startedBy: "Started by",
    startStandup: "Start standup",
    endStandup: "Finish standup",
    refreshStatus: "Refresh status",
    meetingStarted: "Standup started",
    meetingEnded: "Standup finished",
    meetingAlreadyActive: "A standup is already active in this room.",
    finishMeetingBeforeArchive: "Finish the active standup before archiving this room.",
    meetingUnavailable: "Meeting status is temporarily unavailable.",
    standupHistory: "Standup history",
    recentMeetings: "Recent meetings",
    noMeetingHistory: "Completed standups will appear here.",
    completedBy: "Finished by",
    talkLimitLabel: "Talk limit",
    speakerTimer: "Speaker timer",
    noActiveSpeaker: "No active speaker",
    waitingForSpeaker: "Start a turn from the participant list.",
    startTurn: "Start turn",
    speaking: "Speaking",
    paused: "Paused",
    speechLimit: "Limit",
    pauseSpeech: "Pause",
    resumeSpeech: "Resume",
    finishSpeech: "Finish turn",
    speechStarted: "Speaker timer started",
    speechPaused: "Speaker timer paused",
    speechResumed: "Speaker timer resumed",
    speechFinished: "Speaker turn finished",
    speechAlreadyActive: "Finish the current speaker before starting another turn.",
    finishSpeechBeforeMeeting: "Finish the current speaker before ending the standup.",
    overLimit: "Over the limit",
    withinLimit: "Within the limit",
    thisStandup: "This standup",
    spontaneousTask: "Spontaneous task",
    currentTaskCopy: "Generate a light task for someone to complete during this call.",
    drawCurrentTask: "Draw for this standup",
    nextStandup: "Next standup",
    preparationTask: "Preparation task",
    nextTaskCopy: "Generate a small task to prepare and present at the next call.",
    drawNextTask: "Draw for the next standup",
    generatingTask: "Generating task…",
    noTaskYet: "No task has been assigned yet.",
    startStandupForTask: "Start a standup to draw a current-call task.",
    remainingInRound: "Remaining in round",
    roundComplete: "Round complete — the next draw starts a new one",
    round: "Round",
    assignedTo: "Assigned to",
    personal: "Personal",
    myTasks: "My tasks",
    noMyTasks: "Tasks assigned to you will appear here.",
    currentTask: "This standup",
    nextTask: "Next standup",
    roomHistory: "Room history",
    activityLog: "Activity log",
    noActivity: "Completed talks and assigned tasks will appear here.",
    spokeFor: "Spoke for",
    taskAssigned: "Task assigned",
    assignedBy: "Assigned by",
    taskGenerated: "Task generated and assigned",
    taskGenerationFailed: "Could not generate and assign a task. Please try again.",
    openRouterNotConfigured: "Task generation is not configured on the server.",
    openRouterAuth: "OpenRouter rejected the API key.",
    openRouterPayment: "The OpenRouter account has no available credits.",
    openRouterRate: "OpenRouter rate limit reached. Try again shortly.",
    openRouterModel: "The selected task model is unavailable.",
    openRouterBlocked: "The model declined this task. Try generating another one.",
    openRouterTimeout: "Task generation timed out. Try again.",
    openRouterUnavailable: "The task model is temporarily unavailable.",
    invalidModelResponse: "The model returned an invalid task. Try again.",
    quizLibrary: "Quiz library",
    liveQuiz: "Live quiz",
    waitingLobby: "Waiting for players",
    quizInProgress: "Quiz in progress",
    quizPlayers: "players",
    hostedBy: "Hosted by",
    openQuizGame: "Open game",
    quizzes: "Quizzes",
    quizzesCopy: "Prepare reusable question sets for future live games in this room.",
    createQuiz: "Create quiz",
    noQuizzes: "No quizzes yet",
    noQuizzesCopy: "Room administrators can prepare the first question set.",
    quizTemplate: "Draft template",
    questionsOne: "question",
    questionsFew: "questions",
    questionsMany: "questions",
    updatedBy: "Updated by",
    editQuiz: "Edit",
    launchQuiz: "Launch game",
    launchingQuiz: "Launching…",
    quizGameAlreadyOpen: "Another quiz game is already open in this room.",
    quizGameCreateFailed: "Could not open the quiz lobby.",
    archiveQuiz: "Archive",
    archiveQuizConfirm: "Archive this quiz? It will disappear from the room list.",
    quizArchived: "Quiz archived",
    quizLoadFailed: "Could not load quizzes.",
    notFound: "This room is unavailable or you are not a member.",
    unavailable: "Could not load the room.",
  },
  ru: {
    pageTitle: "Standup Helper — комната",
    description: "Комната Standup Helper",
    allRooms: "Все комнаты",
    loading: "Загружаем комнату…",
    room: "Комната",
    roomCopy: "Общее пространство для участников, времени выступлений, заданий и командных викторин.",
    inviteCode: "Код приглашения",
    copyCode: "Скопировать код",
    copied: "Код скопирован",
    people: "Люди",
    members: "Участники",
    owner: "Владелец",
    admin: "Администратор",
    member: "Участник",
    you: "Вы",
    settings: "Настройки",
    defaultTalk: "Лимит выступления",
    settingsReadOnlyCopy: "Этими настройками управляют администраторы комнаты.",
    roomName: "Название комнаты",
    talkLimitSeconds: "Лимит выступления в секундах",
    saveSettings: "Сохранить настройки",
    settingsSaved: "Настройки комнаты сохранены",
    makeAdmin: "Назначить администратором",
    makeMember: "Сделать участником",
    removeMember: "Исключить",
    roleSaved: "Роль участника обновлена",
    memberRemoved: "Участник исключён",
    removeConfirm: "Исключить участника из комнаты:",
    roomAccess: "Доступ к комнате",
    membership: "Участие",
    ownerMembershipCopy: "Архивирование закроет комнату для всех участников. Восстановить её из приложения пока нельзя.",
    memberMembershipCopy: "Вы можете выйти из комнаты и позже войти снова по коду приглашения.",
    leaveRoom: "Выйти из комнаты",
    archiveRoom: "Архивировать комнату",
    leaveConfirm: "Выйти из этой комнаты?",
    archiveConfirm: "Архивировать комнату для всех участников?",
    invalidRoomName: "Введите название комнаты длиной до 120 символов.",
    invalidTalkLimit: "Время должно быть от 15 до 3600 секунд.",
    forbidden: "У вас нет прав для этого действия.",
    conflict: "Действие недоступно в текущем состоянии комнаты.",
    requestFailed: "Не удалось сохранить изменение.",
    standup: "Стендап",
    activeMeeting: "Встреча идёт",
    noActiveMeeting: "Нет активной встречи",
    activeMeetingTitle: "Команда сейчас на встрече",
    noActiveMeetingTitle: "Можно начинать следующий стендап",
    startedBy: "Начал(а)",
    startStandup: "Начать стендап",
    endStandup: "Завершить стендап",
    refreshStatus: "Обновить статус",
    meetingStarted: "Стендап начат",
    meetingEnded: "Стендап завершён",
    meetingAlreadyActive: "В этой комнате уже идёт стендап.",
    finishMeetingBeforeArchive: "Завершите активный стендап перед архивированием комнаты.",
    meetingUnavailable: "Статус встречи временно недоступен.",
    standupHistory: "История стендапов",
    recentMeetings: "Последние встречи",
    noMeetingHistory: "Завершённые стендапы появятся здесь.",
    completedBy: "Завершил(а)",
    talkLimitLabel: "Лимит выступления",
    speakerTimer: "Таймер выступлений",
    noActiveSpeaker: "Нет активного выступления",
    waitingForSpeaker: "Запустите выступление из списка участников.",
    startTurn: "Начать выступление",
    speaking: "Выступает",
    paused: "На паузе",
    speechLimit: "Лимит",
    pauseSpeech: "Пауза",
    resumeSpeech: "Продолжить",
    finishSpeech: "Завершить выступление",
    speechStarted: "Таймер выступления запущен",
    speechPaused: "Таймер поставлен на паузу",
    speechResumed: "Таймер продолжен",
    speechFinished: "Выступление завершено",
    speechAlreadyActive: "Завершите текущее выступление перед запуском следующего.",
    finishSpeechBeforeMeeting: "Завершите текущее выступление перед окончанием стендапа.",
    overLimit: "Лимит превышен",
    withinLimit: "В пределах лимита",
    thisStandup: "На этом стендапе",
    spontaneousTask: "Импровизационное задание",
    currentTaskCopy: "Сгенерируйте лёгкое задание, которое участник выполнит во время звонка.",
    drawCurrentTask: "Выбрать на этот стендап",
    nextStandup: "Следующий стендап",
    preparationTask: "Задание на подготовку",
    nextTaskCopy: "Сгенерируйте небольшое задание для подготовки к следующему звонку.",
    drawNextTask: "Выбрать на следующий стендап",
    generatingTask: "Генерируем задание…",
    noTaskYet: "Задание ещё не выдавалось.",
    startStandupForTask: "Начните стендап, чтобы выдать задание на текущий звонок.",
    remainingInRound: "Осталось в круге",
    roundComplete: "Круг завершён — следующий выбор начнёт новый",
    round: "Круг",
    assignedTo: "Задание получает",
    personal: "Личное",
    myTasks: "Мои задания",
    noMyTasks: "Выданные вам задания появятся здесь.",
    currentTask: "На этом стендапе",
    nextTask: "К следующему стендапу",
    roomHistory: "История комнаты",
    activityLog: "Лог действий",
    noActivity: "Завершённые выступления и выданные задания появятся здесь.",
    spokeFor: "Выступление",
    taskAssigned: "Выдано задание",
    assignedBy: "Выдал(а)",
    taskGenerated: "Задание сгенерировано и выдано",
    taskGenerationFailed: "Не удалось сгенерировать и выдать задание. Попробуйте ещё раз.",
    openRouterNotConfigured: "Генерация заданий не настроена на сервере.",
    openRouterAuth: "OpenRouter отклонил API-ключ.",
    openRouterPayment: "На аккаунте OpenRouter нет доступных средств.",
    openRouterRate: "Превышен лимит запросов OpenRouter. Попробуйте немного позже.",
    openRouterModel: "Выбранная модель заданий недоступна.",
    openRouterBlocked: "Модель отклонила это задание. Попробуйте сгенерировать другое.",
    openRouterTimeout: "Генерация заняла слишком много времени. Попробуйте ещё раз.",
    openRouterUnavailable: "Модель заданий временно недоступна.",
    invalidModelResponse: "Модель вернула некорректное задание. Попробуйте ещё раз.",
    quizLibrary: "Библиотека викторин",
    liveQuiz: "Идёт викторина",
    waitingLobby: "Ожидаем игроков",
    quizInProgress: "Викторина идёт",
    quizPlayers: "игроков",
    hostedBy: "Ведущий",
    openQuizGame: "Открыть игру",
    quizzes: "Викторины",
    quizzesCopy: "Подготовьте наборы вопросов для будущих игр в этой комнате.",
    createQuiz: "Создать викторину",
    noQuizzes: "Викторин пока нет",
    noQuizzesCopy: "Администраторы комнаты могут подготовить первый набор вопросов.",
    quizTemplate: "Черновик",
    questionsOne: "вопрос",
    questionsFew: "вопроса",
    questionsMany: "вопросов",
    updatedBy: "Обновил(а)",
    editQuiz: "Редактировать",
    launchQuiz: "Запустить игру",
    launchingQuiz: "Запускаем…",
    quizGameAlreadyOpen: "В этой комнате уже открыта другая викторина.",
    quizGameCreateFailed: "Не удалось открыть лобби викторины.",
    archiveQuiz: "Архивировать",
    archiveQuizConfirm: "Архивировать эту викторину? Она исчезнет из списка комнаты.",
    quizArchived: "Викторина архивирована",
    quizLoadFailed: "Не удалось загрузить викторины.",
    notFound: "Комната недоступна или вы не являетесь её участником.",
    unavailable: "Не удалось загрузить комнату.",
  },
};

const loading = document.getElementById("roomLoading");
const content = document.getElementById("roomContent");
const roomName = document.getElementById("roomName");
const roomRole = document.getElementById("roomRole");
const roomCode = document.getElementById("roomCode");
const memberCount = document.getElementById("memberCount");
const membersList = document.getElementById("membersList");
const talkLimitValue = document.getElementById("talkLimitValue");
const copyCodeButton = document.getElementById("copyCodeButton");
const toast = document.getElementById("toast");
const settingsReadOnly = document.getElementById("settingsReadOnly");
const roomSettingsForm = document.getElementById("roomSettingsForm");
const roomNameInput = document.getElementById("roomNameInput");
const talkLimitInput = document.getElementById("talkLimitInput");
const settingsMessage = document.getElementById("settingsMessage");
const membershipCopy = document.getElementById("membershipCopy");
const leaveRoomButton = document.getElementById("leaveRoomButton");
const archiveRoomButton = document.getElementById("archiveRoomButton");
const meetingCard = document.getElementById("meetingCard");
const meetingStatusDot = document.getElementById("meetingStatusDot");
const meetingStatus = document.getElementById("meetingStatus");
const meetingTitle = document.getElementById("meetingTitle");
const meetingElapsed = document.getElementById("meetingElapsed");
const meetingCopy = document.getElementById("meetingCopy");
const meetingActionButton = document.getElementById("meetingActionButton");
const refreshMeetingButton = document.getElementById("refreshMeetingButton");
const meetingHistoryList = document.getElementById("meetingHistoryList");
const speakerCard = document.getElementById("speakerCard");
const speechStatusDot = document.getElementById("speechStatusDot");
const speechStatus = document.getElementById("speechStatus");
const speechSpeakerName = document.getElementById("speechSpeakerName");
const speechElapsed = document.getElementById("speechElapsed");
const speechCopy = document.getElementById("speechCopy");
const speechActions = document.getElementById("speechActions");
const speechPauseButton = document.getElementById("speechPauseButton");
const speechFinishButton = document.getElementById("speechFinishButton");
const currentAssignmentCard = document.getElementById("currentAssignmentCard");
const currentAssignmentResult = document.getElementById("currentAssignmentResult");
const currentAssignmentButton = document.getElementById("currentAssignmentButton");
const nextAssignmentResult = document.getElementById("nextAssignmentResult");
const nextAssignmentButton = document.getElementById("nextAssignmentButton");
const myTaskCount = document.getElementById("myTaskCount");
const myTasksList = document.getElementById("myTasksList");
const activityHistoryList = document.getElementById("activityHistoryList");
const quizCount = document.getElementById("quizCount");
const quizzesList = document.getElementById("quizzesList");
const createQuizLink = document.getElementById("createQuizLink");
const liveQuizPanel = document.getElementById("liveQuizPanel");
const liveQuizTitle = document.getElementById("liveQuizTitle");
const liveQuizStatus = document.getElementById("liveQuizStatus");
const liveQuizMeta = document.getElementById("liveQuizMeta");
const openQuizGameLink = document.getElementById("openQuizGameLink");

function tr(key) {
  return translations[language][key] || key;
}

function roleLabel(role) {
  return tr(role === "owner" ? "owner" : role === "admin" ? "admin" : "member");
}

function localizedTask(assignment) {
  return language === "ru" ? assignment.taskRu : assignment.taskEn;
}

function formattedDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function showToast(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2400);
}

function errorMessage(error) {
  if (error?.code === "INVALID_ROOM_NAME") return tr("invalidRoomName");
  if (error?.code === "INVALID_TALK_LIMIT") return tr("invalidTalkLimit");
  if (error?.code === "ROOM_FORBIDDEN") return tr("forbidden");
  if (error?.code === "MEETING_ALREADY_ACTIVE") return tr("meetingAlreadyActive");
  if (error?.code === "MEETING_ACTIVE") return tr("finishMeetingBeforeArchive");
  if (error?.code === "SPEECH_ALREADY_ACTIVE") return tr("speechAlreadyActive");
  if (error?.code === "SPEECH_ACTIVE") return tr("finishSpeechBeforeMeeting");
  const taskErrors = {
    OPENROUTER_NOT_CONFIGURED: "openRouterNotConfigured",
    OPENROUTER_AUTH_ERROR: "openRouterAuth",
    OPENROUTER_FORBIDDEN: "openRouterAuth",
    OPENROUTER_PAYMENT_REQUIRED: "openRouterPayment",
    OPENROUTER_RATE_LIMIT: "openRouterRate",
    OPENROUTER_MODEL_NOT_FOUND: "openRouterModel",
    OPENROUTER_CONTENT_BLOCKED: "openRouterBlocked",
    OPENROUTER_TIMEOUT: "openRouterTimeout",
    OPENROUTER_GATEWAY_TIMEOUT: "openRouterTimeout",
    OPENROUTER_UNAVAILABLE: "openRouterUnavailable",
    OPENROUTER_PROVIDER_ERROR: "openRouterUnavailable",
    OPENROUTER_PROVIDER_OVERLOADED: "openRouterUnavailable",
    OPENROUTER_INTERNAL_ERROR: "openRouterUnavailable",
    OPENROUTER_NETWORK_ERROR: "openRouterUnavailable",
    OPENROUTER_DNS_ERROR: "openRouterUnavailable",
    OPENROUTER_INVALID_RESPONSE: "invalidModelResponse",
    INVALID_MODEL_RESPONSE: "invalidModelResponse",
  };
  if (taskErrors[error?.code]) return tr(taskErrors[error.code]);
  if (["OWNER_CANNOT_LEAVE", "OWNER_CANNOT_BE_REMOVED", "OWNER_ROLE_IMMUTABLE"].includes(error?.code)) {
    return tr("conflict");
  }
  return tr("requestFailed");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers,
  });
  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("AUTH_REQUIRED");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.code || "REQUEST_FAILED"), payload);
  return payload;
}

function scheduleRealtimeRefresh() {
  if (realtimeRefreshTimer || document.visibilityState !== "visible") return;
  realtimeRefreshTimer = window.setTimeout(async () => {
    realtimeRefreshTimer = null;
    await loadRoom();
  }, 150);
}

function scheduleRoomSocketReconnect() {
  if (realtimeStopped || !room || roomSocketRetryTimer) return;
  const delay = Math.min(15_000, 1_000 * (2 ** roomSocketRetry));
  roomSocketRetry = Math.min(roomSocketRetry + 1, 4);
  roomSocketRetryTimer = window.setTimeout(() => {
    roomSocketRetryTimer = null;
    connectRoomRealtime();
  }, delay);
}

function connectRoomRealtime() {
  if (!room || realtimeStopped) return;
  if (roomSocket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(roomSocket.readyState)) return;

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${location.host}/api/rooms/${encodeURIComponent(room.id)}/live`,
  );
  roomSocket = socket;

  socket.addEventListener("open", () => {
    roomSocketRetry = 0;
    scheduleRealtimeRefresh();
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "pong") return;
    try {
      const roomEvent = JSON.parse(event.data);
      if (roomEvent.roomId === room?.id) scheduleRealtimeRefresh();
    } catch {
      // Ignore unknown messages and keep the connection alive.
    }
  });
  socket.addEventListener("close", () => {
    if (roomSocket === socket) roomSocket = null;
    scheduleRoomSocketReconnect();
  });
  socket.addEventListener("error", () => {
    try {
      socket.close();
    } catch {
      // The browser may already have closed the connection.
    }
  });
}

function applyLanguage(nextLanguage) {
  language = nextLanguage === "ru" ? "ru" : "en";
  localStorage.setItem(languageKey, language);
  document.documentElement.lang = language;
  document.title = room ? `${room.name} — Standup Helper` : tr("pageTitle");
  document.querySelector('meta[name="description"]').content = tr("description");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (room) renderRoom();
  if (room) renderMeetingState();
  if (room) renderSpeechState();
  if (room) renderAssignmentState();
  if (room) renderQuizGameState();
  if (room) renderQuizzes();
}

function renderRoom() {
  roomName.textContent = room.name;
  roomRole.textContent = roleLabel(room.role);
  roomRole.className = `role-pill role-${room.role}`;
  roomCode.textContent = room.joinCode;
  memberCount.textContent = String(room.members.length);
  talkLimitValue.textContent = formattedDuration(room.defaultTalkLimitSeconds);
  document.title = `${room.name} — Standup Helper`;

  const canManageSettings = room.role === "owner" || room.role === "admin";
  settingsReadOnly.hidden = canManageSettings;
  roomSettingsForm.hidden = !canManageSettings;
  roomNameInput.value = room.name;
  talkLimitInput.value = String(room.defaultTalkLimitSeconds);
  membershipCopy.textContent = tr(room.role === "owner" ? "ownerMembershipCopy" : "memberMembershipCopy");
  archiveRoomButton.hidden = room.role !== "owner";
  leaveRoomButton.hidden = room.role === "owner";

  membersList.replaceChildren();
  room.members.forEach((member) => {
    const item = document.createElement("div");
    item.className = "room-member";
    const avatar = document.createElement("span");
    avatar.className = "room-member-avatar";
    avatar.textContent = member.name.slice(0, 1).toUpperCase();
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = `${member.name}${member.isCurrentUser ? ` · ${tr("you")}` : ""}`;
    const role = document.createElement("small");
    role.textContent = roleLabel(member.role);
    details.append(name, role);
    item.append(avatar, details);

    const actions = document.createElement("div");
    actions.className = "room-member-actions";
    if (canManageSettings && meetingState.activeMeeting && !speechState.activeSpeech) {
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.className = "member-start-button";
      startButton.textContent = tr("startTurn");
      startButton.addEventListener("click", () => startSpeakerTurn(member, startButton));
      actions.append(startButton);
    }
    if (room.role === "owner" && member.role !== "owner") {
      const roleSelect = document.createElement("select");
      roleSelect.setAttribute("aria-label", `${member.name}: ${roleLabel(member.role)}`);
      ["member", "admin"].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = tr(value === "admin" ? "makeAdmin" : "makeMember");
        option.selected = member.role === value;
        roleSelect.append(option);
      });
      roleSelect.addEventListener("change", () => changeMemberRole(member, roleSelect));
      actions.append(roleSelect);
    }

    const canRemove = !member.isCurrentUser
      && member.role !== "owner"
      && (room.role === "owner" || (room.role === "admin" && member.role === "member"));
    if (canRemove) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "member-remove-button";
      removeButton.textContent = tr("removeMember");
      removeButton.addEventListener("click", () => removeMember(member, removeButton));
      actions.append(removeButton);
    }
    if (actions.childElementCount) item.append(actions);
    membersList.append(item);
  });
}

function formattedDate(epochSeconds) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochSeconds * 1000));
}

function quizQuestionLabel(count) {
  if (language !== "ru") return `${count} ${tr(count === 1 ? "questionsOne" : "questionsMany")}`;
  const lastTwo = count % 100;
  const last = count % 10;
  const key = lastTwo >= 11 && lastTwo <= 14
    ? "questionsMany"
    : last === 1
      ? "questionsOne"
      : last >= 2 && last <= 4 ? "questionsFew" : "questionsMany";
  return `${count} ${tr(key)}`;
}

function renderQuizGameState() {
  const game = quizGameState.currentGame;
  liveQuizPanel.hidden = !game;
  if (!game) return;
  liveQuizTitle.textContent = game.title;
  liveQuizStatus.textContent = tr(game.status === "active" ? "quizInProgress" : "waitingLobby");
  liveQuizStatus.className = `live-quiz-status ${game.status}`;
  liveQuizMeta.textContent = `${game.participantCount} ${tr("quizPlayers")} · ${tr("hostedBy")} ${game.host.name}`;
  openQuizGameLink.href = `/rooms/${encodeURIComponent(room.id)}/quiz-games/${encodeURIComponent(game.id)}`;
}

function renderQuizzes() {
  if (!quizzesList || !room) return;
  const canManage = room.role === "owner" || room.role === "admin";
  quizCount.textContent = String(quizzes.length);
  createQuizLink.hidden = !canManage;
  createQuizLink.href = `/rooms/${encodeURIComponent(room.id)}/quizzes/new`;
  quizzesList.replaceChildren();

  if (!quizzes.length) {
    const empty = document.createElement("div");
    empty.className = "quiz-empty-state";
    const title = document.createElement("strong");
    title.textContent = tr("noQuizzes");
    const copy = document.createElement("p");
    copy.textContent = tr("noQuizzesCopy");
    empty.append(title, copy);
    quizzesList.append(empty);
    return;
  }

  quizzes.forEach((quiz) => {
    const card = document.createElement("article");
    card.className = "quiz-summary-card";
    const heading = document.createElement("div");
    heading.className = "quiz-summary-heading";
    const title = document.createElement("h3");
    title.textContent = quiz.title;
    const status = document.createElement("span");
    status.className = "task-kind";
    status.textContent = tr("quizTemplate");
    heading.append(title, status);

    const description = document.createElement("p");
    description.textContent = quiz.description || tr("quizzesCopy");
    const meta = document.createElement("div");
    meta.className = "quiz-summary-meta";
    const count = document.createElement("span");
    count.textContent = quizQuestionLabel(quiz.questionCount);
    const updated = document.createElement("span");
    updated.textContent = `${tr("updatedBy")} ${quiz.updatedBy.name} · ${formattedDate(quiz.updatedAt)}`;
    meta.append(count, updated);
    card.append(heading, description, meta);

    if (canManage) {
      const actions = document.createElement("div");
      actions.className = "quiz-summary-actions";
      const launch = document.createElement("button");
      launch.className = "primary-button quiz-launch-button";
      launch.type = "button";
      launch.textContent = tr("launchQuiz");
      launch.disabled = Boolean(quizGameState.currentGame);
      launch.addEventListener("click", () => launchQuizGame(quiz, launch));
      const edit = document.createElement("a");
      edit.className = "secondary-button quiz-edit-link";
      edit.href = `/rooms/${encodeURIComponent(room.id)}/quizzes/${encodeURIComponent(quiz.id)}/edit`;
      edit.textContent = tr("editQuiz");
      const archive = document.createElement("button");
      archive.className = "danger-button";
      archive.type = "button";
      archive.textContent = tr("archiveQuiz");
      archive.addEventListener("click", () => archiveRoomQuiz(quiz, archive));
      actions.append(launch, edit, archive);
      card.append(actions);
    }
    quizzesList.append(card);
  });
}

async function loadQuizGames(showFailure = true) {
  if (!room) return;
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/quiz-games`, {
      cache: "no-store",
    });
    quizGameState = {
      currentGame: payload.currentGame || null,
      games: payload.games || [],
    };
    renderQuizGameState();
    renderQuizzes();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") showToast(tr("quizGameCreateFailed"), true);
  }
}

async function launchQuizGame(quiz, button) {
  button.disabled = true;
  button.textContent = tr("launchingQuiz");
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/quiz-games`, {
      method: "POST",
      body: JSON.stringify({ quizId: quiz.id }),
    });
    window.location.assign(`/rooms/${encodeURIComponent(room.id)}/quiz-games/${encodeURIComponent(payload.game.id)}`);
  } catch (error) {
    button.disabled = false;
    button.textContent = tr("launchQuiz");
    showToast(
      tr(error?.code === "QUIZ_GAME_ALREADY_OPEN" ? "quizGameAlreadyOpen" : "quizGameCreateFailed"),
      true,
    );
    if (error?.code === "QUIZ_GAME_ALREADY_OPEN") await loadQuizGames(false);
  }
}

async function loadQuizzes(showFailure = true) {
  if (!room) return;
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/quizzes`, {
      cache: "no-store",
    });
    quizzes = payload.quizzes || [];
    renderQuizzes();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") showToast(tr("quizLoadFailed"), true);
  }
}

async function archiveRoomQuiz(quiz, button) {
  if (!window.confirm(tr("archiveQuizConfirm"))) return;
  button.disabled = true;
  try {
    await api(`/api/rooms/${encodeURIComponent(room.id)}/quizzes/${encodeURIComponent(quiz.id)}`, {
      method: "DELETE",
    });
    quizzes = quizzes.filter(({ id }) => id !== quiz.id);
    renderQuizzes();
    showToast(tr("quizArchived"));
  } catch (error) {
    button.disabled = false;
    showToast(errorMessage(error), true);
  }
}

function renderMeetingElapsed() {
  const activeMeeting = meetingState.activeMeeting;
  if (!activeMeeting) return;
  meetingElapsed.textContent = formattedDuration(Math.max(
    0,
    Math.floor(Date.now() / 1000) - activeMeeting.startedAt,
  ));
}

function currentSpeechSeconds(speech) {
  const runningSeconds = speech?.status === "running" && speech.resumedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - speech.resumedAt)
    : 0;
  return Math.max(0, speech?.accumulatedSeconds || 0) + runningSeconds;
}

function renderSpeechElapsed() {
  const speech = speechState.activeSpeech;
  if (!speech) return;
  const elapsed = currentSpeechSeconds(speech);
  speechElapsed.textContent = formattedDuration(elapsed);
  speakerCard.classList.toggle("over-limit", elapsed > speech.talkLimitSeconds);
}

function renderSpeechState() {
  const activeMeeting = meetingState.activeMeeting;
  const speech = speechState.activeSpeech;
  const canManage = room?.role === "owner" || room?.role === "admin";
  speakerCard.classList.toggle("active", Boolean(speech));
  speechStatusDot.classList.toggle("active", speech?.status === "running");

  if (speech) {
    speechStatus.textContent = tr(speech.status === "paused" ? "paused" : "speaking");
    speechSpeakerName.textContent = speech.speaker.name;
    speechElapsed.hidden = false;
    speechCopy.textContent = `${tr("speechLimit")}: ${formattedDuration(speech.talkLimitSeconds)}`;
    speechActions.hidden = !canManage;
    speechPauseButton.textContent = tr(speech.status === "paused" ? "resumeSpeech" : "pauseSpeech");
    speechPauseButton.dataset.action = speech.status === "paused" ? "resume" : "pause";
    renderSpeechElapsed();
  } else {
    speechStatus.textContent = tr(activeMeeting ? "noActiveSpeaker" : "noActiveMeeting");
    speechSpeakerName.textContent = tr("noActiveSpeaker");
    speechElapsed.hidden = true;
    speechCopy.textContent = activeMeeting
      ? tr("waitingForSpeaker")
      : tr("noActiveMeetingTitle");
    speechActions.hidden = true;
    speakerCard.classList.remove("over-limit");
  }

  renderActivityLog();
}

function assignmentProgress(summary) {
  if (!summary.available) return tr("startStandupForTask");
  if (summary.remaining === 0) return tr("roundComplete");
  return `${tr("remainingInRound")}: ${summary.remaining}/${summary.total} · ${tr("round")} ${summary.cycleNumber}`;
}

function renderAssignmentResult(container, summary) {
  container.replaceChildren();
  const assignment = summary.latestAssignment;
  if (!assignment) {
    const placeholder = document.createElement("span");
    placeholder.className = "assignment-placeholder";
    placeholder.textContent = "?";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = tr(summary.available ? "noTaskYet" : "startStandupForTask");
    const progress = document.createElement("small");
    progress.textContent = assignmentProgress(summary);
    copy.append(title, progress);
    container.append(placeholder, copy);
    return;
  }

  const avatar = document.createElement("span");
  avatar.className = "assignment-avatar";
  avatar.textContent = assignment.participant.name.slice(0, 1).toUpperCase();
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${tr("assignedTo")}: ${assignment.participant.name}`;
  const task = document.createElement("p");
  task.textContent = localizedTask(assignment);
  const progress = document.createElement("small");
  progress.textContent = assignmentProgress(summary);
  copy.append(title, task, progress);
  container.append(avatar, copy);
}

function renderAssignmentState() {
  const canManage = room?.role === "owner" || room?.role === "admin";
  currentAssignmentCard.classList.toggle("unavailable", !assignmentState.currentDraw.available);
  renderAssignmentResult(currentAssignmentResult, assignmentState.currentDraw);
  renderAssignmentResult(nextAssignmentResult, assignmentState.nextDraw);

  for (const [button, kind, summary] of [
    [currentAssignmentButton, "current", assignmentState.currentDraw],
    [nextAssignmentButton, "next", assignmentState.nextDraw],
  ]) {
    button.hidden = !canManage;
    button.disabled = !summary.available || Boolean(assignmentLoadingKind);
    button.textContent = tr(assignmentLoadingKind === kind
      ? "generatingTask"
      : kind === "current" ? "drawCurrentTask" : "drawNextTask");
    button.classList.toggle("loading", assignmentLoadingKind === kind);
  }

  myTaskCount.textContent = String(assignmentState.myAssignments.length);
  myTasksList.replaceChildren();
  if (!assignmentState.myAssignments.length) {
    const empty = document.createElement("p");
    empty.className = "meeting-history-empty";
    empty.textContent = tr("noMyTasks");
    myTasksList.append(empty);
  } else {
    assignmentState.myAssignments.forEach((assignment) => {
      const item = document.createElement("div");
      item.className = "my-task-item";
      const meta = document.createElement("div");
      const kind = document.createElement("span");
      kind.className = `task-kind task-kind-${assignment.kind}`;
      kind.textContent = tr(assignment.kind === "current" ? "currentTask" : "nextTask");
      const date = document.createElement("small");
      date.textContent = formattedDate(assignment.createdAt);
      meta.append(kind, date);
      const task = document.createElement("p");
      task.textContent = localizedTask(assignment);
      item.append(meta, task);
      myTasksList.append(item);
    });
  }

  renderActivityLog();
}

function renderActivityLog() {
  if (!activityHistoryList) return;
  const events = [
    ...speechState.recentSpeeches.map((speech) => ({
      type: "speech",
      timestamp: speech.endedAt || speech.startedAt,
      value: speech,
    })),
    ...assignmentState.recentAssignments.map((assignment) => ({
      type: "assignment",
      timestamp: assignment.createdAt,
      value: assignment,
    })),
  ].sort((left, right) => right.timestamp - left.timestamp).slice(0, 50);

  activityHistoryList.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "meeting-history-empty";
    empty.textContent = tr("noActivity");
    activityHistoryList.append(empty);
    return;
  }

  events.forEach((event) => {
    if (event.type === "speech") {
      const completedSpeech = event.value;
      const item = document.createElement("div");
      item.className = `speech-history-item${completedSpeech.overLimit ? " over-limit" : ""}`;
      const speaker = document.createElement("strong");
      speaker.textContent = completedSpeech.speaker.name;
      const details = document.createElement("small");
      details.textContent = `${formattedDate(event.timestamp)} · ${tr(completedSpeech.overLimit ? "overLimit" : "withinLimit")}`;
      const duration = document.createElement("span");
      duration.textContent = `${tr("spokeFor")} ${formattedDuration(completedSpeech.accumulatedSeconds)} / ${formattedDuration(completedSpeech.talkLimitSeconds)}`;
      item.append(speaker, details, duration);
      activityHistoryList.append(item);
      return;
    }

    const assignment = event.value;
    const item = document.createElement("div");
    item.className = `speech-history-item assignment-activity assignment-${assignment.kind}`;
    const title = document.createElement("strong");
    title.textContent = `${tr("taskAssigned")}: ${assignment.participant.name}`;
    const details = document.createElement("small");
    details.textContent = `${tr(assignment.kind === "current" ? "currentTask" : "nextTask")} · ${formattedDate(event.timestamp)} · ${tr("assignedBy")} ${assignment.assignedBy.name}`;
    const task = document.createElement("p");
    task.className = "activity-task-text";
    task.textContent = localizedTask(assignment);
    item.append(title, details, task);
    activityHistoryList.append(item);
  });
}

function renderLiveTimers() {
  renderMeetingElapsed();
  renderSpeechElapsed();
}

function renderMeetingState() {
  const activeMeeting = meetingState.activeMeeting;
  const canManage = room?.role === "owner" || room?.role === "admin";
  meetingCard.classList.toggle("active", Boolean(activeMeeting));
  meetingStatusDot.classList.toggle("active", Boolean(activeMeeting));
  meetingStatus.textContent = tr(activeMeeting ? "activeMeeting" : "noActiveMeeting");
  meetingTitle.textContent = tr(activeMeeting ? "activeMeetingTitle" : "noActiveMeetingTitle");
  meetingElapsed.hidden = !activeMeeting;
  meetingActionButton.hidden = !canManage;
  meetingActionButton.dataset.action = activeMeeting ? "end" : "start";
  meetingActionButton.textContent = tr(activeMeeting ? "endStandup" : "startStandup");
  meetingActionButton.classList.toggle("meeting-end-button", Boolean(activeMeeting));

  if (activeMeeting) {
    meetingCopy.textContent = `${tr("startedBy")} ${activeMeeting.startedBy.name} · ${formattedDate(activeMeeting.startedAt)}`;
    renderMeetingElapsed();
  } else {
    meetingCopy.textContent = `${tr("talkLimitLabel")}: ${formattedDuration(room?.defaultTalkLimitSeconds || 0)}`;
  }

  meetingHistoryList.replaceChildren();
  if (!meetingState.recentMeetings.length) {
    const empty = document.createElement("p");
    empty.className = "meeting-history-empty";
    empty.textContent = tr("noMeetingHistory");
    meetingHistoryList.append(empty);
    return;
  }

  meetingState.recentMeetings.forEach((meeting) => {
    const item = document.createElement("div");
    item.className = "meeting-history-item";
    const date = document.createElement("strong");
    date.textContent = formattedDate(meeting.startedAt);
    const details = document.createElement("small");
    const duration = formattedDuration(Math.max(0, meeting.endedAt - meeting.startedAt));
    details.textContent = `${duration} · ${tr("startedBy")} ${meeting.startedBy.name}`;
    const ender = document.createElement("span");
    ender.textContent = `${tr("completedBy")} ${meeting.endedBy?.name || meeting.startedBy.name}`;
    item.append(date, details, ender);
    meetingHistoryList.append(item);
  });
}

async function loadMeetingState(showFailure = true) {
  try {
    meetingState = await api(`/api/rooms/${encodeURIComponent(room.id)}/meetings`, {
      cache: "no-store",
    });
    renderMeetingState();
    await Promise.all([
      loadSpeechState(false),
      loadAssignmentState(false),
    ]);
    renderRoom();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") {
      showToast(tr("meetingUnavailable"), true);
    }
  }
}

async function loadSpeechState(showFailure = true) {
  try {
    speechState = await api(
      `/api/rooms/${encodeURIComponent(room.id)}/speeches`,
      { cache: "no-store" },
    );
    renderSpeechState();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") {
      showToast(tr("meetingUnavailable"), true);
    }
  }
}

async function loadAssignmentState(showFailure = true) {
  try {
    assignmentState = await api(`/api/rooms/${encodeURIComponent(room.id)}/assignments`, {
      cache: "no-store",
    });
    renderAssignmentState();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") {
      showToast(tr("taskGenerationFailed"), true);
    }
  }
}

async function drawRoomAssignment(kind) {
  if (assignmentLoadingKind) return;
  assignmentLoadingKind = kind;
  renderAssignmentState();
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/assignments/draw`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    });
    assignmentState = payload.state;
    showToast(`${tr("taskGenerated")}: ${payload.assignment.participant.name}`);
  } catch (error) {
    showToast(errorMessage(error) === tr("requestFailed")
      ? tr("taskGenerationFailed")
      : errorMessage(error), true);
    await loadAssignmentState(false);
  } finally {
    assignmentLoadingKind = null;
    renderAssignmentState();
  }
}

async function startSpeakerTurn(member, button) {
  const meeting = meetingState.activeMeeting;
  if (!meeting) return;
  button.disabled = true;
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(room.id)}/meetings/${encodeURIComponent(meeting.id)}/speeches`,
      {
        method: "POST",
        body: JSON.stringify({ speakerUserId: member.id }),
      },
    );
    speechState.activeSpeech = payload.speech;
    renderSpeechState();
    renderRoom();
    showToast(tr("speechStarted"));
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadSpeechState(false);
    renderRoom();
  } finally {
    button.disabled = false;
  }
}

async function runSpeechAction(action, button) {
  const meeting = meetingState.activeMeeting;
  const speech = speechState.activeSpeech;
  if (!meeting || !speech) return;
  button.disabled = true;
  speechPauseButton.disabled = true;
  speechFinishButton.disabled = true;
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(room.id)}/meetings/${encodeURIComponent(meeting.id)}/speeches/${encodeURIComponent(speech.id)}/${action}`,
      { method: "POST" },
    );
    if (action === "finish") {
      speechState.activeSpeech = null;
      speechState.recentSpeeches = [payload.speech, ...speechState.recentSpeeches].slice(0, 50);
    } else {
      speechState.activeSpeech = payload.speech;
    }
    renderSpeechState();
    renderRoom();
    showToast(tr(action === "finish" ? "speechFinished" : action === "pause" ? "speechPaused" : "speechResumed"));
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadSpeechState(false);
    renderRoom();
  } finally {
    speechPauseButton.disabled = false;
    speechFinishButton.disabled = false;
  }
}

async function changeMemberRole(member, select) {
  select.disabled = true;
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/members/${encodeURIComponent(member.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ role: select.value }),
    });
    room = payload.room;
    renderRoom();
    showToast(tr("roleSaved"));
  } catch (error) {
    renderRoom();
    showToast(errorMessage(error), true);
  }
}

async function removeMember(member, button) {
  if (!window.confirm(`${tr("removeConfirm")} ${member.name}?`)) return;
  button.disabled = true;
  try {
    await api(`/api/rooms/${encodeURIComponent(room.id)}/members/${encodeURIComponent(member.id)}`, {
      method: "DELETE",
    });
    room.members = room.members.filter(({ id }) => id !== member.id);
    renderRoom();
    showToast(tr("memberRemoved"));
  } catch (error) {
    button.disabled = false;
    showToast(errorMessage(error), true);
  }
}

async function loadRoom() {
  const roomId = location.pathname.split("/").filter(Boolean).at(-1);
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/");
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404 && room) {
        window.location.assign("/dashboard");
        return;
      }
      loading.textContent = tr(response.status === 404 ? "notFound" : "unavailable");
      loading.classList.add("error-copy");
      return;
    }
    room = payload.room;
    loading.hidden = true;
    content.hidden = false;
    renderRoom();
    await Promise.all([loadMeetingState(), loadQuizzes(), loadQuizGames()]);
    connectRoomRealtime();
  } catch {
    loading.textContent = tr("unavailable");
    loading.classList.add("error-copy");
  }
}

roomSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsMessage.textContent = "";
  const submitButton = roomSettingsForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: roomNameInput.value,
        defaultTalkLimitSeconds: Number(talkLimitInput.value),
      }),
    });
    room = payload.room;
    renderRoom();
    showToast(tr("settingsSaved"));
  } catch (error) {
    settingsMessage.textContent = errorMessage(error);
  } finally {
    submitButton.disabled = false;
  }
});

meetingActionButton.addEventListener("click", async () => {
  const action = meetingActionButton.dataset.action;
  meetingActionButton.disabled = true;
  try {
    if (action === "end") {
      const meetingId = meetingState.activeMeeting.id;
      await api(`/api/rooms/${encodeURIComponent(room.id)}/meetings/${encodeURIComponent(meetingId)}/end`, {
        method: "POST",
      });
      await loadMeetingState(false);
      showToast(tr("meetingEnded"));
    } else {
      const payload = await api(`/api/rooms/${encodeURIComponent(room.id)}/meetings`, {
        method: "POST",
      });
      meetingState.activeMeeting = payload.meeting;
      speechState = { activeSpeech: null, recentSpeeches: [] };
      renderMeetingState();
      renderSpeechState();
      renderRoom();
      await Promise.all([loadSpeechState(false), loadAssignmentState(false)]);
      showToast(tr("meetingStarted"));
    }
  } catch (error) {
    showToast(errorMessage(error), true);
    if (error?.code === "MEETING_ALREADY_ACTIVE") await loadMeetingState(false);
  } finally {
    meetingActionButton.disabled = false;
  }
});

speechPauseButton.addEventListener("click", () => {
  runSpeechAction(speechPauseButton.dataset.action, speechPauseButton);
});

speechFinishButton.addEventListener("click", () => {
  runSpeechAction("finish", speechFinishButton);
});

currentAssignmentButton.addEventListener("click", () => {
  drawRoomAssignment("current");
});

nextAssignmentButton.addEventListener("click", () => {
  drawRoomAssignment("next");
});

refreshMeetingButton.addEventListener("click", async () => {
  refreshMeetingButton.disabled = true;
  await loadMeetingState();
  refreshMeetingButton.disabled = false;
});

leaveRoomButton.addEventListener("click", async () => {
  if (!window.confirm(tr("leaveConfirm"))) return;
  leaveRoomButton.disabled = true;
  const currentMember = room.members.find((member) => member.isCurrentUser);
  try {
    await api(`/api/rooms/${encodeURIComponent(room.id)}/members/${encodeURIComponent(currentMember.id)}`, {
      method: "DELETE",
    });
    window.location.assign("/dashboard");
  } catch (error) {
    leaveRoomButton.disabled = false;
    showToast(errorMessage(error), true);
  }
});

archiveRoomButton.addEventListener("click", async () => {
  if (!window.confirm(tr("archiveConfirm"))) return;
  archiveRoomButton.disabled = true;
  try {
    await api(`/api/rooms/${encodeURIComponent(room.id)}/archive`, { method: "POST" });
    window.location.assign("/dashboard");
  } catch (error) {
    archiveRoomButton.disabled = false;
    showToast(errorMessage(error), true);
  }
});

copyCodeButton.addEventListener("click", async () => {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(room.joinCode);
    showToast(tr("copied"));
  } catch {
    showToast(room.joinCode);
  }
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

applyLanguage(language);
loadRoom();
setInterval(renderLiveTimers, 1000);
setInterval(() => {
  const connected = roomSocket?.readyState === WebSocket.OPEN;
  if (room && !connected && document.visibilityState === "visible") loadRoom();
}, 30_000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !room) return;
  connectRoomRealtime();
  scheduleRealtimeRefresh();
});

window.addEventListener("beforeunload", () => {
  realtimeStopped = true;
  if (roomSocketRetryTimer) window.clearTimeout(roomSocketRetryTimer);
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
  roomSocket?.close();
});
