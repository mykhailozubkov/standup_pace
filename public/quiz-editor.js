const languageKey = "standupHelper.language";
let language = localStorage.getItem(languageKey) === "ru" ? "ru" : "en";
let room = null;
let quizId = null;
let questions = [];
let dirty = false;
let saving = false;

const routeMatch = location.pathname.match(
  /^\/rooms\/([0-9a-f-]{36})\/quizzes\/(new|[0-9a-f-]{36}\/edit)\/?$/i,
);
const roomId = routeMatch?.[1] || null;
if (routeMatch?.[2] !== "new") quizId = routeMatch?.[2]?.split("/")[0] || null;

const translations = {
  en: {
    pageTitleCreate: "Standup Helper — create quiz",
    pageTitleEdit: "Standup Helper — edit quiz",
    description: "Create or edit a Standup Helper quiz",
    backToRoom: "Back to room",
    loading: "Loading quiz editor…",
    quizBuilder: "Quiz builder",
    createHeading: "Create a quiz",
    editHeading: "Edit quiz",
    editorCopy: "Build the questions now. Live lobby and gameplay controls will be added in the next stage.",
    draft: "Draft",
    quizTitle: "Quiz title",
    titlePlaceholder: "Team knowledge quiz",
    quizDescription: "Description",
    descriptionPlaceholder: "What should participants expect?",
    content: "Content",
    questions: "Questions",
    addQuestion: "Add question",
    question: "Question",
    questionPrompt: "Question text",
    promptPlaceholder: "Type the question participants will see",
    timeLimit: "Answer time",
    seconds: "seconds",
    answerOptions: "Answer options",
    optionPlaceholder: "Answer option",
    correctAnswer: "Correct answer",
    addOption: "Add answer option",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    cancel: "Cancel",
    saveQuiz: "Save quiz",
    saving: "Saving…",
    saved: "Quiz saved",
    leaveConfirm: "Leave without saving your changes?",
    forbidden: "Only room owners and administrators can edit quizzes.",
    unavailable: "Could not load the quiz editor.",
    invalidTitle: "Enter a quiz title up to 120 characters.",
    invalidQuestions: "A quiz must contain between 1 and 50 questions.",
    invalidQuestion: "Complete every question text.",
    invalidTime: "Answer time must be between 5 and 120 seconds.",
    invalidOptions: "Each question must contain between 2 and 4 answers.",
    invalidOption: "Complete every answer option.",
    duplicateOption: "Answer options inside a question must be different.",
    invalidCorrect: "Select exactly one correct answer for every question.",
    requestFailed: "The quiz could not be saved. Try again.",
    notFound: "This quiz is unavailable.",
  },
  ru: {
    pageTitleCreate: "Standup Helper — новая викторина",
    pageTitleEdit: "Standup Helper — редактор викторины",
    description: "Создание и редактирование викторины Standup Helper",
    backToRoom: "Вернуться в комнату",
    loading: "Загружаем редактор…",
    quizBuilder: "Конструктор викторин",
    createHeading: "Создать викторину",
    editHeading: "Редактировать викторину",
    editorCopy: "Сейчас подготовьте вопросы. Лобби и управление игрой появятся на следующем этапе.",
    draft: "Черновик",
    quizTitle: "Название викторины",
    titlePlaceholder: "Викторина о нашей команде",
    quizDescription: "Описание",
    descriptionPlaceholder: "О чём будет эта викторина?",
    content: "Содержание",
    questions: "Вопросы",
    addQuestion: "Добавить вопрос",
    question: "Вопрос",
    questionPrompt: "Текст вопроса",
    promptPlaceholder: "Введите вопрос, который увидят участники",
    timeLimit: "Время на ответ",
    seconds: "секунд",
    answerOptions: "Варианты ответа",
    optionPlaceholder: "Вариант ответа",
    correctAnswer: "Правильный ответ",
    addOption: "Добавить вариант",
    moveUp: "Переместить выше",
    moveDown: "Переместить ниже",
    remove: "Удалить",
    cancel: "Отмена",
    saveQuiz: "Сохранить викторину",
    saving: "Сохраняем…",
    saved: "Викторина сохранена",
    leaveConfirm: "Выйти без сохранения изменений?",
    forbidden: "Редактировать викторины могут только владелец и администраторы комнаты.",
    unavailable: "Не удалось загрузить редактор викторины.",
    invalidTitle: "Введите название викторины длиной до 120 символов.",
    invalidQuestions: "В викторине должно быть от 1 до 50 вопросов.",
    invalidQuestion: "Заполните текст каждого вопроса.",
    invalidTime: "Время ответа должно быть от 5 до 120 секунд.",
    invalidOptions: "У каждого вопроса должно быть от 2 до 4 вариантов.",
    invalidOption: "Заполните все варианты ответа.",
    duplicateOption: "Варианты ответа внутри вопроса не должны повторяться.",
    invalidCorrect: "Выберите ровно один правильный ответ для каждого вопроса.",
    requestFailed: "Не удалось сохранить викторину. Попробуйте ещё раз.",
    notFound: "Эта викторина недоступна.",
  },
};

