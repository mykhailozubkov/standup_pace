import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceQuizGameQuestion,
  cancelQuizGame,
  closeQuizGameQuestion,
  createQuizGame,
  getQuizGame,
  joinQuizGame,
  leaveQuizGame,
  listQuizGames,
  startQuizGame,
  submitQuizGameAnswer,
} from "../src/quiz-games.ts";
import { createQuiz, updateQuiz } from "../src/quizzes.ts";
import { createRoom, joinRoom, updateMemberRole } from "../src/rooms.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "game-owner", name: "Ada Owner", email: "ada@example.com" };
const admin = { id: "game-admin", name: "Grace Admin", email: "grace@example.com" };
const member = { id: "game-member", name: "Linus Member", email: "linus@example.com" };

function quizInput(title = "Engineering warm-up", prompt = "Which status means Not Found?") {
  return {
    title,
    description: "A quick team quiz",
    questions: [
      {
        prompt,
        timeLimitSeconds: 20,
        options: [
          { text: "404", isCorrect: true },
          { text: "500", isCorrect: false },
          { text: "204", isCorrect: false },
        ],
      },
      {
        prompt: "Which command creates a commit?",
        timeLimitSeconds: 30,
        options: [
          { text: "git add", isCorrect: false },
          { text: "git commit", isCorrect: true },
        ],
      },
    ],
  };
}

async function gameFixture() {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, { name: "Engineering" });
  await joinRoom(env, admin, { joinCode: room.joinCode });
  await joinRoom(env, member, { joinCode: room.joinCode });
  await updateMemberRole(env, room.id, owner.id, admin.id, { role: "admin" });
  const quiz = await createQuiz(env, room.id, owner.id, quizInput());
  return { env, room, quiz };
}

test("creates an immutable game snapshot and exposes a safe lobby", async () => {
  const { env, room, quiz } = await gameFixture();
  const created = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });

  assert.equal(created.status, "waiting");
  assert.equal(created.questionCount, 2);
  assert.equal(created.participantCount, 0);
  assert.equal(created.currentQuestion, null);
  assert.equal(created.canManage, true);

  await updateQuiz(
    env,
    room.id,
    quiz.id,
    owner.id,
    quizInput("Changed template", "This must not replace the live snapshot"),
  );
  await joinQuizGame(env, room.id, created.id, member.id);
  const started = await startQuizGame(env, room.id, created.id, owner.id);

  assert.equal(started.title, "Engineering warm-up");
  assert.equal(started.currentQuestion.prompt, "Which status means Not Found?");
  assert.equal(started.currentQuestion.timeLimitSeconds, 20);
  assert.equal(started.currentQuestion.options.length, 3);
  assert.equal("isCorrect" in started.currentQuestion.options[0], false);
  assert.equal(typeof started.questionStartedAt, "number");

  const participantView = await getQuizGame(env, room.id, created.id, member.id);
  assert.equal(participantView.currentQuestion.id, started.currentQuestion.id);
  assert.equal(participantView.questionStartedAt, started.questionStartedAt);
  assert.equal(participantView.participants[0].isCurrentUser, true);
});

test("lets room members join and leave only while the lobby is waiting", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, admin.id, { quizId: quiz.id });

  const joined = await joinQuizGame(env, room.id, game.id, member.id);
  assert.equal(joined.isJoined, true);
  assert.equal(joined.participantCount, 1);

  const left = await leaveQuizGame(env, room.id, game.id, member.id);
  assert.equal(left.isJoined, false);
  assert.equal(left.participantCount, 0);
  await assert.rejects(
    () => leaveQuizGame(env, room.id, game.id, member.id),
    /QUIZ_GAME_NOT_JOINED/,
  );

  await joinQuizGame(env, room.id, game.id, member.id);
  await startQuizGame(env, room.id, game.id, admin.id);
  await assert.rejects(
    () => joinQuizGame(env, room.id, game.id, owner.id),
    /QUIZ_GAME_NOT_JOINABLE/,
  );
  await assert.rejects(
    () => leaveQuizGame(env, room.id, game.id, member.id),
    /QUIZ_GAME_ALREADY_STARTED/,
  );
});

