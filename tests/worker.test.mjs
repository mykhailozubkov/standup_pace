import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const baseURL = "https://standup-helper.example";

async function testEnv() {
  return {
    DB: await createTestD1(),
    BETTER_AUTH_SECRET: "a-test-better-auth-secret-that-is-longer-than-32-characters",
    PUBLIC_APP_URL: baseURL,
    ASSETS: {
      async fetch(request) {
        return new Response(`asset:${new URL(request.url).pathname}`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  };
}

function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("cf-connecting-ip", "203.0.113.10");
  return new Request(`${baseURL}${path}`, { ...options, headers });
}

async function signUp(env, user = {
  name: "Grace Hopper",
  email: "grace@example.com",
  password: "compiler pioneer 1952",
}) {
  const response = await worker.fetch(request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

function quizPayload(title = "Engineering quiz") {
  return {
    title,
    description: "Test your platform knowledge",
    questions: [{
      prompt: "Which service stores relational data?",
      timeLimitSeconds: 20,
      options: [
        { text: "D1", isCorrect: true },
        { text: "R2", isCorrect: false },
      ],
    }],
  };
}

test("serves the public account page and protects the workspace", async () => {
  const env = await testEnv();
  const login = await worker.fetch(request("/"), env);
  assert.equal(login.status, 200);
  assert.equal(await login.text(), "asset:/login.html");

  const admin = await worker.fetch(request("/admin"), env);
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get("location"), `${baseURL}/`);

  const dashboard = await worker.fetch(request("/dashboard"), env);
  assert.equal(dashboard.status, 302);

  const quizEditor = await worker.fetch(request(
    "/rooms/688285e9-dbea-4b57-bf5c-a283ccca9716/quizzes/new",
  ), env);
  assert.equal(quizEditor.status, 302);

  const quizGame = await worker.fetch(request(
    "/rooms/688285e9-dbea-4b57-bf5c-a283ccca9716/quiz-games/3f46f7af-9d88-4c0c-a242-22d44ac94dc5",
  ), env);
  assert.equal(quizGame.status, 302);

  const live = await worker.fetch(request(
    "/api/rooms/688285e9-dbea-4b57-bf5c-a283ccca9716/live",
  ), env);
  assert.equal(live.status, 401);
});

test("registers a user and exposes the protected workspace", async () => {
  const env = await testEnv();
  const cookie = await signUp(env);

  const root = await worker.fetch(request("/", { headers: { Cookie: cookie } }), env);
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), `${baseURL}/dashboard`);

  const admin = await worker.fetch(request("/admin", { headers: { Cookie: cookie } }), env);
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), "asset:/admin.html");

  const dashboard = await worker.fetch(request("/dashboard", { headers: { Cookie: cookie } }), env);
  assert.equal(dashboard.status, 200);
  assert.equal(await dashboard.text(), "asset:/dashboard.html");

  const quizEditor = await worker.fetch(request(
    "/rooms/688285e9-dbea-4b57-bf5c-a283ccca9716/quizzes/new",
    { headers: { Cookie: cookie } },
  ), env);
  assert.equal(quizEditor.status, 200);
  assert.equal(await quizEditor.text(), "asset:/quiz-editor.html");

  const quizGame = await worker.fetch(request(
    "/rooms/688285e9-dbea-4b57-bf5c-a283ccca9716/quiz-games/3f46f7af-9d88-4c0c-a242-22d44ac94dc5",
    { headers: { Cookie: cookie } },
  ), env);
  assert.equal(quizGame.status, 200);
  assert.equal(await quizGame.text(), "asset:/quiz-game.html");

  const rawQuizEditor = await worker.fetch(request(
    "/quiz-editor.html",
    { headers: { Cookie: cookie } },
  ), env);
  assert.equal(rawQuizEditor.status, 302);
  assert.equal(rawQuizEditor.headers.get("location"), `${baseURL}/dashboard`);

  const rawQuizGame = await worker.fetch(request(
    "/quiz-game.html",
    { headers: { Cookie: cookie } },
  ), env);
  assert.equal(rawQuizGame.status, 302);
  assert.equal(rawQuizGame.headers.get("location"), `${baseURL}/dashboard`);

  const session = await worker.fetch(request("/api/auth/get-session", {
    headers: { Cookie: cookie },
  }), env);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.email, "grace@example.com");
});

