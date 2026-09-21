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
let serverOffsetMs = 0;
let answerSubmitting = false;
let roundActionInFlight = false;
let autoCloseQuestionId = null;

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
    currentQuestion: "Current question",
    questionProgress: "Question {current} of {total}",
    answerLocked: "Answer locked in. Waiting for the host…",
    chooseAnswer: "Choose one answer before time runs out.",
    timeExpired: "Time is up. Waiting for the host…",
    submittingAnswer: "Locking in your answer…",
    answerAlreadySubmitted: "Your answer is already locked in.",
    answerTimeExpired: "The answer arrived after the timer ended.",
    optionUnavailable: "That answer option is no longer available.",
    answerReveal: "Answer reveal",
    closeQuestion: "End question",
    closingQuestion: "Closing question…",
    showStandings: "Show leaderboard",
    showingStandings: "Opening leaderboard…",
    nextQuestion: "Next question",
    showFinalResults: "Finish quiz",
    advancingQuestion: "Preparing next question…",
    correctAnswer: "Correct! +{points} points",
    incorrectAnswer: "Not quite. The correct answer is highlighted.",
    noAnswer: "No answer was submitted for this question.",
    answersReceived: "{count} answers received",
    answerCountOne: "answer",
    answerCountMany: "answers",
    questionClosed: "Answers are already closed for this question.",
    questionNotRevealed: "Reveal the answer before moving on.",
    standingsNotVisible: "Show the leaderboard before continuing.",
    roundComplete: "Round complete",
    currentStandings: "Current standings",
    scoreboard: "Scoreboard",
    roundProgress: "Scores after question {current} of {total}",
    hostContinueGuidance: "Continue when everyone is ready.",
    playerContinueGuidance: "Waiting for the host to continue…",
    gameStarted: "Game started",
    watchingGame: "The quiz is already in progress",
    spectatorCopy: "Only players who joined the lobby before the start can submit answers.",
    gameComplete: "Quiz complete",
    finalResults: "Final results",
    finalResultsCopy: "Every answer is counted. Here is the final leaderboard.",
    leaderboard: "Leaderboard",
    finalStandings: "Final standings",
    winner: "Winner",
    winnerBadge: "Winner",
    scorePoints: "{count} points",
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
    currentQuestion: "Текущий вопрос",
    questionProgress: "Вопрос {current} из {total}",
    answerLocked: "Ответ принят. Ожидаем ведущего…",
    chooseAnswer: "Выберите один ответ до окончания времени.",
    timeExpired: "Время вышло. Ожидаем ведущего…",
    submittingAnswer: "Фиксируем ответ…",
    answerAlreadySubmitted: "Ваш ответ уже принят.",
    answerTimeExpired: "Ответ пришёл после окончания времени.",
    optionUnavailable: "Этот вариант ответа больше недоступен.",
    answerReveal: "Правильный ответ",
    closeQuestion: "Завершить вопрос",
    closingQuestion: "Завершаем вопрос…",
    showStandings: "Показать таблицу",
    showingStandings: "Открываем таблицу…",
    nextQuestion: "Следующий вопрос",
    showFinalResults: "Завершить викторину",
    advancingQuestion: "Готовим следующий вопрос…",
    correctAnswer: "Правильно! +{points} баллов",
    incorrectAnswer: "Не совсем. Правильный ответ выделен.",
    noAnswer: "Ответ на этот вопрос не был отправлен.",
    answersReceived: "Получено ответов: {count}",
    answerCountOne: "ответ",
    answerCountMany: "ответов",
    questionClosed: "Ответы на этот вопрос уже закрыты.",
    questionNotRevealed: "Перед переходом покажите правильный ответ.",
    standingsNotVisible: "Перед продолжением покажите таблицу лидеров.",
    roundComplete: "Раунд завершён",
    currentStandings: "Текущие результаты",
    scoreboard: "Таблица баллов",
    roundProgress: "Результаты после вопроса {current} из {total}",
    hostContinueGuidance: "Продолжайте, когда все будут готовы.",
    playerContinueGuidance: "Ожидаем, пока ведущий продолжит игру…",
    gameStarted: "Игра началась",
    watchingGame: "Викторина уже идёт",
    spectatorCopy: "Отвечать могут только игроки, которые вошли в лобби до старта.",
    gameComplete: "Викторина завершена",
    finalResults: "Итоговые результаты",
    finalResultsCopy: "Все ответы учтены. Перед вами итоговая таблица игроков.",
    leaderboard: "Таблица лидеров",
    finalStandings: "Итоговые места",
    winner: "Победитель",
    winnerBadge: "Победитель",
    scorePoints: "{count} баллов",
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
const questionView = document.getElementById("questionView");
const roundStandingsView = document.getElementById("roundStandingsView");
const startedView = document.getElementById("startedView");
const resultsView = document.getElementById("resultsView");
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
const questionProgress = document.getElementById("questionProgress");
const currentQuestionKicker = document.getElementById("currentQuestionKicker");
const questionTimer = document.getElementById("questionTimer");
const questionTimerValue = document.getElementById("questionTimerValue");
const questionPrompt = document.getElementById("questionPrompt");
const answerOptions = document.getElementById("answerOptions");
const answerStatus = document.getElementById("answerStatus");
const questionHostActions = document.getElementById("questionHostActions");
const closeQuestionButton = document.getElementById("closeQuestionButton");
const showStandingsButton = document.getElementById("showStandingsButton");
const nextQuestionButton = document.getElementById("nextQuestionButton");
const roundStandingsProgress = document.getElementById("roundStandingsProgress");
const roundPlayerCount = document.getElementById("roundPlayerCount");
const roundLeaderboardList = document.getElementById("roundLeaderboardList");
const roundStandingsGuidance = document.getElementById("roundStandingsGuidance");
const roundStandingsActions = document.getElementById("roundStandingsActions");
const startedKicker = document.getElementById("startedKicker");
const startedHeading = document.getElementById("startedHeading");
const startedCopy = document.getElementById("startedCopy");
const winnerName = document.getElementById("winnerName");
const winnerScore = document.getElementById("winnerScore");
const resultPlayerCount = document.getElementById("resultPlayerCount");
const leaderboardList = document.getElementById("leaderboardList");
const resultsBackLink = document.getElementById("resultsBackLink");
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
    QUIZ_GAME_NOT_ACTIVE: "gameNotOpen",
    QUIZ_ANSWER_ALREADY_SUBMITTED: "answerAlreadySubmitted",
    QUIZ_ANSWER_TIME_EXPIRED: "answerTimeExpired",
    QUIZ_OPTION_NOT_FOUND: "optionUnavailable",
    QUIZ_QUESTION_CLOSED: "questionClosed",
    QUIZ_QUESTION_NOT_OPEN: "questionClosed",
    QUIZ_QUESTION_NOT_REVEALED: "questionNotRevealed",
    QUIZ_STANDINGS_NOT_VISIBLE: "standingsNotVisible",
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