test("restricts game controls and keeps one open game per room", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });

  await assert.rejects(
    () => createQuizGame(env, room.id, member.id, { quizId: quiz.id }),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => createQuizGame(env, room.id, admin.id, { quizId: quiz.id }),
    /QUIZ_GAME_ALREADY_OPEN/,
  );
  await assert.rejects(
    () => startQuizGame(env, room.id, game.id, owner.id),
    /QUIZ_GAME_EMPTY_LOBBY/,
  );
  await joinQuizGame(env, room.id, game.id, member.id);
  await assert.rejects(
    () => startQuizGame(env, room.id, game.id, member.id),
    /ROOM_FORBIDDEN/,
  );

  const cancelled = await cancelQuizGame(env, room.id, game.id, admin.id);
  assert.equal(cancelled.status, "cancelled");
  const replacement = await createQuizGame(env, room.id, admin.id, { quizId: quiz.id });
  assert.equal(replacement.status, "waiting");

  const listed = await listQuizGames(env, room.id, member.id);
  assert.equal(listed.currentGame.id, replacement.id);
  assert.deepEqual(listed.games.map(({ status }) => status), ["waiting", "cancelled"]);
});

test("accepts one timed answer from each joined player without revealing correctness", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });
  await joinQuizGame(env, room.id, game.id, member.id);
  const started = await startQuizGame(env, room.id, game.id, owner.id);
  const selectedOption = started.currentQuestion.options[0];

  const answered = await submitQuizGameAnswer(
    env,
    room.id,
    game.id,
    member.id,
    { optionId: selectedOption.id },
  );
  assert.equal(answered.myAnswer.selectedOptionId, selectedOption.id);
  assert.equal(typeof answered.myAnswer.responseTimeMs, "number");
  assert.equal(typeof answered.serverNow, "number");
  assert.equal("isCorrect" in answered.myAnswer, false);
  assert.equal("pointsAwarded" in answered.myAnswer, false);

  const stored = env.DB.query(`
    SELECT is_correct, points_awarded
    FROM quiz_game_answers
    WHERE game_id = ? AND participant_user_id = ?
  `, game.id, member.id)[0];
  assert.equal(stored.is_correct, 1);
  assert.equal(stored.points_awarded, 0);

  await assert.rejects(
    () => submitQuizGameAnswer(
      env,
      room.id,
      game.id,
      member.id,
      { optionId: started.currentQuestion.options[1].id },
    ),
    /QUIZ_ANSWER_ALREADY_SUBMITTED/,
  );
});

test("rejects answers from spectators, unknown options, and expired questions", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });
  await joinQuizGame(env, room.id, game.id, member.id);
  const started = await startQuizGame(env, room.id, game.id, owner.id);

  await assert.rejects(
    () => submitQuizGameAnswer(
      env,
      room.id,
      game.id,
      owner.id,
      { optionId: started.currentQuestion.options[0].id },
    ),
    /QUIZ_GAME_NOT_JOINED/,
  );
  await assert.rejects(
    () => submitQuizGameAnswer(
      env,
      room.id,
      game.id,
      member.id,
      { optionId: crypto.randomUUID() },
    ),
    /QUIZ_OPTION_NOT_FOUND/,
  );

  await env.DB.prepare(`
    UPDATE quiz_games
    SET question_started_at = question_started_at - 30000
    WHERE id = ?
  `).bind(game.id).all();
  await assert.rejects(
    () => submitQuizGameAnswer(
      env,
      room.id,
      game.id,
      member.id,
      { optionId: started.currentQuestion.options[0].id },
    ),
    /QUIZ_ANSWER_TIME_EXPIRED/,
  );
});