test("creates and joins rooms through authenticated APIs", async () => {
  const env = await testEnv();
  const ownerCookie = await signUp(env);
  const memberCookie = await signUp(env, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical engine 1843",
  });

  const createdResponse = await worker.fetch(request("/api/rooms", {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Product standup", defaultTalkLimitSeconds: 120 }),
  }), env);
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).room;

  const joinedResponse = await worker.fetch(request("/api/rooms/join", {
    method: "POST",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: created.joinCode }),
  }), env);
  assert.equal(joinedResponse.status, 200);
  assert.equal((await joinedResponse.json()).room.role, "member");

  const detailResponse = await worker.fetch(request(`/api/rooms/${created.id}`, {
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(detailResponse.status, 200);
  assert.equal((await detailResponse.json()).room.members.length, 2);
});

test("manages quiz drafts through authenticated room APIs", async () => {
  const env = await testEnv();
  const ownerCookie = await signUp(env);
  const memberCookie = await signUp(env, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical engine 1843",
  });
  const createdRoomResponse = await worker.fetch(request("/api/rooms", {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Quiz room" }),
  }), env);
  const room = (await createdRoomResponse.json()).room;
  await worker.fetch(request("/api/rooms/join", {
    method: "POST",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: room.joinCode }),
  }), env);

  const createResponse = await worker.fetch(request(`/api/rooms/${room.id}/quizzes`, {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify(quizPayload()),
  }), env);
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).quiz;
  assert.equal(created.questions[0].options[0].isCorrect, true);

  const listResponse = await worker.fetch(request(`/api/rooms/${room.id}/quizzes`, {
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(listResponse.status, 200);
  const summary = (await listResponse.json()).quizzes[0];
  assert.equal(summary.questionCount, 1);
  assert.equal("questions" in summary, false);

  const hiddenDetail = await worker.fetch(request(
    `/api/rooms/${room.id}/quizzes/${created.id}`,
    { headers: { Cookie: memberCookie } },
  ), env);
  assert.equal(hiddenDetail.status, 403);

  const updateResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quizzes/${created.id}`,
    {
      method: "PATCH",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify(quizPayload("Updated engineering quiz")),
    },
  ), env);
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).quiz.title, "Updated engineering quiz");

  const archiveResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quizzes/${created.id}`,
    { method: "DELETE", headers: { Cookie: ownerCookie } },
  ), env);
  assert.equal(archiveResponse.status, 200);
  assert.equal((await archiveResponse.json()).archived, true);
});

