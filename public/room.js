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
    settingsCopy: "Editing room settings and assigning administrators comes in the permissions stage.",
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
    settingsCopy: "Изменение настроек комнаты и назначение администраторов появится на этапе прав доступа.",
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

  membersList.replaceChildren();
  room.members.forEach((member) => {
    const item = document.createElement("div");
    item.className = "room-member";
    const avatar = document.createElement("span");
    avatar.className = "room-member-avatar";
    avatar.textContent = member.name.slice(0, 1).toUpperCase();
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = member.name;
    const role = document.createElement("small");
    role.textContent = roleLabel(member.role);
    details.append(name, role);
    item.append(avatar, details);
    membersList.append(item);
  });
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
