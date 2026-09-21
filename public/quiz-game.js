const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let room = null;
let game = null;
let gameSocket = null;
let socketRetry = 0;
let socketRetryTimer = null;
let refreshTimer = null;
let refreshInFlight = false;
let realtimeStopped = false;

const routeMatch = location.pathname.match(
  /^\/rooms\/([0-9a-f-]{36})\/quiz-games\/([0-9a-f-]{36})\/?$/i,
);
const roomId = routeMatch?.[1] || "";
const gameId = routeMatch?.[2] || "";

const translations = {
  en: {
    pageTitle: "Standup Helper — live quiz",
    description: "Standup Helper live quiz",
    backToRoom: "Back to room",
    loading: "Loading game…",
    liveQuiz: "Live quiz",
    gameStatus: "Game status",
    waiting: "Waiting for players",
    active: "In progress",
    finished: "Finished",
    cancelled: "Cancelled",
    players: "Players",
    lobby: "Lobby",
    connecting: "Connecting…",
    connected: "Live",
    reconnecting: "Reconnecting…",
    gameSetup: "Game setup",
    readyToPlay: "Ready to play?",
    host: "Host",
    questions: "Questions",
    questionOne: "question",
    questionMany: "questions",
    noPlayers: "No players have joined yet",
    noPlayersCopy: "Join the lobby to reserve your place in the game.",
    you: "You",
    hostBadge: "Host",
    joined: "Joined",
    joinGame: "Join game",
    joining: "Joining…",
    leaveGame: "Leave lobby",
    leaving: "Leaving…",
    startGame: "Start quiz",
    starting: "Starting…",
    cancelGame: "Cancel game",
    cancelling: "Cancelling…",
    playerGuidance: "Join now. The host will start the quiz when everyone is ready.",
    joinedGuidance: "You are in. Keep this page open while the host prepares the game.",
    hostGuidanceEmpty: "At least one player must join before you can start.",
    hostGuidanceReady: "Players are ready. Start when you want everyone to receive question one.",
    gameStarted: "Game started",
    firstQuestionReady: "The first question is ready",
    questionStageCopy: "All connected players received the same game state. The interactive question screen is the next implementation stage.",
    gameCancelled: "Game cancelled",
    lobbyClosed: "This lobby is closed",
    cancelledCopy: "Return to the room to launch another quiz.",
    cancelConfirm: "Cancel this quiz for every player?",
    notFound: "This game is unavailable or you are not a room member.",
    forbidden: "You do not have permission for this action.",
    notJoinable: "This game has already started and can no longer be joined.",
    alreadyStarted: "The quiz has already started.",
    emptyLobby: "At least one player must join before the quiz can start.",
    notJoined: "You are not currently in this lobby.",
    gameNotOpen: "This game is already closed.",
    requestFailed: "Could not update the game. Please try again.",
    unavailable: "Could not load the game.",
  },
  ru: {
    pageTitle: "Standup Helper — викторина",
    description: "Онлайн-викторина Standup Helper",
    backToRoom: "Вернуться в комнату",
    loading: "Загружаем игру…",
    liveQuiz: "Онлайн-викторина",
    gameStatus: "Статус игры",
    waiting: "Ожидаем игроков",
    active: "Игра идёт",
    finished: "Завершена",
    cancelled: "Отменена",
    players: "Игроки",
    lobby: "Лобби",
    connecting: "Подключаемся…",
    connected: "Онлайн",
    reconnecting: "Переподключаемся…",
    gameSetup: "Настройки игры",
    readyToPlay: "Готовы играть?",
    host: "Ведущий",
    questions: "Вопросы",
    questionOne: "вопрос",
    questionMany: "вопросов",
    noPlayers: "Пока никто не присоединился",
    noPlayersCopy: "Войдите в лобби, чтобы занять место в игре.",
    you: "Вы",
    hostBadge: "Ведущий",
    joined: "В игре",
    joinGame: "Присоединиться",
    joining: "Подключаемся…",
    leaveGame: "Выйти из лобби",
    leaving: "Выходим…",
    startGame: "Начать викторину",
    starting: "Запускаем…",
    cancelGame: "Отменить игру",
    cancelling: "Отменяем…",
    playerGuidance: "Присоединяйтесь. Ведущий запустит викторину, когда все будут готовы.",
    joinedGuidance: "Вы в игре. Не закрывайте страницу, пока ведущий готовится к запуску.",
    hostGuidanceEmpty: "Для старта должен присоединиться хотя бы один игрок.",
    hostGuidanceReady: "Игроки готовы. Запустите викторину, чтобы все одновременно получили первый вопрос.",
    gameStarted: "Игра началась",
    firstQuestionReady: "Первый вопрос готов",
    questionStageCopy: "Все подключённые игроки получили одинаковое состояние игры. Интерактивный экран вопроса — следующий этап реализации.",
    gameCancelled: "Игра отменена",
    lobbyClosed: "Это лобби закрыто",
    cancelledCopy: "Вернитесь в комнату, чтобы запустить другую викторину.",
    cancelConfirm: "Отменить эту викторину для всех игроков?",
    notFound: "Игра недоступна или вы не состоите в комнате.",
    forbidden: "У вас нет прав для этого действия.",
    notJoinable: "Игра уже началась — присоединиться больше нельзя.",
    alreadyStarted: "Викторина уже началась.",
    emptyLobby: "Перед стартом должен присоединиться хотя бы один игрок.",
    notJoined: "Сейчас вас нет в этом лобби.",
    gameNotOpen: "Эта игра уже закрыта.",
    requestFailed: "Не удалось обновить игру. Попробуйте ещё раз.",
    unavailable: "Не удалось загрузить игру.",
  },
};

