const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let rooms = [];

const translations = {
  en: {
    pageTitle: "Standup Helper — rooms",
    description: "Your Standup Helper rooms",
    timer: "Timer",
    logout: "Log out",
    loggingOut: "Logging out…",
    workspace: "Your workspace",
    heroLine1: "Rooms for every",
    heroLine2: "conversation.",
    heroCopy: "Create a room you manage, or join a teammate using their six-character code.",
    newRoom: "New room",
    createRoom: "Create a room",
    createCopy: "You become its owner and can invite participants with a code.",
    roomName: "Room name",
    roomPlaceholder: "Product standup",
    talkLimit: "Default talk limit",
    create: "Create room",
    creating: "Creating…",
    invitation: "Invitation",
    joinRoom: "Join a room",
    joinCopy: "Enter the code shared by the room owner.",
    joinCode: "Room code",
    join: "Join room",
    joining: "Joining…",
    membership: "Membership",
    yourRooms: "Your rooms",
    refresh: "Refresh",
    loading: "Loading rooms…",
    emptyTitle: "No rooms yet",
    emptyCopy: "Create your first room or enter an invitation code.",
    member: "member",
    members: "members",
    owner: "Owner",
    admin: "Admin",
    roleMember: "Member",
    code: "Code",
    open: "Open room",
    created: "Room created",
    joined: "You joined the room",
    invalidName: "Enter a room name.",
    invalidCode: "Enter a valid six-character room code.",
    notFound: "No active room was found for this code.",
    unavailable: "Could not reach the server. Try again.",
    loadFailed: "Could not load your rooms.",
    requestFailed: "Could not complete the request.",
  },
  ru: {
    pageTitle: "Standup Helper — комнаты",
    description: "Ваши комнаты Standup Helper",
    timer: "Таймер",
    logout: "Выйти",
    loggingOut: "Выходим…",
    workspace: "Ваше пространство",
    heroLine1: "Комнаты для каждого",
    heroLine2: "разговора.",
    heroCopy: "Создайте комнату для своей команды или присоединитесь по шестизначному коду.",
    newRoom: "Новая комната",
    createRoom: "Создать комнату",
    createCopy: "Вы станете владельцем и сможете приглашать участников по коду.",
    roomName: "Название комнаты",
    roomPlaceholder: "Продуктовый стендап",
    talkLimit: "Лимит выступления",
    create: "Создать комнату",
    creating: "Создаём…",
    invitation: "Приглашение",
    joinRoom: "Войти в комнату",
    joinCopy: "Введите код, которым поделился владелец комнаты.",
    joinCode: "Код комнаты",
    join: "Присоединиться",
    joining: "Подключаем…",
    membership: "Участие",
    yourRooms: "Ваши комнаты",
    refresh: "Обновить",
    loading: "Загружаем комнаты…",
    emptyTitle: "Комнат пока нет",
    emptyCopy: "Создайте первую комнату или введите код приглашения.",
    member: "участник",
    members: "участников",
    owner: "Владелец",
    admin: "Администратор",
    roleMember: "Участник",
    code: "Код",
    open: "Открыть комнату",
    created: "Комната создана",
    joined: "Вы присоединились к комнате",
    invalidName: "Введите название комнаты.",
    invalidCode: "Введите корректный шестизначный код комнаты.",
    notFound: "Активная комната с таким кодом не найдена.",
    unavailable: "Не удалось связаться с сервером. Попробуйте ещё раз.",
    loadFailed: "Не удалось загрузить комнаты.",
    requestFailed: "Не удалось выполнить запрос.",
  },
};

const accountName = document.getElementById("accountName");
const createForm = document.getElementById("createRoomForm");
const joinForm = document.getElementById("joinRoomForm");
const roomNameInput = document.getElementById("roomNameInput");
const talkLimitInput = document.getElementById("talkLimitInput");
const joinCodeInput = document.getElementById("joinCodeInput");
const roomsList = document.getElementById("roomsList");
const refreshButton = document.getElementById("refreshRoomsButton");
const logoutButton = document.getElementById("logoutButton");
const toast = document.getElementById("toast");

function tr(key) {
  return translations[language][key] || key;
}

