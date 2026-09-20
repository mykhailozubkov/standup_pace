import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveQuiz,
  createQuiz,
  getQuiz,
  listQuizzes,
  updateQuiz,
} from "../src/quizzes.ts";
import { createRoom, joinRoom, updateMemberRole } from "../src/rooms.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "quiz-owner", name: "Ada Owner", email: "ada@example.com" };
const admin = { id: "quiz-admin", name: "Grace Admin", email: "grace@example.com" };
const member = { id: "quiz-member", name: "Linus Member", email: "linus@example.com" };

function quizInput(title = "Cloudflare basics") {
  return {
    title,
    description: "A short engineering quiz",
    questions: [
      {
        prompt: "Which product provides a serverless SQL database?",
        timeLimitSeconds: 20,
        options: [
          { text: "D1", isCorrect: true },
          { text: "R2", isCorrect: false },
          { text: "Queues", isCorrect: false },
        ],
      },
      {
        prompt: "How many correct options are allowed in the MVP?",
        timeLimitSeconds: 30,
        options: [
          { text: "Exactly one", isCorrect: true },
          { text: "Any number", isCorrect: false },
        ],
      },
    ],
  };
}

async function roomFixture() {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, { name: "Engineering" });
  await joinRoom(env, admin, { joinCode: room.joinCode });
  await joinRoom(env, member, { joinCode: room.joinCode });
  await updateMemberRole(env, room.id, owner.id, admin.id, { role: "admin" });
  return { env, room };
}

test("creates, lists, reads and updates a complete quiz draft", async () => {
  const { env, room } = await roomFixture();
  const created = await createQuiz(env, room.id, owner.id, quizInput());

  assert.equal(created.title, "Cloudflare basics");
  assert.equal(created.questionCount, 2);
  assert.equal(created.questions.length, 2);
  assert.equal(created.questions[0].options.filter(({ isCorrect }) => isCorrect).length, 1);

  const summaries = await listQuizzes(env, room.id, member.id);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].questionCount, 2);
  assert.equal("questions" in summaries[0], false);

  const read = await getQuiz(env, room.id, created.id, admin.id);
  assert.equal(read.questions[1].timeLimitSeconds, 30);

  const updated = await updateQuiz(env, room.id, created.id, admin.id, quizInput("Updated quiz"));
  assert.equal(updated.title, "Updated quiz");
  assert.equal(updated.updatedBy.id, admin.id);
  assert.notEqual(updated.questions[0].id, created.questions[0].id);
});

test("restricts quiz authoring and correct-answer details to room managers", async () => {
  const { env, room } = await roomFixture();
  const created = await createQuiz(env, room.id, owner.id, quizInput());

  await assert.rejects(
    () => createQuiz(env, room.id, member.id, quizInput("Forbidden")),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => getQuiz(env, room.id, created.id, member.id),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => updateQuiz(env, room.id, created.id, member.id, quizInput("Forbidden")),
    /ROOM_FORBIDDEN/,
  );
});

test("validates questions, options, correct answers and time limits", async () => {
  const { env, room } = await roomFixture();
  await assert.rejects(
    () => createQuiz(env, room.id, owner.id, { ...quizInput(), questions: [] }),
    /INVALID_QUIZ_QUESTIONS/,
  );

  const missingCorrect = quizInput();
  missingCorrect.questions[0].options.forEach((option) => { option.isCorrect = false; });
  await assert.rejects(
    () => createQuiz(env, room.id, owner.id, missingCorrect),
    /INVALID_QUIZ_CORRECT_OPTION/,
  );

  const duplicate = quizInput();
  duplicate.questions[0].options[1].text = " d1 ";
  await assert.rejects(
    () => createQuiz(env, room.id, owner.id, duplicate),
    /DUPLICATE_QUIZ_OPTION/,
  );

  const invalidLimit = quizInput();
  invalidLimit.questions[0].timeLimitSeconds = 2;
  await assert.rejects(
    () => createQuiz(env, room.id, owner.id, invalidLimit),
    /INVALID_QUIZ_TIME_LIMIT/,
  );
});

test("archives quiz drafts without exposing them in the room list", async () => {
  const { env, room } = await roomFixture();
  const created = await createQuiz(env, room.id, admin.id, quizInput());

  assert.deepEqual(await archiveQuiz(env, room.id, created.id, admin.id), {
    roomId: room.id,
    quizId: created.id,
    archived: true,
  });
  assert.deepEqual(await listQuizzes(env, room.id, owner.id), []);
  await assert.rejects(
    () => getQuiz(env, room.id, created.id, owner.id),
    /QUIZ_NOT_FOUND/,
  );
});
