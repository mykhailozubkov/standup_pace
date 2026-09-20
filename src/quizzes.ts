import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

type RoomRole = "owner" | "admin" | "member";

interface RoomAccessRow {
  role: RoomRole;
}

interface QuizRow {
  id: string;
  room_id: string;
  title: string;
  description: string;
  status: "draft" | "archived";
  created_by_user_id: string;
  created_by_name: string;
  updated_by_user_id: string;
  updated_by_name: string;
  created_at: number;
  updated_at: number;
  question_count?: number;
}

interface QuestionRow {
  id: string;
  position: number;
  prompt: string;
  time_limit_seconds: number;
}

interface OptionRow {
  id: string;
  question_id: string;
  position: number;
  text: string;
  is_correct: number;
}

interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestionInput {
  prompt: string;
  timeLimitSeconds: number;
  options: QuizOptionInput[];
}

interface QuizInput {
  title: string;
  description: string;
  questions: QuizQuestionInput[];
}

function validateId(value: string, code: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new AppError(code, 404);
}

function normalizedText(
  value: unknown,
  minimum: number,
  maximum: number,
  code: string,
) {
  if (typeof value !== "string") throw new AppError(code, 400);
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (text.length < minimum || text.length > maximum) throw new AppError(code, 400);
  return text;
}

function normalizedDescription(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new AppError("INVALID_QUIZ_DESCRIPTION", 400);
  const description = value.normalize("NFKC").replace(/\r\n/g, "\n").trim();
  if (description.length > 1_000) throw new AppError("INVALID_QUIZ_DESCRIPTION", 400);
  return description;
}

function normalizedQuiz(body: Record<string, unknown>): QuizInput {
  const title = normalizedText(body.title, 1, 120, "INVALID_QUIZ_TITLE");
  const description = normalizedDescription(body.description);
  if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 50) {
    throw new AppError("INVALID_QUIZ_QUESTIONS", 400);
  }

  const questions = body.questions.map((rawQuestion) => {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      throw new AppError("INVALID_QUIZ_QUESTION", 400);
    }
    const question = rawQuestion as Record<string, unknown>;
    const prompt = normalizedText(question.prompt, 1, 300, "INVALID_QUIZ_QUESTION");
    const timeLimitSeconds = question.timeLimitSeconds === undefined
      ? 20
      : Number(question.timeLimitSeconds);
    if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 5 || timeLimitSeconds > 120) {
      throw new AppError("INVALID_QUIZ_TIME_LIMIT", 400);
    }
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
      throw new AppError("INVALID_QUIZ_OPTIONS", 400);
    }

    const options = question.options.map((rawOption) => {
      if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
        throw new AppError("INVALID_QUIZ_OPTION", 400);
      }
      const option = rawOption as Record<string, unknown>;
      if (typeof option.isCorrect !== "boolean") {
        throw new AppError("INVALID_QUIZ_CORRECT_OPTION", 400);
      }
      return {
        text: normalizedText(option.text, 1, 160, "INVALID_QUIZ_OPTION"),
        isCorrect: option.isCorrect,
      };
    });

    if (options.filter(({ isCorrect }) => isCorrect).length !== 1) {
      throw new AppError("INVALID_QUIZ_CORRECT_OPTION", 400);
    }
    const uniqueOptions = new Set(options.map(({ text }) => text.toLocaleLowerCase()));
    if (uniqueOptions.size !== options.length) {
      throw new AppError("DUPLICATE_QUIZ_OPTION", 400);
    }

    return { prompt, timeLimitSeconds, options };
  });

  return { title, description, questions };
}

async function roomAccess(env: Env, roomId: string, userId: string) {
  validateId(roomId, "ROOM_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT room_members.role
    FROM rooms
    JOIN room_members ON room_members.room_id = rooms.id
    WHERE rooms.id = ?
      AND rooms.status = 'active'
      AND room_members.user_id = ?
      AND room_members.removed_at IS NULL
    LIMIT 1
  `).bind(roomId, userId).all<RoomAccessRow>();
  const access = result.results[0];
  if (!access) throw new AppError("ROOM_NOT_FOUND", 404);
  return access;
}

function requireManager(access: RoomAccessRow) {
  if (access.role !== "owner" && access.role !== "admin") {
    throw new AppError("ROOM_FORBIDDEN", 403);
  }
}

function quizSummary(quiz: QuizRow) {
  return {
    id: quiz.id,
    roomId: quiz.room_id,
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    questionCount: Number(quiz.question_count || 0),
    createdBy: { id: quiz.created_by_user_id, name: quiz.created_by_name },
    updatedBy: { id: quiz.updated_by_user_id, name: quiz.updated_by_name },
    createdAt: Number(quiz.created_at),
    updatedAt: Number(quiz.updated_at),
  };
}

async function quizRow(env: Env, roomId: string, quizId: string) {
  validateId(quizId, "QUIZ_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT
      quizzes.*,
      creator.display_name AS created_by_name,
      updater.display_name AS updated_by_name,
      (
        SELECT COUNT(*) FROM quiz_questions
        WHERE quiz_questions.quiz_id = quizzes.id
      ) AS question_count
    FROM quizzes
    JOIN user_profiles AS creator ON creator.user_id = quizzes.created_by_user_id
    JOIN user_profiles AS updater ON updater.user_id = quizzes.updated_by_user_id
    WHERE quizzes.id = ? AND quizzes.room_id = ? AND quizzes.status = 'draft'
    LIMIT 1
  `).bind(quizId, roomId).all<QuizRow>();
  const quiz = result.results[0];
  if (!quiz) throw new AppError("QUIZ_NOT_FOUND", 404);
  return quiz;
}

