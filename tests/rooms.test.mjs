import assert from "node:assert/strict";
import test from "node:test";
import { createRoom, getRoom, joinRoom, listRooms } from "../src/rooms.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const owner = { id: "user-owner", name: "Ada Owner", email: "ada@example.com" };
const member = { id: "user-member", name: "Grace Member", email: "grace@example.com" };

test("creates a room with an owner membership and lists it", async () => {
  const env = { DB: await createTestD1() };
  const room = await createRoom(env, owner, {
    name: "  Product   standup  ",
    defaultTalkLimitSeconds: 180,
  });

  assert.equal(room.name, "Product standup");
  assert.equal(room.role, "owner");
  assert.equal(room.defaultTalkLimitSeconds, 180);
  assert.match(room.joinCode, /^[A-HJ-NP-Z2-9]{6}$/);

  const rooms = await listRooms(env, owner.id);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].id, room.id);
  assert.equal(rooms[0].memberCount, 1);
});

test("joins a room by code and returns its active member list", async () => {
  const env = { DB: await createTestD1() };
  const created = await createRoom(env, owner, { name: "Engineering" });
  const joined = await joinRoom(env, member, { joinCode: created.joinCode.toLowerCase() });

  assert.equal(joined.id, created.id);
  assert.equal(joined.role, "member");
  assert.equal(joined.memberCount, 2);

  const room = await getRoom(env, created.id, member.id);
  assert.equal(room.members.length, 2);
  assert.deepEqual(room.members.map(({ name, role }) => ({ name, role })), [
    { name: "Ada Owner", role: "owner" },
    { name: "Grace Member", role: "member" },
  ]);
});

test("rejects invalid room input and hides rooms from non-members", async () => {
  const env = { DB: await createTestD1() };
  await assert.rejects(() => createRoom(env, owner, { name: "" }), /INVALID_ROOM_NAME/);
  await assert.rejects(() => createRoom(env, owner, {
    name: "Invalid limit",
    defaultTalkLimitSeconds: 5,
  }), /INVALID_TALK_LIMIT/);
  await assert.rejects(() => joinRoom(env, member, { joinCode: "ABC" }), /INVALID_JOIN_CODE/);
  await assert.rejects(() => joinRoom(env, member, { joinCode: "ABC234" }), /ROOM_NOT_FOUND/);

  const created = await createRoom(env, owner, { name: "Private room" });
  await assert.rejects(() => getRoom(env, created.id, member.id), /ROOM_NOT_FOUND/);
});