function questionRemainingMs() {
  if (!game?.currentQuestion || !game.questionStartedAt) return 0;
  const deadline = game.questionStartedAt + (game.currentQuestion.timeLimitSeconds * 1_000);
  return Math.max(0, deadline - (Date.now() + serverOffsetMs));
}

function syncServerClock(serverNow, requestedAt) {
  if (!Number.isFinite(serverNow)) return;
  const receivedAt = Date.now();
  serverOffsetMs = serverNow - Math.round((requestedAt + receivedAt) / 2);
}

function renderQuestionTimer() {
  if (!game || questionView.hidden || !game.currentQuestion) return;
  if (game.questionPhase === "reveal") {
    questionTimerValue.textContent = "✓";
    questionTimer.style.setProperty("--remaining", "100%");
    questionTimer.classList.remove("urgent", "expired");
    questionTimer.classList.add("revealed");
    return;
  }
  questionTimer.classList.remove("revealed");
  const totalMs = game.currentQuestion.timeLimitSeconds * 1_000;
  const remainingMs = questionRemainingMs();
  const seconds = Math.ceil(remainingMs / 1_000);
  const progress = totalMs ? (remainingMs / totalMs) * 100 : 0;
  questionTimerValue.textContent = String(seconds);
  questionTimer.style.setProperty("--remaining", `${Math.max(0, Math.min(100, progress))}%`);
  questionTimer.classList.toggle("urgent", remainingMs > 0 && remainingMs <= 5_000);
  questionTimer.classList.toggle("expired", remainingMs === 0);
  if (remainingMs === 0) {
    answerOptions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    if (!game.myAnswer) {
      answerStatus.textContent = tr("timeExpired");
      answerStatus.className = "quiz-answer-status expired";
    }
    const currentUser = game.participants.find(({ isCurrentUser }) => isCurrentUser);
    const deadline = game.questionStartedAt + (game.currentQuestion.timeLimitSeconds * 1_000);
    const elapsedAfterDeadline = (Date.now() + serverOffsetMs) - deadline;
    const participantDelay = currentUser
      ? [...currentUser.id].reduce((sum, character) => sum + character.codePointAt(0), 0) % 2_000
      : Number.POSITIVE_INFINITY;
    const shouldAutoClose = game.canManage
      || elapsedAfterDeadline >= participantDelay;
    if (
      shouldAutoClose
      && game.questionPhase === "question"
      && autoCloseQuestionId !== game.currentQuestion.id
    ) {
      autoCloseQuestionId = game.currentQuestion.id;
      closeCurrentQuestion(true);
    }
  }
}