const loading = document.getElementById("editorLoading");
const content = document.getElementById("editorContent");
const form = document.getElementById("quizForm");
const heading = document.getElementById("editorHeading");
const titleInput = document.getElementById("quizTitleInput");
const descriptionInput = document.getElementById("quizDescriptionInput");
const questionsList = document.getElementById("questionsList");
const questionCount = document.getElementById("questionCount");
const addQuestionButton = document.getElementById("addQuestionButton");
const saveButton = document.getElementById("saveQuizButton");
const message = document.getElementById("editorMessage");
const backLink = document.getElementById("backToRoomLink");
const cancelLink = document.getElementById("cancelEditorLink");
const toast = document.getElementById("toast");

function tr(key) {
  return translations[language][key] || key;
}

function clientId() {
  return crypto.randomUUID();
}

function newOption(text = "", isCorrect = false) {
  return { clientId: clientId(), text, isCorrect };
}

function newQuestion() {
  return {
    clientId: clientId(),
    prompt: "",
    timeLimitSeconds: 20,
    options: [newOption("", true), newOption()],
  };
}

function markDirty() {
  dirty = true;
  message.textContent = "";
}

function showToast(text, error = false) {
  toast.textContent = text;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2800);
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

function errorMessage(error) {
  const keys = {
    ROOM_FORBIDDEN: "forbidden",
    ROOM_NOT_FOUND: "unavailable",
    QUIZ_NOT_FOUND: "notFound",
    INVALID_QUIZ_TITLE: "invalidTitle",
    INVALID_QUIZ_QUESTIONS: "invalidQuestions",
    INVALID_QUIZ_QUESTION: "invalidQuestion",
    INVALID_QUIZ_TIME_LIMIT: "invalidTime",
    INVALID_QUIZ_OPTIONS: "invalidOptions",
    INVALID_QUIZ_OPTION: "invalidOption",
    DUPLICATE_QUIZ_OPTION: "duplicateOption",
    INVALID_QUIZ_CORRECT_OPTION: "invalidCorrect",
  };
  return tr(keys[error?.message] || "requestFailed");
}

function actionButton(labelKey, text, disabled, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quiz-icon-action";
  button.textContent = text;
  button.title = tr(labelKey);
  button.setAttribute("aria-label", tr(labelKey));
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  markDirty();
  renderQuestions();
}

