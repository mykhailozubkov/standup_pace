# Standup Helper

Веб-приложение для управления списком участников, временем выступлений и командными заданиями. Приложение подготовлено для Cloudflare Workers и использует один Worker для статических файлов и серверного API.

## Архитектура

- `public/` — HTML, CSS и клиентский JavaScript.
- `src/worker.ts` — типизированная Hono-маршрутизация, авторизация и Worker API.
- `src/auth.ts` — Better Auth, регистрация по email/password и D1-сессии на 24 часа.
- `src/openrouter.ts` — генерация заданий через OpenRouter.
- `src/errors.ts` — безопасная классификация ошибок.
- `src/env.ts` — типы Cloudflare bindings и переменных окружения.
- `migrations/` — версионируемая схема Cloudflare D1.
- `wrangler.jsonc` — конфигурация Cloudflare Worker `standup-helper`.

D1 подключена как binding `DB`. Миграции создают аккаунты и сессии Better Auth, профили приложения, комнаты и членство с ролями `owner`, `admin` и `member`. Комнаты пока не доступны в интерфейсе, поэтому участники, история, таймер и циклы жеребьёвки временно продолжают храниться в `localStorage` браузера.

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
BETTER_AUTH_SECRET=случайная-строка-не-короче-32-символов
OPENROUTER_API_KEY=ваш-ключ-openrouter
```

Случайный `BETTER_AUTH_SECRET` можно сгенерировать командой:

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
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put OPENROUTER_API_KEY
```

После этого выполните:

```powershell
npm run db:migrate:remote
npm run deploy
```

Обычные настройки `OPENROUTER_MODEL` и `PUBLIC_APP_URL` находятся в `wrangler.jsonc`. Секретов в этом файле быть не должно.

## Авторизация

- любой пользователь может зарегистрироваться по имени, email и паролю;
- минимальная длина пароля — 12 символов;
- аккаунты и серверные сессии хранятся в D1;
- успешный вход создаёт `HttpOnly` cookie Better Auth;
- production-cookie передаётся только по HTTPS;
- срок сессии — 24 часа;
- выход удаляет cookie и отзывает запись сессии в D1;
- `/admin` и `/api/task` недоступны без действующей сессии;
- вход и регистрация ограничены по частоте запросов.

Подтверждение email и восстановление пароля пока не подключены, поскольку для них нужен транзакционный email-провайдер. До его подключения не используйте аккаунт как хранилище критически важных данных.

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

Сверить SQL-схему с текущей версией Better Auth:

```powershell
npm run auth:schema
```

## Следующие этапы

После проверки production-размещения можно последовательно добавить:

1. Личный кабинет, создание комнат и присоединение по коду.
2. Серверные задания, таймер и история выступлений.
3. Durable Objects и WebSocket для синхронизации комнаты в реальном времени.
4. Викторины в формате Kahoot.
