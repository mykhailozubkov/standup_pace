import assert from "node:assert/strict";
import test from "node:test";
import { endMeeting, startMeeting } from "../src/meetings.ts";
import { createRoom, joinRoom, updateMemberRole } from "../src/rooms.ts";
import {
  finishSpeech,
  listSpeeches,
  pauseSpeech,
  resumeSpeech,
  startSpeech,
} from "../src/speeches.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "speech-owner", name: "Ada Owner", email: "ada@example.com" };
const admin = { id: "speech-admin", name: "Grace Admin", email: "grace@example.com" };
const member = { id: "speech-member", name: "Linus Member", email: "linus@example.com" };

async function activeStandup() {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, {
    name: "Platform team",
    defaultTalkLimitSeconds: 120,
  });
  await joinRoom(env, admin, { joinCode: room.joinCode });
  await joinRoom(env, member, { joinCode: room.joinCode });
  await updateMemberRole(env, room.id, owner.id, admin.id, { role: "admin" });
  const meeting = await startMeeting(env, room.id, owner.id);
  return { env, room, meeting };
}

test("runs, pauses, resumes, and finishes a persisted speaker turn", async () => {
  const { env, room, meeting } = await activeStandup();
  const started = await startSpeech(env, room.id, meeting.id, admin.id, {
    speakerUserId: member.id,
  });
  assert.equal(started.status, "running");
  assert.equal(started.speaker.name, member.name);
  assert.equal(started.talkLimitSeconds, 120);

  await env.DB.prepare(`
    UPDATE speeches SET resumed_at = unixepoch() - 90 WHERE id = ?
  `).bind(started.id).all();
  const paused = await pauseSpeech(env, room.id, meeting.id, started.id, owner.id);
  assert.equal(paused.status, "paused");
  assert.equal(paused.accumulatedSeconds, 90);
  assert.equal(paused.resumedAt, null);

  const resumed = await resumeSpeech(env, room.id, meeting.id, started.id, admin.id);
  assert.equal(resumed.status, "running");
  await env.DB.prepare(`
    UPDATE speeches SET resumed_at = unixepoch() - 40 WHERE id = ?
  `).bind(started.id).all();
  const completed = await finishSpeech(env, room.id, meeting.id, started.id, owner.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.accumulatedSeconds, 130);
  assert.equal(completed.overLimit, true);

  const state = await listSpeeches(env, room.id, meeting.id, member.id);
  assert.equal(state.activeSpeech, null);
  assert.equal(state.recentSpeeches[0].id, started.id);
});

test("enforces room roles, membership, and one open speech per standup", async () => {
  const { env, room, meeting } = await activeStandup();
  await assert.rejects(
    () => startSpeech(env, room.id, meeting.id, member.id, { speakerUserId: member.id }),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => startSpeech(env, room.id, meeting.id, owner.id, { speakerUserId: "outsider" }),
    /SPEAKER_NOT_IN_ROOM/,
  );

  const active = await startSpeech(env, room.id, meeting.id, owner.id, {
    speakerUserId: member.id,
  });
  await assert.rejects(
    () => startSpeech(env, room.id, meeting.id, admin.id, { speakerUserId: owner.id }),
    /SPEECH_ALREADY_ACTIVE/,
  );
  await assert.rejects(
    () => pauseSpeech(env, room.id, meeting.id, active.id, member.id),
    /ROOM_FORBIDDEN/,
  );
  await assert.rejects(
    () => endMeeting(env, room.id, meeting.id, owner.id),
    /SPEECH_ACTIVE/,
  );

  await finishSpeech(env, room.id, meeting.id, active.id, admin.id);
  const ended = await endMeeting(env, room.id, meeting.id, owner.id);
  assert.equal(ended.status, "completed");
  await assert.rejects(
    () => startSpeech(env, room.id, meeting.id, owner.id, { speakerUserId: owner.id }),
    /MEETING_NOT_ACTIVE/,
  );
});