function applyLanguage(nextLanguage) {
  language = nextLanguage === "ru" ? "ru" : "en";
  localStorage.setItem(languageKey, language);
  document.documentElement.lang = language;
  document.title = tr("pageTitle");
  document.querySelector('meta[name="description"]').content = tr("description");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = tr(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderRooms();
}

function showToast(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function formMessage(kind, message = "") {
  document.querySelector(`[data-form-message="${kind}"]`).textContent = message;
}

function roleLabel(role) {
  return tr(role === "owner" ? "owner" : role === "admin" ? "admin" : "roleMember");
}

function memberLabel(count) {
  return `${count} ${tr(count === 1 ? "member" : "members")}`;
}

function renderRooms() {
  roomsList.replaceChildren();
  if (!rooms.length) {
    const empty = document.createElement("div");
    empty.className = "rooms-empty";
    const title = document.createElement("h3");
    title.textContent = tr("emptyTitle");
    const copy = document.createElement("p");
    copy.textContent = tr("emptyCopy");
    empty.append(title, copy);
    roomsList.append(empty);
    return;
  }

  rooms.forEach((room) => {
    const card = document.createElement("article");
    card.className = "room-card";

    const heading = document.createElement("div");
    heading.className = "room-card-heading";
    const title = document.createElement("h3");
    title.textContent = room.name;
    const role = document.createElement("span");
    role.className = `role-pill role-${room.role}`;
    role.textContent = roleLabel(room.role);
    heading.append(title, role);

    const meta = document.createElement("div");
    meta.className = "room-card-meta";
    const members = document.createElement("span");
    members.textContent = memberLabel(room.memberCount);
    const code = document.createElement("span");
    code.textContent = `${tr("code")}: ${room.joinCode}`;
    meta.append(members, code);

    const link = document.createElement("a");
    link.className = "room-open-link";
    link.href = `/rooms/${room.id}`;
    link.textContent = tr("open");

    card.append(heading, meta, link);
    roomsList.append(card);
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
  });
  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("AUTH_REQUIRED");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.code || "REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function loadSession() {
  const response = await fetch("/api/auth/get-session", { cache: "no-store" });
  if (!response.ok) throw new Error("SESSION_FAILED");
  const session = await response.json();
  if (!session?.user) {
    window.location.replace("/");
    return false;
  }
  accountName.textContent = session.user.name;
  accountName.title = session.user.email;
  return true;
}

async function loadRooms() {
  roomsList.innerHTML = `<p class="rooms-loading">${tr("loading")}</p>`;
  refreshButton.disabled = true;
  try {
    const payload = await api("/api/rooms", { cache: "no-store" });
    rooms = payload.rooms || [];
    renderRooms();
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") {
      roomsList.innerHTML = `<p class="rooms-loading error-copy">${tr("loadFailed")}</p>`;
    }
  } finally {
    refreshButton.disabled = false;
  }
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage("create");
  const name = roomNameInput.value.trim();
  if (!name) {
    formMessage("create", tr("invalidName"));
    return;
  }
  const button = createForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = tr("creating");
  try {
    const payload = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name, defaultTalkLimitSeconds: Number(talkLimitInput.value) }),
    });
    roomNameInput.value = "";
    rooms = [payload.room, ...rooms.filter((room) => room.id !== payload.room.id)];
    renderRooms();
    showToast(tr("created"));
  } catch (error) {
    formMessage("create", tr(error.message === "INVALID_ROOM_NAME" ? "invalidName" : "requestFailed"));
  } finally {
    button.disabled = false;
    button.textContent = tr("create");
  }
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage("join");
  const joinCode = joinCodeInput.value.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(joinCode)) {
    formMessage("join", tr("invalidCode"));
    return;
  }
  const button = joinForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = tr("joining");
  try {
    const payload = await api("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ joinCode }),
    });
    joinCodeInput.value = "";
    rooms = [payload.room, ...rooms.filter((room) => room.id !== payload.room.id)];
    renderRooms();
    showToast(tr("joined"));
  } catch (error) {
    const key = error.message === "ROOM_NOT_FOUND"
      ? "notFound"
      : error.message === "INVALID_JOIN_CODE" ? "invalidCode" : "requestFailed";
    formMessage("join", tr(key));
  } finally {
    button.disabled = false;
    button.textContent = tr("join");
  }
});

joinCodeInput.addEventListener("input", () => {
  const compact = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  joinCodeInput.value = compact;
});

refreshButton.addEventListener("click", loadRooms);

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = tr("loggingOut");
  try {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("SIGN_OUT_FAILED");
    window.location.replace("/");
  } catch {
    logoutButton.disabled = false;
    logoutButton.textContent = tr("logout");
    showToast(tr("unavailable"), true);
  }
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

applyLanguage(language);
Promise.all([loadSession(), loadRooms()]).catch(() => showToast(tr("unavailable"), true));