test("runs a quiz lobby through authenticated room APIs", async () => {
  const env = await testEnv();
  const ownerCookie = await signUp(env);
  const memberCookie = await signUp(env, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical engine 1843",
  });
  const roomResponse = await worker.fetch(request("/api/rooms", {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Quiz lobby" }),
  }), env);
  const room = (await roomResponse.json()).room;
  await worker.fetch(request("/api/rooms/join", {
    method: "POST",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: room.joinCode }),
  }), env);
  const quizResponse = await worker.fetch(request(`/api/rooms/${room.id}/quizzes`, {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify(quizPayload()),
  }), env);
  const quiz = (await quizResponse.json()).quiz;

  const createResponse = await worker.fetch(request(`/api/rooms/${room.id}/quiz-games`, {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ quizId: quiz.id }),
  }), env);
  assert.equal(createResponse.status, 201);
  const game = (await createResponse.json()).game;
  assert.equal(game.status, "waiting");

  const joinResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quiz-games/${game.id}/join`,
    { method: "POST", headers: { Cookie: memberCookie } },
  ), env);
  assert.equal(joinResponse.status, 200);
  assert.equal((await joinResponse.json()).game.participantCount, 1);

  const listResponse = await worker.fetch(request(`/api/rooms/${room.id}/quiz-games`, {
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).currentGame.isJoined, true);

  const startResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quiz-games/${game.id}/start`,
    { method: "POST", headers: { Cookie: ownerCookie } },
  ), env);
  assert.equal(startResponse.status, 200);
  const started = (await startResponse.json()).game;
  assert.equal(started.status, "active");
  assert.equal(started.currentQuestion.options.length, 2);
  assert.equal("isCorrect" in started.currentQuestion.options[0], false);

  const detailResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quiz-games/${game.id}`,
    { headers: { Cookie: memberCookie } },
  ), env);
  assert.equal(detailResponse.status, 200);
  assert.equal((await detailResponse.json()).game.questionStartedAt, started.questionStartedAt);

  const answerResponse = await worker.fetch(request(
    `/api/rooms/${room.id}/quiz-games/${game.id}/answer`,
    {
      method: "POST",
      headers: { Cookie: memberCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: started.currentQuestion.options[0].id }),
    },
  ), env);
  assert.equal(answerResponse.status, 201);
  const answered = (await answerResponse.json()).game;
  assert.equal(answered.myAnswer.selectedOptionId, started.currentQuestion.options[0].id);
  assert.equal("isCorrect" in answered.myAnswer, false);
});

test("manages room settings, roles, membership, and archiving through the API", async () => {
  const env = await testEnv();
  const ownerCookie = await signUp(env);
  const memberCookie = await signUp(env, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical engine 1843",
  });

  const createdResponse = await worker.fetch(request("/api/rooms", {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Product standup" }),
  }), env);
  const created = (await createdResponse.json()).room;
  await worker.fetch(request("/api/rooms/join", {
    method: "POST",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: created.joinCode }),
  }), env);

  const assignmentStateResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/assignments`,
    { headers: { Cookie: memberCookie } },
  ), env);
  assert.equal(assignmentStateResponse.status, 200);
  assert.equal((await assignmentStateResponse.json()).nextDraw.remaining, 2);

  const invalidDrawResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/assignments/draw`,
    {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "invalid" }),
    },
  ), env);
  assert.equal(invalidDrawResponse.status, 400);
  assert.equal((await invalidDrawResponse.json()).code, "INVALID_TASK_KIND");

  const detailResponse = await worker.fetch(request(`/api/rooms/${created.id}`, {
    headers: { Cookie: ownerCookie },
  }), env);
  const detail = (await detailResponse.json()).room;
  const memberId = detail.members.find(({ name }) => name === "Ada Lovelace").id;

  const roleResponse = await worker.fetch(request(`/api/rooms/${created.id}/members/${memberId}`, {
    method: "PATCH",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  }), env);
  assert.equal(roleResponse.status, 200);
  assert.equal(
    (await roleResponse.json()).room.members.find(({ id }) => id === memberId).role,
    "admin",
  );

  const settingsResponse = await worker.fetch(request(`/api/rooms/${created.id}`, {
    method: "PATCH",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Updated standup", defaultTalkLimitSeconds: 180 }),
  }), env);
  assert.equal(settingsResponse.status, 200);
  assert.equal((await settingsResponse.json()).room.name, "Updated standup");

  const startMeetingResponse = await worker.fetch(request(`/api/rooms/${created.id}/meetings`, {
    method: "POST",
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(startMeetingResponse.status, 201);
  const meeting = (await startMeetingResponse.json()).meeting;
  assert.equal(meeting.status, "active");

  const meetingStateResponse = await worker.fetch(request(`/api/rooms/${created.id}/meetings`, {
    headers: { Cookie: ownerCookie },
  }), env);
  assert.equal(meetingStateResponse.status, 200);
  assert.equal((await meetingStateResponse.json()).activeMeeting.id, meeting.id);

  const duplicateMeetingResponse = await worker.fetch(request(`/api/rooms/${created.id}/meetings`, {
    method: "POST",
    headers: { Cookie: ownerCookie },
  }), env);
  assert.equal(duplicateMeetingResponse.status, 409);
  assert.equal((await duplicateMeetingResponse.json()).code, "MEETING_ALREADY_ACTIVE");

  const startSpeechResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/meetings/${meeting.id}/speeches`,
    {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ speakerUserId: memberId }),
    },
  ), env);
  assert.equal(startSpeechResponse.status, 201);
  const speech = (await startSpeechResponse.json()).speech;
  assert.equal(speech.speaker.name, "Ada Lovelace");
  assert.equal(speech.status, "running");

  const speechStateResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/meetings/${meeting.id}/speeches`,
    { headers: { Cookie: memberCookie } },
  ), env);
  assert.equal(speechStateResponse.status, 200);
  assert.equal((await speechStateResponse.json()).activeSpeech.id, speech.id);

  const blockedEndResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/meetings/${meeting.id}/end`,
    { method: "POST", headers: { Cookie: ownerCookie } },
  ), env);
  assert.equal(blockedEndResponse.status, 409);
  assert.equal((await blockedEndResponse.json()).code, "SPEECH_ACTIVE");

  for (const action of ["pause", "resume", "finish"]) {
    const actionResponse = await worker.fetch(request(
      `/api/rooms/${created.id}/meetings/${meeting.id}/speeches/${speech.id}/${action}`,
      { method: "POST", headers: { Cookie: ownerCookie } },
    ), env);
    assert.equal(actionResponse.status, 200);
  }

  const endMeetingResponse = await worker.fetch(request(
    `/api/rooms/${created.id}/meetings/${meeting.id}/end`,
    { method: "POST", headers: { Cookie: ownerCookie } },
  ), env);
  assert.equal(endMeetingResponse.status, 200);
  assert.equal((await endMeetingResponse.json()).meeting.status, "completed");

  const leaveResponse = await worker.fetch(request(`/api/rooms/${created.id}/members/${memberId}`, {
    method: "DELETE",
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(leaveResponse.status, 200);

  const archiveResponse = await worker.fetch(request(`/api/rooms/${created.id}/archive`, {
    method: "POST",
    headers: { Cookie: ownerCookie },
  }), env);
  assert.equal(archiveResponse.status, 200);
  assert.equal((await archiveResponse.json()).archived, true);
});

test("signs in an existing user with email and password", async () => {
  const env = await testEnv();
  await signUp(env);

  const response = await worker.fetch(request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "grace@example.com", password: "compiler pioneer 1952" }),
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /standup_helper\.session_token=/);
});

