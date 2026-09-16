const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let authMode = "signIn";

const translations = {
  en: {
    pageTitle: "Standup Helper — sign in",
    description: "Sign in or create a Standup Helper account",
    eyebrow: "A calmer rhythm for every meeting",
    heroLine1: "Keep every voice",
    heroLine2: "in the conversation.",
    heroCopy: "Create an account to organize your rooms, or sign in to join someone else's meeting.",
    accountArea: "Your workspace",
    signIn: "Sign in",
    createAccount: "Create account",
    signInCopy: "Use your email and password to continue.",
    signUpCopy: "Create a personal account. You will be able to own rooms and join other rooms.",
    displayName: "Display name",
    email: "Email",
    password: "Password",
    continue: "Continue",
    creating: "Creating account…",
    signingIn: "Signing in…",
    sessionNote: "Sessions last 24 hours. Email verification is not required yet.",
    requiredSignIn: "Enter your email and password.",
    requiredSignUp: "Enter your name, email, and password.",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "Use at least 12 characters for the password.",
    invalidCredentials: "The email or password is incorrect.",
    userExists: "An account with this email already exists.",
    rateLimited: "Too many attempts. Wait a minute and try again.",
    notConfigured: "Account authentication is not configured on the server.",
    unavailable: "The service is unavailable. Check your connection and try again.",
    unexpected: "Could not complete the request. Please try again.",
  },
  ru: {
    pageTitle: "Standup Helper — вход",
    description: "Вход или создание аккаунта Standup Helper",
    eyebrow: "Спокойный ритм для каждой встречи",
    heroLine1: "Помогайте каждому",
    heroLine2: "быть услышанным.",
    heroCopy: "Создайте аккаунт для своих комнат или войдите, чтобы подключаться к встречам других пользователей.",
    accountArea: "Ваше рабочее пространство",
    signIn: "Войти",
    createAccount: "Создать аккаунт",
    signInCopy: "Введите email и пароль, чтобы продолжить.",
    signUpCopy: "Создайте личный аккаунт. Вы сможете управлять своими комнатами и входить в чужие.",
    displayName: "Отображаемое имя",
    email: "Email",
    password: "Пароль",
    continue: "Продолжить",
    creating: "Создаём аккаунт…",
    signingIn: "Выполняется вход…",
    sessionNote: "Сессия действует 24 часа. Подтверждение email пока не требуется.",
    requiredSignIn: "Введите email и пароль.",
    requiredSignUp: "Введите имя, email и пароль.",
    invalidEmail: "Введите корректный email.",
    passwordTooShort: "Пароль должен содержать не менее 12 символов.",
    invalidCredentials: "Неверный email или пароль.",
    userExists: "Аккаунт с таким email уже существует.",
    rateLimited: "Слишком много попыток. Подождите минуту и повторите.",
    notConfigured: "Авторизация аккаунтов не настроена на сервере.",
    unavailable: "Сервис недоступен. Проверьте подключение и попробуйте ещё раз.",
    unexpected: "Не удалось выполнить запрос. Попробуйте ещё раз.",
  },
};

const form = document.getElementById("loginForm");
const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const loginTitle = document.getElementById("loginTitle");
const authModeCopy = document.getElementById("authModeCopy");
const authModeButtons = [...document.querySelectorAll("[data-auth-mode]")];

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
  updateAuthModeCopy();
}

function updateAuthModeCopy() {
  const signingUp = authMode === "signUp";
  loginTitle.textContent = tr(signingUp ? "createAccount" : "signIn");
  authModeCopy.textContent = tr(signingUp ? "signUpCopy" : "signInCopy");
  loginButton.textContent = tr(signingUp ? "createAccount" : "continue");
}

function setAuthMode(nextMode) {
  authMode = nextMode === "signUp" ? "signUp" : "signIn";
  const signingUp = authMode === "signUp";
  nameField.hidden = !signingUp;
  nameInput.required = signingUp;
  passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
  authModeButtons.forEach((button) => {
    const active = button.dataset.authMode === authMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  showMessage("");
  updateAuthModeCopy();
}

function showMessage(key) {
  loginMessage.textContent = key ? tr(key) : "";
}

function setLoading(loading) {
  nameInput.disabled = loading;
  emailInput.disabled = loading;
  passwordInput.disabled = loading;
  loginButton.disabled = loading;
  authModeButtons.forEach((button) => { button.disabled = loading; });
  loginButton.textContent = tr(loading
    ? authMode === "signUp" ? "creating" : "signingIn"
    : authMode === "signUp" ? "createAccount" : "continue");
}

function errorKey(response, payload) {
  if (response.status === 429) return "rateLimited";
  if (payload?.code === "AUTH_NOT_CONFIGURED") return "notConfigured";
  if (payload?.code === "INVALID_EMAIL") return "invalidEmail";
  if (payload?.code === "PASSWORD_TOO_SHORT") return "passwordTooShort";
  if (["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"].includes(payload?.code)) {
    return "userExists";
  }
  if (authMode === "signIn") return "invalidCredentials";
  return "unexpected";
}

async function checkExistingSession() {
  try {
    const response = await fetch("/api/auth/get-session", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload?.user) window.location.replace("/admin");
  } catch {
    showMessage("unavailable");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password || (authMode === "signUp" && !name)) {
    showMessage(authMode === "signUp" ? "requiredSignUp" : "requiredSignIn");
    return;
  }
  if (!emailInput.validity.valid) {
    showMessage("invalidEmail");
    return;
  }
  if (password.length < 12) {
    showMessage("passwordTooShort");
    return;
  }

  setLoading(true);
  try {
    const signingUp = authMode === "signUp";
    const response = await fetch(signingUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signingUp ? { name, email, password } : { email, password }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.user) {
      passwordInput.value = "";
      window.location.replace("/admin");
      return;
    }
    showMessage(errorKey(response, payload));
  } catch {
    showMessage("unavailable");
  } finally {
    setLoading(false);
  }
});

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

applyLanguage(language);
setAuthMode("signIn");
checkExistingSession();
