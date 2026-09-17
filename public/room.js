const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let room = null;

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
    meetingTools: "Meeting tools",
    timerTitle: "Speaker timer",
    timerCopy: "The current timer still stores its data locally. Room synchronization is the next implementation stage.",
    openTimer: "Open current timer",
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
    meetingTools: "Инструменты встречи",
    timerTitle: "Таймер выступлений",
    timerCopy: "Текущий таймер пока хранит данные локально. Синхронизация с комнатой — следующий этап реализации.",
    openTimer: "Открыть текущий таймер",
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
