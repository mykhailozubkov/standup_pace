import assert from "node:assert/strict";
import test from "node:test";
import { drawAssignment, listAssignments } from "../src/assignments.ts";
import { endMeeting, startMeeting } from "../src/meetings.ts";
import { createRoom, joinRoom, updateMemberRole } from "../src/rooms.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "task-owner", name: "Ada Owner", email: "ada@example.com" };
const admin = { id: "task-admin", name: "Grace Admin", email: "grace@example.com" };
const member = { id: "task-member", name: "Linus Member", email: "linus@example.com" };

async function taskRoom() {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, { name: "Platform team" });
  await joinRoom(env, admin, { joinCode: room.joinCode });
  await joinRoom(env, member, { joinCode: room.joinCode });
  await updateMemberRole(env, room.id, owner.id, admin.id, { role: "admin" });
  return { env, room };
}

function taskGenerator() {
  let number = 0;
  return async () => {
    number += 1;
    return {
      taskEn: `Generated task ${number}`,
      taskRu: `Сгенерированное задание ${number}`,
      model: "test/free-model",
    };
  };
}

test("draws every active member before starting the next preparation round", async () => {
  const { env, room } = await taskRoom();
  const generate = taskGenerator();
  const firstRound = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await drawAssignment(
      env, room.id, admin.id, { kind: "next" }, "https://example.test", generate,
    );
    firstRound.push(result.assignment);
  }

  assert.equal(new Set(firstRound.map(({ participant }) => participant.id)).size, 3);
  assert.ok(firstRound.every(({ cycleNumber }) => cycleNumber === 1));
  assert.equal(firstRound.at(-1).taskEn, "Generated task 3");

  const nextRound = await drawAssignment(
    env, room.id, owner.id, { kind: "next" }, "https://example.test", generate,
  );
  assert.equal(nextRound.assignment.cycleNumber, 2);
  assert.notEqual(nextRound.assignment.participant.id, firstRound.at(-1).participant.id);

  const memberState = await listAssignments(env, room.id, member.id);
  assert.equal(memberState.nextDraw.cycleNumber, 2);
  assert.equal(memberState.nextDraw.remaining, 2);
  assert.equal(memberState.recentAssignments.length, 4);
  assert.ok(memberState.myAssignments.length >= 1);
});

test("keeps current-call rounds inside an active standup and restricts drawing to managers", async () => {
  const { env, room } = await taskRoom();
  const generate = taskGenerator();

  await assert.rejects(
    () => drawAssignment(
      env, room.id, member.id, { kind: "next" }, "https://example.test", generate,
    ),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => drawAssignment(
      env, room.id, owner.id, { kind: "current" }, "https://example.test", generate,
    ),
    /MEETING_NOT_ACTIVE/,
  );

  const firstMeeting = await startMeeting(env, room.id, owner.id);
  const first = await drawAssignment(
    env, room.id, owner.id, { kind: "current" }, "https://example.test", generate,
  );
  assert.equal(first.assignment.meetingId, firstMeeting.id);
  assert.equal(first.assignment.cycleNumber, 1);
  assert.equal(first.state.currentDraw.remaining, 2);

  await endMeeting(env, room.id, firstMeeting.id, owner.id);
  const secondMeeting = await startMeeting(env, room.id, admin.id);
  const state = await listAssignments(env, room.id, member.id);
  assert.equal(state.activeMeetingId, secondMeeting.id);
  assert.equal(state.currentDraw.latestAssignment, null);
  assert.equal(state.currentDraw.remaining, 3);

  const second = await drawAssignment(
    env, room.id, admin.id, { kind: "current" }, "https://example.test", generate,
  );
  assert.equal(second.assignment.meetingId, secondMeeting.id);
  assert.equal(second.assignment.cycleNumber, 1);

  await assert.rejects(
    () => drawAssignment(
      env,
      room.id,
      owner.id,
      { kind: "current" },
      "https://example.test",
      async () => {
        await endMeeting(env, room.id, secondMeeting.id, owner.id);
        return {
          taskEn: "Too late",
          taskRu: "Слишком поздно",
          model: "test/free-model",
        };
      },
    ),
    /MEETING_NOT_ACTIVE/,
  );
});