function renderQuestion() {
  const question = game.currentQuestion;
  if (!question) return;
  questionProgress.textContent = tr("questionProgress")
    .replace("{current}", String(question.position))
    .replace("{total}", String(game.questionCount));
  questionPrompt.textContent = question.prompt;
  answerOptions.replaceChildren();
  const remainingMs = questionRemainingMs();
  const locked = Boolean(game.myAnswer);
  const revealed = game.questionPhase === "reveal";
  currentQuestionKicker.textContent = tr(revealed ? "answerReveal" : "currentQuestion");
  const optionLabels = ["A", "B", "C", "D"];

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `quiz-answer-option quiz-answer-option-${index + 1}`;
    if (game.myAnswer?.selectedOptionId === option.id) button.classList.add("selected");
    if (revealed && option.isCorrect) button.classList.add("correct");
    if (revealed && game.myAnswer?.selectedOptionId === option.id && !option.isCorrect) {
      button.classList.add("selected-wrong");
    }
    button.disabled = !game.isJoined || revealed || locked || remainingMs === 0 || answerSubmitting;
    const marker = document.createElement("span");
    marker.textContent = optionLabels[index] || String(index + 1);
    const text = document.createElement("strong");
    text.textContent = option.text;
    button.append(marker, text);
    if (revealed) {
      const count = document.createElement("small");
      count.textContent = `${option.answerCount} ${tr(option.answerCount === 1 ? "answerCountOne" : "answerCountMany")}`;
      button.append(count);
    }
    button.addEventListener("click", () => submitAnswer(option.id));
    answerOptions.append(button);
  });

  if (revealed) {
    const answerCount = question.options.reduce((sum, option) => sum + option.answerCount, 0);
    answerStatus.textContent = game.myAnswer
      ? tr(game.myAnswer.isCorrect ? "correctAnswer" : "incorrectAnswer")
        .replace("{points}", String(game.myAnswer.pointsAwarded))
      : game.isJoined
        ? tr("noAnswer")
        : tr("answersReceived").replace("{count}", String(answerCount));
    answerStatus.className = `quiz-answer-status reveal${game.myAnswer?.isCorrect ? " correct" : ""}`;
  } else {
    answerStatus.textContent = game.isJoined
      ? tr(locked ? "answerLocked" : remainingMs === 0 ? "timeExpired" : "chooseAnswer")
      : tr("answersReceived").replace("{count}", "0");
    answerStatus.className = `quiz-answer-status${locked ? " locked" : remainingMs === 0 ? " expired" : ""}`;
  }
  questionHostActions.hidden = !game.canManage;
  closeQuestionButton.hidden = !game.canManage || revealed;
  showStandingsButton.hidden = !game.canManage || !revealed;
  renderQuestionTimer();
}

