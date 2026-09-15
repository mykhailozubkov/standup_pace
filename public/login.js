const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";

const translations = {
  en: {
    pageTitle: "Standup Helper — admin sign in",
    description: "Sign in to the Standup Helper admin workspace",
    eyebrow: "A calmer rhythm for every meeting",
    heroLine1: "Keep every voice",
    heroLine2: "in the conversation.",
    heroCopy: "Sign in to manage participants, speaking time, and team activities.",
    adminArea: "Admin area",
    signIn: "Sign in",
    signInCopy: "Use the administrator credentials configured for this deployment.",
    username: "Username",
    password: "Password",
    continue: "Continue",
    signingIn: "Signing in…",
    sessionNote: "Your secure session lasts for 24 hours.",
    required: "Enter your username and password.",
    invalidCredentials: "The username or password is incorrect.",
    notConfigured: "Administrator credentials are not configured on the server.",
    unavailable: "The service is unavailable. Check your connection and try again.",
    unexpected: "Could not sign in. Please try again.",
  },
  ru: {
    pageTitle: "Standup Helper — вход администратора",
    description: "Вход в административную часть Standup Helper",
    eyebrow: "Спокойный ритм для каждой встречи",
    heroLine1: "Помогайте каждому",
    heroLine2: "быть услышанным.",
    heroCopy: "Войдите, чтобы управлять участниками, временем выступлений и командными активностями.",
    adminArea: "Панель администратора",
    signIn: "Вход",
    signInCopy: "Используйте учётные данные администратора, настроенные для этого приложения.",
    username: "Логин",
    password: "Пароль",
    continue: "Продолжить",
    signingIn: "Выполняется вход…",
    sessionNote: "Защищённая сессия действует 24 часа.",
    required: "Введите логин и пароль.",
    invalidCredentials: "Неверный логин или пароль.",
    notConfigured: "Учётные данные администратора не настроены на сервере.",
    unavailable: "Сервис недоступен. Проверьте подключение и попробуйте ещё раз.",
    unexpected: "Не удалось выполнить вход. Попробуйте ещё раз.",
  },
};

const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

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
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function showMessage(key) {
  loginMessage.textContent = key ? tr(key) : "";
}

function setLoading(loading) {
  usernameInput.disabled = loading;
  passwordInput.disabled = loading;
  loginButton.disabled = loading;
  loginButton.textContent = tr(loading ? "signingIn" : "continue");
}

async function checkExistingSession() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const payload = await response.json();
    if (payload.authenticated) {
      window.location.replace("/admin");
      return;
    }
    if (payload.configured === false) showMessage("notConfigured");
  } catch {
    showMessage("unavailable");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  if (!usernameInput.value.trim() || !passwordInput.value) {
    showMessage("required");
    return;
  }

  setLoading(true);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput.value.trim(), password: passwordInput.value }),
    });
    const payload = await response.json();
    if (response.ok && payload.authenticated) {
      passwordInput.value = "";
      window.location.replace("/admin");
      return;
    }
    showMessage(payload.code === "AUTH_NOT_CONFIGURED" ? "notConfigured" : "invalidCredentials");
  } catch {
    showMessage("unavailable");
  } finally {
    setLoading(false);
  }
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

applyLanguage(language);
checkExistingSession();
