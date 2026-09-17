const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let room = null;
let meetingState = { activeMeeting: null, recentMeetings: [] };
let speechState = { activeSpeech: null, recentSpeeches: [] };

const translations = {
  en: {
    pageTitle: "Standup Helper — room",
    description: "Standup Helper room",
    allRooms: "All rooms",
    loading: "Loading room…",
    room: "Room",
    roomCopy: "The shared space for participants, speaking time, tasks, and future quizzes.",
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
    speechHistory: "Speaking history",
    currentStandupTurns: "Current standup turns",
    noSpeechHistory: "Completed speaker turns will appear here.",
    overLimit: "Over the limit",
    withinLimit: "Within the limit",
    notFound: "This room is unavailable or you are not a member.",
    unavailable: "Could not load the room.",
  },
  ru: {
    pageTitle: "Standup Helper — комната",
    description: "Комната Standup Helper",
    allRooms: "Все комнаты",
    loading: "Загружаем комнату…",
    room: "Комната",
    roomCopy: "Общее пространство для участников, времени выступлений, заданий и будущих викторин.",
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
    speechHistory: "История выступлений",
    currentStandupTurns: "Выступления текущего стендапа",
    noSpeechHistory: "Завершённые выступления появятся здесь.",
    overLimit: "Лимит превышен",
    withinLimit: "В пределах лимита",
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
const speechHistoryPanel = document.getElementById("speechHistoryPanel");
const speechHistoryList = document.getElementById("speechHistoryList");

function tr(key) {
  return translations[language][key] || key;
}

function roleLabel(role) {
  return tr(role === "owner" ? "owner" : role === "admin" ? "admin" : "member");
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
  speechHistoryPanel.hidden = !activeMeeting;

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

  speechHistoryList.replaceChildren();
  if (!speechState.recentSpeeches.length) {
    const empty = document.createElement("p");
    empty.className = "meeting-history-empty";
    empty.textContent = tr("noSpeechHistory");
    speechHistoryList.append(empty);
  } else {
    speechState.recentSpeeches.forEach((completedSpeech) => {
      const item = document.createElement("div");
      item.className = `speech-history-item${completedSpeech.overLimit ? " over-limit" : ""}`;
      const speaker = document.createElement("strong");
      speaker.textContent = completedSpeech.speaker.name;
      const details = document.createElement("small");
      details.textContent = `${formattedDate(completedSpeech.startedAt)} · ${tr(completedSpeech.overLimit ? "overLimit" : "withinLimit")}`;
      const duration = document.createElement("span");
      duration.textContent = `${formattedDuration(completedSpeech.accumulatedSeconds)} / ${formattedDuration(completedSpeech.talkLimitSeconds)}`;
      item.append(speaker, details, duration);
      speechHistoryList.append(item);
    });
  }
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
    const previousMeetingId = meetingState.activeMeeting?.id;
    meetingState = await api(`/api/rooms/${encodeURIComponent(room.id)}/meetings`, {
      cache: "no-store",
    });
    if (previousMeetingId !== meetingState.activeMeeting?.id) {
      speechState = { activeSpeech: null, recentSpeeches: [] };
    }
    renderMeetingState();
    await loadSpeechState(showFailure);
    renderRoom();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") {
      showToast(tr("meetingUnavailable"), true);
    }
  }
}

async function loadSpeechState(showFailure = true) {
  const meeting = meetingState.activeMeeting;
  if (!meeting) {
    speechState = { activeSpeech: null, recentSpeeches: [] };
    renderSpeechState();
    return;
  }
  try {
    speechState = await api(
      `/api/rooms/${encodeURIComponent(room.id)}/meetings/${encodeURIComponent(meeting.id)}/speeches`,
      { cache: "no-store" },
    );
    renderSpeechState();
  } catch (error) {
    if (showFailure && error?.message !== "AUTH_REQUIRED") {
      showToast(tr("meetingUnavailable"), true);
    }
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
      loading.textContent = tr(response.status === 404 ? "notFound" : "unavailable");
      loading.classList.add("error-copy");
      return;
    }
    room = payload.room;
    loading.hidden = true;
    content.hidden = false;
    renderRoom();
    await loadMeetingState();
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
  if (room && document.visibilityState === "visible") loadMeetingState(false);
}, 10_000);
