import assert from "node:assert/strict";
import test from "node:test";
import { endMeeting, listMeetings, startMeeting } from "../src/meetings.ts";
import { archiveRoom, createRoom, joinRoom, updateMemberRole, updateRoom } from "../src/rooms.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "meeting-owner", name: "Ada Owner", email: "ada@example.com" };
const admin = { id: "meeting-admin", name: "Grace Admin", email: "grace@example.com" };
const member = { id: "meeting-member", name: "Linus Member", email: "linus@example.com" };

async function meetingRoom() {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, {
    name: "Platform team",
    defaultTalkLimitSeconds: 180,
  });
  await joinRoom(env, admin, { joinCode: room.joinCode });
  await joinRoom(env, member, { joinCode: room.joinCode });
  await updateMemberRole(env, room.id, owner.id, admin.id, { role: "admin" });
  return { env, room };
}

test("starts one active meeting and exposes it to every room member", async () => {
  const { env, room } = await meetingRoom();
  const meeting = await startMeeting(env, room.id, admin.id);

  assert.equal(meeting.roomId, room.id);
  assert.equal(meeting.status, "active");
  assert.equal(meeting.talkLimitSeconds, 180);
  assert.deepEqual(meeting.startedBy, { id: admin.id, name: admin.name });
  assert.equal(meeting.endedBy, null);

  const state = await listMeetings(env, room.id, member.id);
  assert.equal(state.activeMeeting.id, meeting.id);
  assert.deepEqual(state.recentMeetings, []);
  await assert.rejects(() => startMeeting(env, room.id, owner.id), /MEETING_ALREADY_ACTIVE/);
});

test("restricts meeting controls to room managers", async () => {
  const { env, room } = await meetingRoom();
  await assert.rejects(() => startMeeting(env, room.id, member.id), /ROOM_FORBIDDEN/);

  const meeting = await startMeeting(env, room.id, owner.id);
  await assert.rejects(
    () => endMeeting(env, room.id, meeting.id, member.id),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => listMeetings(env, room.id, "not-a-member"),
    /ROOM_NOT_FOUND/,
  );
});

test("completes a meeting, records history, and allows the next standup", async () => {
  const { env, room } = await meetingRoom();
  const first = await startMeeting(env, room.id, owner.id);
  await updateRoom(env, room.id, owner.id, { defaultTalkLimitSeconds: 240 });
  await assert.rejects(() => archiveRoom(env, room.id, owner.id), /MEETING_ACTIVE/);

  const completed = await endMeeting(env, room.id, first.id, admin.id);
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.endedBy, { id: admin.id, name: admin.name });
  assert.equal(completed.talkLimitSeconds, 180);
  assert.ok(completed.endedAt >= completed.startedAt);
  await assert.rejects(
    () => endMeeting(env, room.id, first.id, owner.id),
    /MEETING_NOT_ACTIVE/,
  );

  const second = await startMeeting(env, room.id, admin.id);
  assert.equal(second.talkLimitSeconds, 240);
  const state = await listMeetings(env, room.id, member.id);
  assert.equal(state.activeMeeting.id, second.id);
  assert.equal(state.recentMeetings.length, 1);
  assert.equal(state.recentMeetings[0].id, first.id);
});