test("rejects invalid credentials and anonymous task requests", async () => {
  const env = await testEnv();
  const login = await worker.fetch(request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "incorrect password value" }),
  }), env);
  assert.equal(login.status, 401);

  const task = await worker.fetch(request("/api/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "current", recentTasks: [] }),
  }), env);
  assert.equal(task.status, 401);
  assert.equal((await task.json()).code, "AUTH_REQUIRED");
});

test("revokes the database session on sign out", async () => {
  const env = await testEnv();
  const cookie = await signUp(env);
  const response = await worker.fetch(request("/api/auth/sign-out", {
    method: "POST",
    headers: { Cookie: cookie, Origin: baseURL, "Content-Type": "application/json" },
    body: "{}",
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);

  const admin = await worker.fetch(request("/admin", { headers: { Cookie: cookie } }), env);
  assert.equal(admin.status, 302);
});

test("keeps explicit method guards and security headers", async () => {
  const env = await testEnv();
  const response = await worker.fetch(request("/api/task"), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  const rooms = await worker.fetch(request("/api/rooms", { method: "PUT" }), env);
  assert.equal(rooms.status, 405);
  assert.equal(rooms.headers.get("allow"), "GET, POST");

  const room = await worker.fetch(request("/api/rooms/room-id", { method: "POST" }), env);
  assert.equal(room.status, 405);
  assert.equal(room.headers.get("allow"), "GET, PATCH");

  const meetings = await worker.fetch(request("/api/rooms/room-id/meetings", { method: "PUT" }), env);
  assert.equal(meetings.status, 405);
  assert.equal(meetings.headers.get("allow"), "GET, POST");

  const speeches = await worker.fetch(request(
    "/api/rooms/room-id/meetings/meeting-id/speeches",
    { method: "PUT" },
  ), env);
  assert.equal(speeches.status, 405);
  assert.equal(speeches.headers.get("allow"), "GET, POST");

  const assignments = await worker.fetch(request(
    "/api/rooms/room-id/assignments",
    { method: "POST" },
  ), env);
  assert.equal(assignments.status, 405);
  assert.equal(assignments.headers.get("allow"), "GET");

  const quizzes = await worker.fetch(request(
    "/api/rooms/room-id/quizzes",
    { method: "PUT" },
  ), env);
  assert.equal(quizzes.status, 405);
  assert.equal(quizzes.headers.get("allow"), "GET, POST");

  const quiz = await worker.fetch(request(
    "/api/rooms/room-id/quizzes/quiz-id",
    { method: "POST" },
  ), env);
  assert.equal(quiz.status, 405);
  assert.equal(quiz.headers.get("allow"), "GET, PATCH, DELETE");

  const quizGames = await worker.fetch(request(
    "/api/rooms/room-id/quiz-games",
    { method: "PUT" },
  ), env);
  assert.equal(quizGames.status, 405);
  assert.equal(quizGames.headers.get("allow"), "GET, POST");

  const quizGame = await worker.fetch(request(
    "/api/rooms/room-id/quiz-games/game-id",
    { method: "PUT" },
  ), env);
  assert.equal(quizGame.status, 405);
  assert.equal(quizGame.headers.get("allow"), "GET");

  const joinQuizGame = await worker.fetch(request(
    "/api/rooms/room-id/quiz-games/game-id/join",
  ), env);
  assert.equal(joinQuizGame.status, 405);
  assert.equal(joinQuizGame.headers.get("allow"), "POST");

  const answerQuizGame = await worker.fetch(request(
    "/api/rooms/room-id/quiz-games/game-id/answer",
  ), env);
  assert.equal(answerQuizGame.status, 405);
  assert.equal(answerQuizGame.headers.get("allow"), "POST");
});