function renderQuestions() {
  questionCount.textContent = String(questions.length);
  addQuestionButton.disabled = questions.length >= 50;
  questionsList.replaceChildren();

  questions.forEach((question, questionIndex) => {
    const card = document.createElement("article");
    card.className = "panel quiz-question-card";

    const cardHeader = document.createElement("div");
    cardHeader.className = "quiz-question-header";
    const label = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = `${tr("question")} ${questionIndex + 1}`;
    const number = document.createElement("strong");
    number.textContent = String(questionIndex + 1).padStart(2, "0");
    label.append(kicker, number);
    const actions = document.createElement("div");
    actions.className = "quiz-order-actions";
    actions.append(
      actionButton("moveUp", "↑", questionIndex === 0, () => moveItem(questions, questionIndex, questionIndex - 1)),
      actionButton("moveDown", "↓", questionIndex === questions.length - 1, () => moveItem(questions, questionIndex, questionIndex + 1)),
      actionButton("remove", "×", questions.length === 1, () => {
        questions.splice(questionIndex, 1);
        markDirty();
        renderQuestions();
      }),
    );
    cardHeader.append(label, actions);

    const promptField = document.createElement("div");
    promptField.className = "quiz-field";
    const promptLabel = document.createElement("label");
    promptLabel.textContent = tr("questionPrompt");
    const prompt = document.createElement("textarea");
    prompt.maxLength = 300;
    prompt.rows = 2;
    prompt.required = true;
    prompt.placeholder = tr("promptPlaceholder");
    prompt.value = question.prompt;
    prompt.addEventListener("input", () => {
      question.prompt = prompt.value;
      markDirty();
    });
    promptField.append(promptLabel, prompt);

    const timeField = document.createElement("div");
    timeField.className = "quiz-field quiz-time-field";
    const timeLabel = document.createElement("label");
    timeLabel.textContent = tr("timeLimit");
    const timeWrap = document.createElement("div");
    timeWrap.className = "quiz-time-input";
    const timeInput = document.createElement("input");
    timeInput.type = "number";
    timeInput.min = "5";
    timeInput.max = "120";
    timeInput.step = "1";
    timeInput.required = true;
    timeInput.value = String(question.timeLimitSeconds);
    timeInput.addEventListener("input", () => {
      question.timeLimitSeconds = Number(timeInput.value);
      markDirty();
    });
    const seconds = document.createElement("span");
    seconds.textContent = tr("seconds");
    timeWrap.append(timeInput, seconds);
    timeField.append(timeLabel, timeWrap);

    const optionsHeading = document.createElement("div");
    optionsHeading.className = "quiz-options-heading";
    const optionsLabel = document.createElement("strong");
    optionsLabel.textContent = tr("answerOptions");
    const correctHint = document.createElement("span");
    correctHint.textContent = tr("correctAnswer");
    optionsHeading.append(optionsLabel, correctHint);

    const optionsList = document.createElement("div");
    optionsList.className = "quiz-options-list";
    question.options.forEach((option, optionIndex) => {
      const row = document.createElement("div");
      row.className = `quiz-option-row quiz-option-${optionIndex + 1}`;
      const correct = document.createElement("input");
      correct.type = "radio";
      correct.name = `correct-${question.clientId}`;
      correct.checked = option.isCorrect;
      correct.setAttribute("aria-label", tr("correctAnswer"));
      correct.addEventListener("change", () => {
        question.options.forEach((candidate) => { candidate.isCorrect = candidate === option; });
        markDirty();
      });
      const optionInput = document.createElement("input");
      optionInput.type = "text";
      optionInput.maxLength = 160;
      optionInput.required = true;
      optionInput.placeholder = `${tr("optionPlaceholder")} ${optionIndex + 1}`;
      optionInput.value = option.text;
      optionInput.addEventListener("input", () => {
        option.text = optionInput.value;
        markDirty();
      });
      const optionActions = document.createElement("div");
      optionActions.className = "quiz-option-actions";
      optionActions.append(
        actionButton("moveUp", "↑", optionIndex === 0, () => moveItem(question.options, optionIndex, optionIndex - 1)),
        actionButton("moveDown", "↓", optionIndex === question.options.length - 1, () => moveItem(question.options, optionIndex, optionIndex + 1)),
        actionButton("remove", "×", question.options.length <= 2, () => {
          const removedWasCorrect = question.options[optionIndex].isCorrect;
          question.options.splice(optionIndex, 1);
          if (removedWasCorrect) question.options[0].isCorrect = true;
          markDirty();
          renderQuestions();
        }),
      );
      row.append(correct, optionInput, optionActions);
      optionsList.append(row);
    });

    const addOption = document.createElement("button");
    addOption.type = "button";
    addOption.className = "text-button quiz-add-option";
    addOption.textContent = `+ ${tr("addOption")}`;
    addOption.disabled = question.options.length >= 4;
    addOption.addEventListener("click", () => {
      question.options.push(newOption());
      markDirty();
      renderQuestions();
    });

    card.append(cardHeader, promptField, timeField, optionsHeading, optionsList, addOption);
    questionsList.append(card);
  });
}

function applyLanguage(nextLanguage) {
  language = nextLanguage === "ru" ? "ru" : "en";
  localStorage.setItem(languageKey, language);
  document.documentElement.lang = language;
  document.title = tr(quizId ? "pageTitleEdit" : "pageTitleCreate");
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
  heading.textContent = tr(quizId ? "editHeading" : "createHeading");
  saveButton.textContent = tr(saving ? "saving" : "saveQuiz");
  if (questions.length) renderQuestions();
}