function scoreLabel(score) {
  const formattedScore = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US")
    .format(score);
  return tr("scorePoints").replace("{count}", formattedScore);
}

function sortedStandings(final = false) {
  return [...game.participants].sort((left, right) => (
    (final
      ? (left.finalRank ?? Number.MAX_SAFE_INTEGER) - (right.finalRank ?? Number.MAX_SAFE_INTEGER)
      : right.score - left.score)
    || left.joinedAt - right.joinedAt
    || left.id.localeCompare(right.id)
  ));
}

function renderLeaderboard(container, standings, final = false) {
  container.replaceChildren();

  standings.forEach((participant, index) => {
    const rankValue = final ? participant.finalRank : index + 1;
    const firstPlace = rankValue === 1;
    const row = document.createElement("div");
    row.className = "quiz-leaderboard-row";
    row.setAttribute("role", "listitem");
    if (firstPlace) row.classList.add(final ? "winner" : "leader");
    if (participant.isCurrentUser) row.classList.add("current");

    const rank = document.createElement("span");
    rank.className = "quiz-leaderboard-rank";
    rank.textContent = String(rankValue ?? "—");

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.backgroundColor = avatarColor(participant.name);
    avatar.textContent = initials(participant.name);

    const identity = document.createElement("div");
    identity.className = "quiz-leaderboard-player";
    const name = document.createElement("strong");
    name.textContent = participant.name;
    const badges = document.createElement("small");
    const labels = [];
    if (final && firstPlace) labels.push(tr("winnerBadge"));
    if (participant.isCurrentUser) labels.push(tr("you"));
    badges.textContent = labels.join(" · ");
    badges.hidden = labels.length === 0;
    identity.append(name, badges);

    const score = document.createElement("strong");
    score.className = "quiz-leaderboard-score";
    score.textContent = scoreLabel(participant.score);
    row.append(rank, avatar, identity, score);
    container.append(row);
  });
}

function renderRoundStandings() {
  const standings = sortedStandings();
  roundStandingsProgress.textContent = tr("roundProgress")
    .replace("{current}", String(game.currentQuestionPosition))
    .replace("{total}", String(game.questionCount));
  roundPlayerCount.textContent = String(standings.length);
  roundStandingsGuidance.textContent = tr(
    game.canManage ? "hostContinueGuidance" : "playerContinueGuidance",
  );
  roundStandingsActions.hidden = !game.canManage;
  nextQuestionButton.textContent = tr(
    game.currentQuestionPosition === game.questionCount ? "showFinalResults" : "nextQuestion",
  );
  renderLeaderboard(roundLeaderboardList, standings);
}