test("reveals the correct answer, awards speed points, and advances the game", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });
  await joinQuizGame(env, room.id, game.id, member.id);
  await joinQuizGame(env, room.id, game.id, admin.id);
  const started = await startQuizGame(env, room.id, game.id, owner.id);

  await submitQuizGameAnswer(env, room.id, game.id, member.id, {
    optionId: started.currentQuestion.options[0].id,
  });
  await submitQuizGameAnswer(env, room.id, game.id, admin.id, {
    optionId: started.currentQuestion.options[1].id,
  });
  await assert.rejects(
    () => closeQuizGameQuestion(env, room.id, game.id, member.id),
    /ROOM_FORBIDDEN/,
  );

  const revealed = await closeQuizGameQuestion(env, room.id, game.id, owner.id);
  assert.equal(revealed.questionPhase, "reveal");
  assert.equal(revealed.currentQuestion.options[0].isCorrect, true);
  assert.equal(revealed.currentQuestion.options[0].answerCount, 1);
  assert.equal(revealed.currentQuestion.options[1].answerCount, 1);
  const memberResult = await getQuizGame(env, room.id, game.id, member.id);
  assert.equal(memberResult.myAnswer.isCorrect, true);
  assert.ok(memberResult.myAnswer.pointsAwarded >= 500);
  assert.ok(memberResult.myAnswer.pointsAwarded <= 1000);
  assert.equal(
    memberResult.participants.find(({ id }) => id === member.id).score,
    memberResult.myAnswer.pointsAwarded,
  );
  await assert.rejects(
    () => submitQuizGameAnswer(env, room.id, game.id, member.id, {
      optionId: started.currentQuestion.options[0].id,
    }),
    /QUIZ_QUESTION_CLOSED/,
  );

  const next = await advanceQuizGameQuestion(env, room.id, game.id, admin.id);
  assert.equal(next.status, "active");
  assert.equal(next.questionPhase, "question");
  assert.equal(next.currentQuestion.position, 2);
  assert.equal("isCorrect" in next.currentQuestion.options[0], false);
});

test("lets the timer reveal a question and finishes after the last reveal", async () => {
  const { env, room, quiz } = await gameFixture();
  const game = await createQuizGame(env, room.id, owner.id, { quizId: quiz.id });
  await joinQuizGame(env, room.id, game.id, member.id);
  await joinQuizGame(env, room.id, game.id, admin.id);
  await startQuizGame(env, room.id, game.id, owner.id);

  await env.DB.prepare(`
    UPDATE quiz_games
    SET question_started_at = question_started_at - 30000
    WHERE id = ?
  `).bind(game.id).all();
  const firstReveal = await closeQuizGameQuestion(env, room.id, game.id, member.id);
  assert.equal(firstReveal.questionPhase, "reveal");
  await advanceQuizGameQuestion(env, room.id, game.id, owner.id);

  const second = await getQuizGame(env, room.id, game.id, member.id);
  await submitQuizGameAnswer(env, room.id, game.id, member.id, {
    optionId: second.currentQuestion.options[1].id,
  });
  await closeQuizGameQuestion(env, room.id, game.id, owner.id);
  const finished = await advanceQuizGameQuestion(env, room.id, game.id, owner.id);
  assert.equal(finished.status, "finished");
  assert.equal(finished.questionPhase, "complete");
  const winner = finished.participants.find(({ finalRank }) => finalRank === 1);
  const runnerUp = finished.participants.find(({ finalRank }) => finalRank === 2);
  assert.equal(winner.id, member.id);
  assert.ok(winner.score >= 500);
  assert.equal(runnerUp.id, admin.id);
  assert.equal(runnerUp.score, 0);
  const participantResults = await getQuizGame(env, room.id, game.id, admin.id);
  assert.deepEqual(
    participantResults.participants.map(({ id, score, finalRank }) => ({ id, score, finalRank })),
    finished.participants.map(({ id, score, finalRank }) => ({ id, score, finalRank })),
  );
  const listed = await listQuizGames(env, room.id, member.id);
  assert.equal(listed.currentGame, null);
});