async function quizDetail(env: Env, roomId: string, quizId: string) {
  const quiz = await quizRow(env, roomId, quizId);
  const [questions, options] = await Promise.all([
    env.DB.prepare(`
      SELECT id, position, prompt, time_limit_seconds
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY position
    `).bind(quizId).all<QuestionRow>(),
    env.DB.prepare(`
      SELECT
        quiz_options.id,
        quiz_options.question_id,
        quiz_options.position,
        quiz_options.text,
        quiz_options.is_correct
      FROM quiz_options
      JOIN quiz_questions ON quiz_questions.id = quiz_options.question_id
      WHERE quiz_questions.quiz_id = ?
      ORDER BY quiz_questions.position, quiz_options.position
    `).bind(quizId).all<OptionRow>(),
  ]);

  const optionsByQuestion = new Map<string, OptionRow[]>();
  for (const option of options.results) {
    const values = optionsByQuestion.get(option.question_id) || [];
    values.push(option);
    optionsByQuestion.set(option.question_id, values);
  }

  return {
    ...quizSummary(quiz),
    questions: questions.results.map((question) => ({
      id: question.id,
      position: Number(question.position),
      prompt: question.prompt,
      timeLimitSeconds: Number(question.time_limit_seconds),
      options: (optionsByQuestion.get(question.id) || []).map((option) => ({
        id: option.id,
        position: Number(option.position),
        text: option.text,
        isCorrect: Boolean(option.is_correct),
      })),
    })),
  };
}

function quizStatements(
  env: Env,
  quizId: string,
  input: QuizInput,
) {
  return input.questions.flatMap((question, questionIndex) => {
    const questionId = crypto.randomUUID();
    return [
      env.DB.prepare(`
        INSERT INTO quiz_questions (
          id, quiz_id, position, prompt, time_limit_seconds
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        questionId,
        quizId,
        questionIndex + 1,
        question.prompt,
        question.timeLimitSeconds,
      ),
      ...question.options.map((option, optionIndex) => env.DB.prepare(`
        INSERT INTO quiz_options (
          id, question_id, position, text, is_correct
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        questionId,
        optionIndex + 1,
        option.text,
        option.isCorrect ? 1 : 0,
      )),
    ];
  });
}

export async function listQuizzes(env: Env, roomId: string, userId: string) {
  await roomAccess(env, roomId, userId);
  const result = await env.DB.prepare(`
    SELECT
      quizzes.*,
      creator.display_name AS created_by_name,
      updater.display_name AS updated_by_name,
      COUNT(quiz_questions.id) AS question_count
    FROM quizzes
    JOIN user_profiles AS creator ON creator.user_id = quizzes.created_by_user_id
    JOIN user_profiles AS updater ON updater.user_id = quizzes.updated_by_user_id
    LEFT JOIN quiz_questions ON quiz_questions.quiz_id = quizzes.id
    WHERE quizzes.room_id = ? AND quizzes.status = 'draft'
    GROUP BY quizzes.id
    ORDER BY quizzes.updated_at DESC, quizzes.title COLLATE NOCASE
  `).bind(roomId).all<QuizRow>();
  return result.results.map(quizSummary);
}

export async function getQuiz(env: Env, roomId: string, quizId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  return quizDetail(env, roomId, quizId);
}

export async function createQuiz(
  env: Env,
  roomId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  const input = normalizedQuiz(body);
  const quizId = crypto.randomUUID();

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO quizzes (
          id, room_id, title, description, created_by_user_id, updated_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(quizId, roomId, input.title, input.description, userId, userId),
      ...quizStatements(env, quizId, input),
    ]);
  } catch (error) {
    throw new AppError("QUIZ_CREATE_FAILED", 500, { cause: error });
  }

  return quizDetail(env, roomId, quizId);
}

export async function updateQuiz(
  env: Env,
  roomId: string,
  quizId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  await quizRow(env, roomId, quizId);
  const input = normalizedQuiz(body);

  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").bind(quizId),
      env.DB.prepare(`
        UPDATE quizzes
        SET title = ?, description = ?, updated_by_user_id = ?, updated_at = unixepoch()
        WHERE id = ? AND room_id = ? AND status = 'draft'
      `).bind(input.title, input.description, userId, quizId, roomId),
      ...quizStatements(env, quizId, input),
    ]);
  } catch (error) {
    throw new AppError("QUIZ_UPDATE_FAILED", 500, { cause: error });
  }

  return quizDetail(env, roomId, quizId);
}

export async function archiveQuiz(
  env: Env,
  roomId: string,
  quizId: string,
  userId: string,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  await quizRow(env, roomId, quizId);

  await env.DB.prepare(`
    UPDATE quizzes
    SET
      status = 'archived',
      updated_by_user_id = ?,
      updated_at = unixepoch(),
      archived_at = unixepoch()
    WHERE id = ? AND room_id = ? AND status = 'draft'
  `).bind(userId, quizId, roomId).all();

  return { roomId, quizId, archived: true };
}