function editorPayload() {
  const title = titleInput.value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!title || title.length > 120) throw new Error("INVALID_QUIZ_TITLE");
  if (questions.length < 1 || questions.length > 50) throw new Error("INVALID_QUIZ_QUESTIONS");

  const normalizedQuestions = questions.map((question) => {
    const prompt = question.prompt.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!prompt || prompt.length > 300) throw new Error("INVALID_QUIZ_QUESTION");
    if (!Number.isInteger(question.timeLimitSeconds)
      || question.timeLimitSeconds < 5
      || question.timeLimitSeconds > 120) {
      throw new Error("INVALID_QUIZ_TIME_LIMIT");
    }
    if (question.options.length < 2 || question.options.length > 4) {
      throw new Error("INVALID_QUIZ_OPTIONS");
    }
    const options = question.options.map((option) => ({
      text: option.text.normalize("NFKC").replace(/\s+/g, " ").trim(),
      isCorrect: option.isCorrect,
    }));
    if (options.some(({ text }) => !text || text.length > 160)) {
      throw new Error("INVALID_QUIZ_OPTION");
    }
    if (new Set(options.map(({ text }) => text.toLocaleLowerCase())).size !== options.length) {
      throw new Error("DUPLICATE_QUIZ_OPTION");
    }
    if (options.filter(({ isCorrect }) => isCorrect).length !== 1) {
      throw new Error("INVALID_QUIZ_CORRECT_OPTION");
    }
    return { prompt, timeLimitSeconds: question.timeLimitSeconds, options };
  });

  return {
    title,
    description: descriptionInput.value.normalize("NFKC").trim(),
    questions: normalizedQuestions,
  };
}

function hydrateQuestions(values) {
  questions = values.map((question) => ({
    clientId: clientId(),
    prompt: question.prompt,
    timeLimitSeconds: question.timeLimitSeconds,
    options: question.options.map((option) => newOption(option.text, option.isCorrect)),
  }));
}

async function loadEditor() {
  if (!roomId) {
    window.location.replace("/dashboard");
    return;
  }
  try {
    const roomPayload = await api(`/api/rooms/${encodeURIComponent(roomId)}`, { cache: "no-store" });
    room = roomPayload.room;
    const roomUrl = `/rooms/${encodeURIComponent(roomId)}`;
    backLink.href = roomUrl;
    cancelLink.href = roomUrl;
    if (room.role !== "owner" && room.role !== "admin") {
      loading.textContent = tr("forbidden");
      loading.classList.add("error-copy");
      return;
    }

    if (quizId) {
      const payload = await api(
        `/api/rooms/${encodeURIComponent(roomId)}/quizzes/${encodeURIComponent(quizId)}`,
        { cache: "no-store" },
      );
      titleInput.value = payload.quiz.title;
      descriptionInput.value = payload.quiz.description;
      hydrateQuestions(payload.quiz.questions);
    } else {
      questions = [newQuestion()];
    }

    dirty = false;
    loading.hidden = true;
    content.hidden = false;
    applyLanguage(language);
    titleInput.focus();
  } catch (error) {
    if (error?.message === "AUTH_REQUIRED") return;
    loading.textContent = errorMessage(error);
    loading.classList.add("error-copy");
  }
}

titleInput.addEventListener("input", markDirty);
descriptionInput.addEventListener("input", markDirty);
addQuestionButton.addEventListener("click", () => {
  if (questions.length >= 50) return;
  questions.push(newQuestion());
  markDirty();
  renderQuestions();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving) return;
  message.textContent = "";
  let payload;
  try {
    payload = editorPayload();
  } catch (error) {
    message.textContent = errorMessage(error);
    return;
  }

  saving = true;
  saveButton.disabled = true;
  saveButton.textContent = tr("saving");
  try {
    const path = quizId
      ? `/api/rooms/${encodeURIComponent(roomId)}/quizzes/${encodeURIComponent(quizId)}`
      : `/api/rooms/${encodeURIComponent(roomId)}/quizzes`;
    const response = await api(path, {
      method: quizId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    quizId = response.quiz.id;
    titleInput.value = response.quiz.title;
    descriptionInput.value = response.quiz.description;
    hydrateQuestions(response.quiz.questions);
    history.replaceState({}, "", `/rooms/${roomId}/quizzes/${quizId}/edit`);
    dirty = false;
    renderQuestions();
    applyLanguage(language);
    showToast(tr("saved"));
  } catch (error) {
    message.textContent = errorMessage(error);
  } finally {
    saving = false;
    saveButton.disabled = false;
    saveButton.textContent = tr("saveQuiz");
  }
});

for (const link of [backLink, cancelLink]) {
  link.addEventListener("click", (event) => {
    if (dirty && !window.confirm(tr("leaveConfirm"))) event.preventDefault();
  });
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

applyLanguage(language);
loadEditor();
