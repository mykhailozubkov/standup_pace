# Standup Helper

Веб-приложение для управления списком участников, временем выступлений и командными заданиями. Приложение подготовлено для Cloudflare Workers и использует один Worker для статических файлов и серверного API.

## Архитектура

- `public/` — HTML, CSS и клиентский JavaScript.
- `src/worker.ts` — типизированная Hono-маршрутизация, авторизация и Worker API.
- `src/auth.ts` — вход администратора и подписанная cookie-сессия на 24 часа.
- `src/openrouter.ts` — генерация заданий через OpenRouter.
- `src/errors.ts` — безопасная классификация ошибок.
- `src/env.ts` — типы Cloudflare bindings и переменных окружения.
- `migrations/` — версионируемая схема Cloudflare D1.
- `wrangler.jsonc` — конфигурация Cloudflare Worker `standup-helper`.

D1 уже подключена как binding `DB`. Первая миграция создаёт профили пользователей, комнаты и членство с ролями `owner`, `admin` и `member`. До следующих этапов приложение ещё не записывает туда данные: участники, история, таймер и циклы жеребьёвки по-прежнему хранятся в `localStorage` браузера администратора.

## Локальный запуск

Потребуются Node.js 22.6 или новее и API-ключ со страницы [OpenRouter Keys](https://openrouter.ai/settings/keys).

Установите зависимости:

```powershell
npm install
```

Создайте локальный файл с секретами:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Заполните `.dev.vars`:

```dotenv
ADMIN_USERNAME=ваш-логин
ADMIN_PASSWORD=сложный-пароль-не-короче-12-символов
SESSION_SECRET=случайная-строка-не-короче-32-символов
OPENROUTER_API_KEY=ваш-ключ-openrouter
```

Случайный `SESSION_SECRET` можно сгенерировать командой:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Не публикуйте содержимое `.dev.vars`. Файл исключён из Git.

Запустите локальную среду Cloudflare:

```powershell
npm run db:migrate:local
npm run dev
```

Wrangler покажет локальный адрес, обычно `http://localhost:8787`. Корневая страница содержит форму входа, а рабочая панель доступна по `/admin` после авторизации.

## Ручной production-деплой

Целевой адрес:

```text
https://standup-helper.mykhailo-zubkov.workers.dev
```

Сначала авторизуйте Wrangler:

```powershell
npx wrangler login
```

Добавьте production-секреты. Каждая команда попросит значение интерактивно — не вставляйте секрет непосредственно в текст команды:

```powershell
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OPENROUTER_API_KEY
```

После этого выполните:

```powershell
npm run db:migrate:remote
npm run deploy
```

Обычные настройки `OPENROUTER_MODEL` и `PUBLIC_APP_URL` находятся в `wrangler.jsonc`. Секретов в этом файле быть не должно.

## Авторизация

- используется один администратор;
- самостоятельной регистрации и восстановления пароля нет;
- успешный вход создаёт подписанную `HttpOnly` cookie;
- production-cookie передаётся только по HTTPS;
- срок сессии — 24 часа;
- выход удаляет cookie;
- `/admin` и `/api/task` недоступны без действующей сессии;
- неправильный логин и неправильный пароль возвращают одинаковую ошибку.

Используйте уникальный длинный пароль. До появления D1 или Durable Objects приложение не ведёт постоянный централизованный счётчик неудачных входов.

## Генерация заданий

Задания генерируются моделью `dots-studio/dots-3-note-preview:free`. Модель можно изменить через `OPENROUTER_MODEL` в `wrangler.jsonc`.

Ключ OpenRouter доступен только Worker. Неавторизованный пользователь не может вызвать `/api/task`. Для временных ошибок выполняется до трёх попыток; ответы с ошибками содержат безопасный `requestId`.

## Проверка

Синтаксическая проверка:

```powershell
npm run check
```

Автоматические тесты:

```powershell
npm test
```

## Следующие этапы

После проверки production-размещения можно последовательно добавить:

1. Better Auth: регистрация, вход и пользовательские сессии в D1.
2. Личный кабинет, создание комнат и присоединение по коду.
3. Серверные задания, таймер и история выступлений.
4. Durable Objects и WebSocket для синхронизации комнаты в реальном времени.
5. Викторины в формате Kahoot.
