import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

type RoomRole = "owner" | "admin" | "member";
type GameStatus = "waiting" | "active" | "finished" | "cancelled";

interface RoomAccessRow {
  role: RoomRole;
}

interface TemplateRow {
  id: string;
  title: string;
}

interface TemplateQuestionRow {
  id: string;
  position: number;
  prompt: string;
  time_limit_seconds: number;
}

interface TemplateOptionRow {
  id: string;
  question_id: string;
  position: number;
  text: string;
  is_correct: number;
}

interface GameRow {
  id: string;
  room_id: string;
  quiz_id: string | null;
  title: string;
  status: GameStatus;
  host_user_id: string;
  host_name: string;
  current_question_position: number;
  question_started_at: number | null;
  started_at: number | null;
  finished_at: number | null;
  cancelled_at: number | null;
  created_at: number;
  updated_at: number;
  question_count: number;
  participant_count: number;
  current_user_joined: number;
}

interface ParticipantRow {
  id: string;
  name: string;
  score: number;
  final_rank: number | null;
  joined_at: number;
}

interface GameQuestionRow {
  id: string;
  position: number;
  prompt: string;
  time_limit_seconds: number;
}

interface GameOptionRow {
  id: string;
  position: number;
  text: string;
}

interface AnswerRow {
  selected_option_id: string;
  response_time_ms: number;
  answered_at: number;
}

interface AnswerOptionRow {
  id: string;
  is_correct: number;
}