const loading = document.getElementById("gameLoading");
const content = document.getElementById("gameContent");
const backToRoomLink = document.getElementById("backToRoomLink");
const startedBackLink = document.getElementById("startedBackLink");
const cancelledBackLink = document.getElementById("cancelledBackLink");
const gameTitle = document.getElementById("gameTitle");
const gameHeroCopy = document.getElementById("gameHeroCopy");
const gameStatusDot = document.getElementById("gameStatusDot");
const gameStatus = document.getElementById("gameStatus");
const waitingView = document.getElementById("waitingView");
const startedView = document.getElementById("startedView");
const cancelledView = document.getElementById("cancelledView");
const playerCount = document.getElementById("playerCount");
const playersList = document.getElementById("playersList");
const realtimeIndicator = document.getElementById("realtimeIndicator");
const hostName = document.getElementById("hostName");
const questionCount = document.getElementById("questionCount");
const lobbyGuidance = document.getElementById("lobbyGuidance");
const joinGameButton = document.getElementById("joinGameButton");
const leaveGameButton = document.getElementById("leaveGameButton");
const startGameButton = document.getElementById("startGameButton");
const cancelGameButton = document.getElementById("cancelGameButton");
const toast = document.getElementById("toast");

function tr(key) {
  return translations[language][key] || key;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function avatarColor(name) {
  const colors = ["#2d6a4f", "#4f6d9b", "#9a6846", "#805d8e", "#557a62"];
  const total = [...name].reduce((sum, char) => sum + char.codePointAt(0), 0);
  return colors[total % colors.length];
}

function questionLabel(count) {
  if (language === "ru") {
    const singular = count % 10 === 1 && count % 100 !== 11;
    return `${count} ${tr(singular ? "questionOne" : "questionMany")}`;
  }
  return `${count} ${tr(count === 1 ? "questionOne" : "questionMany")}`;
}

function showToast(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function errorMessage(error) {
  const errors = {
    ROOM_FORBIDDEN: "forbidden",
    QUIZ_GAME_NOT_FOUND: "notFound",
    QUIZ_GAME_NOT_JOINABLE: "notJoinable",
    QUIZ_GAME_ALREADY_STARTED: "alreadyStarted",
    QUIZ_GAME_EMPTY_LOBBY: "emptyLobby",
    QUIZ_GAME_NOT_JOINED: "notJoined",
    QUIZ_GAME_NOT_OPEN: "gameNotOpen",
  };
  return tr(errors[error?.code] || "requestFailed");
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (response.status === 401) {
    location.replace("/");
    throw new Error("AUTH_REQUIRED");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.code || "REQUEST_FAILED"), payload);
  return payload;
}

function setRealtimeState(state) {
  realtimeIndicator.className = `realtime-indicator ${state}`;
  realtimeIndicator.querySelector("span").textContent = tr(
    state === "connected" ? "connected" : state === "reconnecting" ? "reconnecting" : "connecting",
  );
}

function applyLanguage(nextLanguage) {
  language = nextLanguage === "ru" ? "ru" : "en";
  localStorage.setItem(languageKey, language);
  document.documentElement.lang = language;
  document.title = game ? `${game.title} — Standup Helper` : tr("pageTitle");
  document.querySelector('meta[name="description"]').content = tr("description");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setRealtimeState(gameSocket?.readyState === WebSocket.OPEN ? "connected" : "connecting");
  if (game) renderGame();
}

function renderPlayers() {
  playerCount.textContent = String(game.participants.length);
  playersList.replaceChildren();
  if (!game.participants.length) {
    const empty = document.createElement("div");
    empty.className = "quiz-player-empty";
    const orbit = document.createElement("span");
    orbit.className = "empty-orbit";
    orbit.innerHTML = "<span></span>";
    const title = document.createElement("strong");
    title.textContent = tr("noPlayers");
    const copy = document.createElement("p");
    copy.textContent = tr("noPlayersCopy");
    empty.append(orbit, title, copy);
    playersList.append(empty);
    return;
  }

  game.participants.forEach((participant) => {
    const item = document.createElement("div");
    item.className = `quiz-player${participant.isCurrentUser ? " current" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.backgroundColor = avatarColor(participant.name);
    avatar.textContent = initials(participant.name);
    const info = document.createElement("div");
    info.className = "quiz-player-info";
    const name = document.createElement("strong");
    name.textContent = participant.name;
    const meta = document.createElement("small");
    const labels = [tr("joined")];
    if (participant.id === game.host.id) labels.push(tr("hostBadge"));
    if (participant.isCurrentUser) labels.push(tr("you"));
    meta.textContent = labels.join(" · ");
    info.append(name, meta);
    const ready = document.createElement("span");
    ready.className = "quiz-player-ready";
    ready.setAttribute("aria-label", tr("joined"));
    item.append(avatar, info, ready);
    playersList.append(item);
  });
}

function renderGame() {
  document.title = `${game.title} — Standup Helper`;
  gameTitle.textContent = game.title;
  gameHeroCopy.textContent = `${tr("host")} ${game.host.name} · ${questionLabel(game.questionCount)}`;
  gameStatus.textContent = tr(game.status);
  gameStatusDot.className = `meeting-status-dot ${game.status === "active" ? "active" : ""}`;
  hostName.textContent = game.host.name;
  questionCount.textContent = questionLabel(game.questionCount);
  const roomUrl = `/rooms/${encodeURIComponent(roomId)}`;
  [backToRoomLink, startedBackLink, cancelledBackLink].forEach((link) => { link.href = roomUrl; });

  waitingView.hidden = game.status !== "waiting";
  startedView.hidden = !["active", "finished"].includes(game.status);
  cancelledView.hidden = game.status !== "cancelled";
  if (game.status !== "waiting") return;

  renderPlayers();
  joinGameButton.hidden = game.isJoined;
  leaveGameButton.hidden = !game.isJoined;
  startGameButton.hidden = !game.canManage;
  startGameButton.disabled = game.participantCount < 1;
  cancelGameButton.hidden = !game.canManage;
  lobbyGuidance.textContent = game.canManage
    ? tr(game.participantCount ? "hostGuidanceReady" : "hostGuidanceEmpty")
    : tr(game.isJoined ? "joinedGuidance" : "playerGuidance");
}

async function loadGame(showFailure = true) {
  if (!roomId || !gameId || refreshInFlight) return;
  refreshInFlight = true;
  try {
    const [roomPayload, gamePayload] = await Promise.all([
      room ? Promise.resolve({ room }) : api(`/api/rooms/${encodeURIComponent(roomId)}`),
      api(`/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}`),
    ]);
    room = roomPayload.room;
    game = gamePayload.game;
    loading.hidden = true;
    content.hidden = false;
    renderGame();
    connectRealtime();
  } catch (error) {
    if (error?.message === "AUTH_REQUIRED") return;
    if (showFailure) {
      loading.textContent = tr(error?.code === "QUIZ_GAME_NOT_FOUND" || error?.code === "ROOM_NOT_FOUND" ? "notFound" : "unavailable");
      loading.classList.add("error-copy");
    }
  } finally {
    refreshInFlight = false;
  }
}

function scheduleRefresh() {
  if (refreshTimer || document.visibilityState !== "visible") return;
  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    await loadGame(false);
  }, 120);
}

function scheduleReconnect() {
  if (realtimeStopped || gameSocket || socketRetryTimer) return;
  setRealtimeState("reconnecting");
  const delay = Math.min(15_000, 1_000 * (2 ** socketRetry));
  socketRetry = Math.min(socketRetry + 1, 4);
  socketRetryTimer = setTimeout(() => {
    socketRetryTimer = null;
    connectRealtime();
  }, delay);
}

function connectRealtime() {
  if (!room || realtimeStopped) return;
  if (gameSocket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(gameSocket.readyState)) return;
  setRealtimeState("connecting");
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${encodeURIComponent(roomId)}/live`);
  gameSocket = socket;
  socket.addEventListener("open", () => {
    socketRetry = 0;
    setRealtimeState("connected");
    scheduleRefresh();
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "pong") return;
    try {
      const roomEvent = JSON.parse(event.data);
      if (roomEvent.roomId === roomId) scheduleRefresh();
    } catch {
      // Unknown messages do not affect the lobby connection.
    }
  });
  socket.addEventListener("close", () => {
    if (gameSocket === socket) gameSocket = null;
    scheduleReconnect();
  });
  socket.addEventListener("error", () => {
    try { socket.close(); } catch { /* It may already be closed. */ }
  });
}

async function runAction(action, button, pendingLabel) {
  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = tr(pendingLabel);
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/${action}`,
      { method: "POST" },
    );
    game = payload.game;
    renderGame();
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

joinGameButton.addEventListener("click", () => runAction("join", joinGameButton, "joining"));
leaveGameButton.addEventListener("click", () => runAction("leave", leaveGameButton, "leaving"));
startGameButton.addEventListener("click", () => runAction("start", startGameButton, "starting"));
cancelGameButton.addEventListener("click", () => {
  if (confirm(tr("cancelConfirm"))) runAction("cancel", cancelGameButton, "cancelling");
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  connectRealtime();
  scheduleRefresh();
});

window.addEventListener("beforeunload", () => {
  realtimeStopped = true;
  if (socketRetryTimer) clearTimeout(socketRetryTimer);
  if (refreshTimer) clearTimeout(refreshTimer);
  gameSocket?.close();
});

applyLanguage(language);
if (!routeMatch) {
  loading.textContent = tr("notFound");
  loading.classList.add("error-copy");
} else {
  loadGame();
  setInterval(() => {
    if (document.visibilityState === "visible" && gameSocket?.readyState !== WebSocket.OPEN) loadGame(false);
  }, 30_000);
}