function renderResults() {
  const standings = sortedStandings(true);
  const winner = standings.find(({ finalRank }) => finalRank === 1) || standings[0];

  winnerName.textContent = winner?.name || "—";
  winnerScore.textContent = winner ? scoreLabel(winner.score) : scoreLabel(0);
  resultPlayerCount.textContent = String(standings.length);
  renderLeaderboard(leaderboardList, standings, true);
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
  [backToRoomLink, startedBackLink, resultsBackLink, cancelledBackLink]
    .forEach((link) => { link.href = roomUrl; });

  waitingView.hidden = game.status !== "waiting";
  const canViewQuestion = game.status === "active"
    && !game.showStandings
    && game.currentQuestion
    && (game.isJoined || game.canManage);
  const canViewRoundStandings = game.status === "active"
    && game.showStandings
    && (game.isJoined || game.canManage);
  questionView.hidden = !canViewQuestion;
  roundStandingsView.hidden = !canViewRoundStandings;
  startedView.hidden = !(game.status === "active" && !canViewQuestion && !canViewRoundStandings);
  resultsView.hidden = game.status !== "finished";
  cancelledView.hidden = game.status !== "cancelled";
  startedKicker.textContent = tr("gameStarted");
  startedHeading.textContent = tr("watchingGame");
  startedCopy.textContent = tr("spectatorCopy");
  if (game.status === "finished") renderResults();
  if (canViewQuestion) renderQuestion();
  if (canViewRoundStandings) renderRoundStandings();
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
  const requestedAt = Date.now();
  try {
    const [roomPayload, gamePayload] = await Promise.all([
      room ? Promise.resolve({ room }) : api(`/api/rooms/${encodeURIComponent(roomId)}`),
      api(`/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}`),
    ]);
    room = roomPayload.room;
    game = gamePayload.game;
    syncServerClock(game.serverNow, requestedAt);
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
  const requestedAt = Date.now();
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/${action}`,
      { method: "POST" },
    );
    game = payload.game;
    syncServerClock(game.serverNow, requestedAt);
    renderGame();
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

async function submitAnswer(optionId) {
  if (answerSubmitting || game?.myAnswer || questionRemainingMs() === 0) return;
  answerSubmitting = true;
  answerOptions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  answerStatus.textContent = tr("submittingAnswer");
  answerStatus.className = "quiz-answer-status submitting";
  const requestedAt = Date.now();
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      },
    );
    game = payload.game;
    syncServerClock(game.serverNow, requestedAt);
    renderGame();
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    answerSubmitting = false;
    if (game) renderGame();
  }
}

async function closeCurrentQuestion(automatic = false) {
  if (roundActionInFlight || game?.status !== "active" || game?.questionPhase !== "question") return;
  roundActionInFlight = true;
  closeQuestionButton.disabled = true;
  closeQuestionButton.textContent = tr("closingQuestion");
  const requestedAt = Date.now();
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/close-question`,
      { method: "POST" },
    );
    game = payload.game;
    syncServerClock(game.serverNow, requestedAt);
    renderGame();
  } catch (error) {
    autoCloseQuestionId = null;
    if (!automatic) showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    roundActionInFlight = false;
    closeQuestionButton.disabled = false;
    closeQuestionButton.textContent = tr("closeQuestion");
  }
}

async function advanceCurrentQuestion() {
  if (
    roundActionInFlight
    || game?.status !== "active"
    || game?.questionPhase !== "reveal"
    || !game?.showStandings
  ) return;
  roundActionInFlight = true;
  nextQuestionButton.disabled = true;
  nextQuestionButton.textContent = tr("advancingQuestion");
  const requestedAt = Date.now();
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/next-question`,
      { method: "POST" },
    );
    game = payload.game;
    autoCloseQuestionId = null;
    syncServerClock(game.serverNow, requestedAt);
    renderGame();
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    roundActionInFlight = false;
    nextQuestionButton.disabled = false;
    if (game) renderGame();
  }
}

async function showCurrentStandings() {
  if (
    roundActionInFlight
    || game?.status !== "active"
    || game?.questionPhase !== "reveal"
    || game?.showStandings
  ) return;
  roundActionInFlight = true;
  showStandingsButton.disabled = true;
  showStandingsButton.textContent = tr("showingStandings");
  const requestedAt = Date.now();
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/quiz-games/${encodeURIComponent(gameId)}/show-standings`,
      { method: "POST" },
    );
    game = payload.game;
    syncServerClock(game.serverNow, requestedAt);
    renderGame();
  } catch (error) {
    showToast(errorMessage(error), true);
    await loadGame(false);
  } finally {
    roundActionInFlight = false;
    showStandingsButton.disabled = false;
    showStandingsButton.textContent = tr("showStandings");
  }
}

joinGameButton.addEventListener("click", () => runAction("join", joinGameButton, "joining"));
leaveGameButton.addEventListener("click", () => runAction("leave", leaveGameButton, "leaving"));
startGameButton.addEventListener("click", () => runAction("start", startGameButton, "starting"));
cancelGameButton.addEventListener("click", () => {
  if (confirm(tr("cancelConfirm"))) runAction("cancel", cancelGameButton, "cancelling");
});
closeQuestionButton.addEventListener("click", () => closeCurrentQuestion(false));
showStandingsButton.addEventListener("click", showCurrentStandings);
nextQuestionButton.addEventListener("click", advanceCurrentQuestion);

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
  setInterval(renderQuestionTimer, 200);
  setInterval(() => {
    if (document.visibilityState === "visible" && gameSocket?.readyState !== WebSocket.OPEN) loadGame(false);
  }, 30_000);
}