function validateId(value: string, code: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new AppError(code, 404);
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

async function templateSnapshot(env: Env, roomId: string, quizId: string) {
  validateId(quizId, "QUIZ_NOT_FOUND");
  const [templateResult, questionResult, optionResult] = await Promise.all([
    env.DB.prepare(`
      SELECT id, title
      FROM quizzes
      WHERE id = ? AND room_id = ? AND status = 'draft'
      LIMIT 1
    `).bind(quizId, roomId).all<TemplateRow>(),
    env.DB.prepare(`
      SELECT id, position, prompt, time_limit_seconds
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY position
    `).bind(quizId).all<TemplateQuestionRow>(),
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
    `).bind(quizId).all<TemplateOptionRow>(),
  ]);

  const template = templateResult.results[0];
  if (!template) throw new AppError("QUIZ_NOT_FOUND", 404);
  if (!questionResult.results.length) throw new AppError("QUIZ_EMPTY", 409);

  const optionsByQuestion = new Map<string, TemplateOptionRow[]>();
  for (const option of optionResult.results) {
    const values = optionsByQuestion.get(option.question_id) || [];
    values.push(option);
    optionsByQuestion.set(option.question_id, values);
  }

  const questions = questionResult.results.map((question) => {
    const options = optionsByQuestion.get(question.id) || [];
    if (options.length < 2 || options.filter(({ is_correct }) => is_correct === 1).length !== 1) {
      throw new AppError("QUIZ_INVALID", 409);
    }
    return { ...question, options };
  });
  return { template, questions };
}

async function gameRow(env: Env, roomId: string, gameId: string, userId: string) {
  validateId(gameId, "QUIZ_GAME_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT
      quiz_games.*,
      host.display_name AS host_name,
      (SELECT COUNT(*) FROM quiz_game_questions WHERE game_id = quiz_games.id) AS question_count,
      (
        SELECT COUNT(*) FROM quiz_game_participants
        WHERE game_id = quiz_games.id AND left_at IS NULL
      ) AS participant_count,
      EXISTS(
        SELECT 1 FROM quiz_game_participants
        WHERE game_id = quiz_games.id AND user_id = ? AND left_at IS NULL
      ) AS current_user_joined
    FROM quiz_games
    JOIN user_profiles AS host ON host.user_id = quiz_games.host_user_id
    WHERE quiz_games.id = ? AND quiz_games.room_id = ?
    LIMIT 1
  `).bind(userId, gameId, roomId).all<GameRow>();
  const game = result.results[0];
  if (!game) throw new AppError("QUIZ_GAME_NOT_FOUND", 404);
  return game;
}

function gameSummary(game: GameRow, role: RoomRole) {
  return {
    id: game.id,
    roomId: game.room_id,
    quizId: game.quiz_id,
    title: game.title,
    status: game.status,
    host: { id: game.host_user_id, name: game.host_name },
    questionCount: Number(game.question_count),
    participantCount: Number(game.participant_count),
    currentQuestionPosition: Number(game.current_question_position),
    questionStartedAt: game.question_started_at === null ? null : Number(game.question_started_at),
    startedAt: game.started_at === null ? null : Number(game.started_at),
    finishedAt: game.finished_at === null ? null : Number(game.finished_at),
    cancelledAt: game.cancelled_at === null ? null : Number(game.cancelled_at),
    createdAt: Number(game.created_at),
    updatedAt: Number(game.updated_at),
    isJoined: Boolean(game.current_user_joined),
    canManage: role === "owner" || role === "admin",
  };
}

async function gameDetail(
  env: Env,
  roomId: string,
  gameId: string,
  userId: string,
  role: RoomRole,
) {
  const game = await gameRow(env, roomId, gameId, userId);
  const participants = await env.DB.prepare(`
    SELECT
      user_profiles.user_id AS id,
      user_profiles.display_name AS name,
      quiz_game_participants.score,
      quiz_game_participants.final_rank,
      quiz_game_participants.joined_at
    FROM quiz_game_participants
    JOIN user_profiles ON user_profiles.user_id = quiz_game_participants.user_id
    WHERE quiz_game_participants.game_id = ?
      AND quiz_game_participants.left_at IS NULL
    ORDER BY quiz_game_participants.joined_at, user_profiles.display_name COLLATE NOCASE
  `).bind(gameId).all<ParticipantRow>();

  let currentQuestion = null;
  let myAnswer = null;
  if (game.status === "active" || game.status === "finished") {
    const questionResult = await env.DB.prepare(`
      SELECT id, position, prompt, time_limit_seconds
      FROM quiz_game_questions
      WHERE game_id = ? AND position = ?
      LIMIT 1
    `).bind(gameId, game.current_question_position).all<GameQuestionRow>();
    const question = questionResult.results[0];
    if (question) {
      const options = await env.DB.prepare(`
        SELECT id, position, text
        FROM quiz_game_options
        WHERE game_question_id = ?
        ORDER BY position
      `).bind(question.id).all<GameOptionRow>();
      currentQuestion = {
        id: question.id,
        position: Number(question.position),
        prompt: question.prompt,
        timeLimitSeconds: Number(question.time_limit_seconds),
        options: options.results.map((option) => ({
          id: option.id,
          position: Number(option.position),
          text: option.text,
        })),
      };

      const answerResult = await env.DB.prepare(`
        SELECT selected_option_id, response_time_ms, answered_at
        FROM quiz_game_answers
        WHERE game_id = ? AND game_question_id = ? AND participant_user_id = ?
        LIMIT 1
      `).bind(gameId, question.id, userId).all<AnswerRow>();
      const answer = answerResult.results[0];
      if (answer) {
        myAnswer = {
          selectedOptionId: answer.selected_option_id,
          responseTimeMs: Number(answer.response_time_ms),
          answeredAt: Number(answer.answered_at),
        };
      }
    }
  }

  return {
    ...gameSummary(game, role),
    participants: participants.results.map((participant) => ({
      id: participant.id,
      name: participant.name,
      score: Number(participant.score),
      finalRank: participant.final_rank === null ? null : Number(participant.final_rank),
      joinedAt: Number(participant.joined_at),
      isCurrentUser: participant.id === userId,
    })),
    currentQuestion,
    myAnswer,
    serverNow: Date.now(),
  };
}

export async function listQuizGames(env: Env, roomId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  const result = await env.DB.prepare(`
    SELECT
      quiz_games.*,
      host.display_name AS host_name,
      (SELECT COUNT(*) FROM quiz_game_questions WHERE game_id = quiz_games.id) AS question_count,
      (
        SELECT COUNT(*) FROM quiz_game_participants
        WHERE game_id = quiz_games.id AND left_at IS NULL
      ) AS participant_count,
      EXISTS(
        SELECT 1 FROM quiz_game_participants
        WHERE game_id = quiz_games.id AND user_id = ? AND left_at IS NULL
      ) AS current_user_joined
    FROM quiz_games
    JOIN user_profiles AS host ON host.user_id = quiz_games.host_user_id
    WHERE quiz_games.room_id = ?
    ORDER BY
      CASE quiz_games.status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
      quiz_games.created_at DESC
    LIMIT 20
  `).bind(userId, roomId).all<GameRow>();

  const games = result.results.map((game) => gameSummary(game, access.role));
  return {
    currentGame: games.find(({ status }) => status === "waiting" || status === "active") || null,
    games,
  };
}

export async function getQuizGame(env: Env, roomId: string, gameId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function createQuizGame(
  env: Env,
  roomId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  if (typeof body.quizId !== "string") throw new AppError("QUIZ_NOT_FOUND", 404);
  const { template, questions } = await templateSnapshot(env, roomId, body.quizId);
  const gameId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO quiz_games (id, room_id, quiz_id, title, host_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(gameId, roomId, template.id, template.title, userId),
  ];

  for (const question of questions) {
    const gameQuestionId = crypto.randomUUID();
    statements.push(env.DB.prepare(`
      INSERT INTO quiz_game_questions (
        id, game_id, source_question_id, position, prompt, time_limit_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      gameQuestionId,
      gameId,
      question.id,
      question.position,
      question.prompt,
      question.time_limit_seconds,
    ));
    for (const option of question.options) {
      statements.push(env.DB.prepare(`
        INSERT INTO quiz_game_options (
          id, game_question_id, source_option_id, position, text, is_correct
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        gameQuestionId,
        option.id,
        option.position,
        option.text,
        option.is_correct,
      ));
    }
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/quiz_games_one_open_per_room|unique.*quiz_games\.room_id/i.test(message)) {
      throw new AppError("QUIZ_GAME_ALREADY_OPEN", 409);
    }
    throw new AppError("QUIZ_GAME_CREATE_FAILED", 500, { cause: error });
  }

  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function joinQuizGame(env: Env, roomId: string, gameId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  const game = await gameRow(env, roomId, gameId, userId);
  if (game.status !== "waiting") throw new AppError("QUIZ_GAME_NOT_JOINABLE", 409);

  await env.DB.prepare(`
    INSERT INTO quiz_game_participants (game_id, user_id)
    VALUES (?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET
      score = 0,
      final_rank = NULL,
      joined_at = CASE
        WHEN quiz_game_participants.left_at IS NULL THEN quiz_game_participants.joined_at
        ELSE unixepoch()
      END,
      left_at = NULL
  `).bind(gameId, userId).all();

  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function leaveQuizGame(env: Env, roomId: string, gameId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  const game = await gameRow(env, roomId, gameId, userId);
  if (game.status !== "waiting") throw new AppError("QUIZ_GAME_ALREADY_STARTED", 409);

  const result = await env.DB.prepare(`
    UPDATE quiz_game_participants
    SET left_at = unixepoch()
    WHERE game_id = ? AND user_id = ? AND left_at IS NULL
  `).bind(gameId, userId).all();
  if (!result.meta.changes) throw new AppError("QUIZ_GAME_NOT_JOINED", 409);

  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function startQuizGame(env: Env, roomId: string, gameId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  const game = await gameRow(env, roomId, gameId, userId);
  if (game.status !== "waiting") throw new AppError("QUIZ_GAME_ALREADY_STARTED", 409);
  if (Number(game.participant_count) < 1) throw new AppError("QUIZ_GAME_EMPTY_LOBBY", 409);

  const result = await env.DB.prepare(`
    UPDATE quiz_games
    SET
      status = 'active',
      current_question_position = 1,
      question_started_at = CAST(unixepoch('subsec') * 1000 AS INTEGER),
      started_at = unixepoch(),
      updated_at = unixepoch()
    WHERE id = ? AND room_id = ? AND status = 'waiting'
      AND EXISTS (
        SELECT 1 FROM quiz_game_participants
        WHERE game_id = quiz_games.id AND left_at IS NULL
      )
  `).bind(gameId, roomId).all();
  if (!result.meta.changes) {
    const current = await gameRow(env, roomId, gameId, userId);
    if (current.status === "waiting") throw new AppError("QUIZ_GAME_EMPTY_LOBBY", 409);
    throw new AppError("QUIZ_GAME_ALREADY_STARTED", 409);
  }

  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function submitQuizGameAnswer(
  env: Env,
  roomId: string,
  gameId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccess(env, roomId, userId);
  const game = await gameRow(env, roomId, gameId, userId);
  if (game.status !== "active") throw new AppError("QUIZ_GAME_NOT_ACTIVE", 409);
  if (!game.current_user_joined) throw new AppError("QUIZ_GAME_NOT_JOINED", 403);
  if (typeof body.optionId !== "string") throw new AppError("QUIZ_OPTION_NOT_FOUND", 404);
  validateId(body.optionId, "QUIZ_OPTION_NOT_FOUND");

  const questionResult = await env.DB.prepare(`
    SELECT id, position, prompt, time_limit_seconds
    FROM quiz_game_questions
    WHERE game_id = ? AND position = ?
    LIMIT 1
  `).bind(gameId, game.current_question_position).all<GameQuestionRow>();
  const question = questionResult.results[0];
  if (!question || game.question_started_at === null) {
    throw new AppError("QUIZ_GAME_STATE_INVALID", 409);
  }

  const optionResult = await env.DB.prepare(`
    SELECT id, is_correct
    FROM quiz_game_options
    WHERE id = ? AND game_question_id = ?
    LIMIT 1
  `).bind(body.optionId, question.id).all<AnswerOptionRow>();
  const option = optionResult.results[0];
  if (!option) throw new AppError("QUIZ_OPTION_NOT_FOUND", 404);

  const responseTimeMs = Math.max(0, Date.now() - Number(game.question_started_at));
  if (responseTimeMs > Number(question.time_limit_seconds) * 1_000) {
    throw new AppError("QUIZ_ANSWER_TIME_EXPIRED", 409);
  }

  try {
    await env.DB.prepare(`
      INSERT INTO quiz_game_answers (
        id,
        game_id,
        game_question_id,
        participant_user_id,
        selected_option_id,
        is_correct,
        response_time_ms,
        points_awarded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      crypto.randomUUID(),
      gameId,
      question.id,
      userId,
      option.id,
      option.is_correct,
      responseTimeMs,
    ).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed.*quiz_game_answers/i.test(message)) {
      throw new AppError("QUIZ_ANSWER_ALREADY_SUBMITTED", 409);
    }
    throw new AppError("QUIZ_ANSWER_SAVE_FAILED", 500, { cause: error });
  }

  return gameDetail(env, roomId, gameId, userId, access.role);
}

export async function cancelQuizGame(env: Env, roomId: string, gameId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access);
  await gameRow(env, roomId, gameId, userId);

  const result = await env.DB.prepare(`
    UPDATE quiz_games
    SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
    WHERE id = ? AND room_id = ? AND status IN ('waiting', 'active')
  `).bind(gameId, roomId).all();
  if (!result.meta.changes) throw new AppError("QUIZ_GAME_NOT_OPEN", 409);

  return gameDetail(env, roomId, gameId, userId, access.role);
}
