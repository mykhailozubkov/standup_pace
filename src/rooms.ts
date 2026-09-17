import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

type RoomRole = "owner" | "admin" | "member";

interface RoomRow {
  id: string;
  name: string;
  join_code: string;
  role: RoomRole;
  default_talk_limit_seconds: number;
  member_count: number;
  created_at: number;
  joined_at: number;
}

interface RoomAccessRow {
  owner_user_id: string;
  name: string;
  role: RoomRole;
  default_talk_limit_seconds: number;
}

interface MemberRow {
  role: RoomRole;
}

function validateRoomId(roomId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) throw new AppError("ROOM_NOT_FOUND", 404);
}

function normalizedRoomName(value: unknown) {
  if (typeof value !== "string") throw new AppError("INVALID_ROOM_NAME", 400);
  const name = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 120) throw new AppError("INVALID_ROOM_NAME", 400);
  return name;
}

function normalizedTalkLimit(value: unknown) {
  if (value === undefined) return 120;
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 3_600) {
    throw new AppError("INVALID_TALK_LIMIT", 400);
  }
  return seconds;
}

function normalizedJoinCode(value: unknown) {
  if (typeof value !== "string") throw new AppError("INVALID_JOIN_CODE", 400);
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== JOIN_CODE_LENGTH || ![...code].every((character) => JOIN_CODE_ALPHABET.includes(character))) {
    throw new AppError("INVALID_JOIN_CODE", 400);
  }
  return code;
}

function generateJoinCode() {
  const random = new Uint32Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(random);
  return [...random]
    .map((value) => JOIN_CODE_ALPHABET[value % JOIN_CODE_ALPHABET.length])
    .join("");
}

function roomPayload(room: RoomRow) {
  return {
    id: room.id,
    name: room.name,
    joinCode: room.join_code,
    role: room.role,
    defaultTalkLimitSeconds: Number(room.default_talk_limit_seconds),
    memberCount: Number(room.member_count),
    createdAt: Number(room.created_at),
    joinedAt: Number(room.joined_at),
  };
}

async function roomForUser(env: Env, roomId: string, userId: string) {
  const result = await env.DB.prepare(`
    SELECT
      rooms.id,
      rooms.name,
      rooms.join_code,
      room_members.role,
      rooms.default_talk_limit_seconds,
      rooms.created_at,
      room_members.joined_at,
      (
        SELECT COUNT(*)
        FROM room_members AS active_members
        WHERE active_members.room_id = rooms.id
          AND active_members.removed_at IS NULL
      ) AS member_count
    FROM rooms
    JOIN room_members ON room_members.room_id = rooms.id
    WHERE rooms.id = ?
      AND room_members.user_id = ?
      AND room_members.removed_at IS NULL
      AND rooms.status = 'active'
    LIMIT 1
  `).bind(roomId, userId).all<RoomRow>();
  return result.results[0] || null;
}

async function roomAccessForUser(env: Env, roomId: string, userId: string) {
  validateRoomId(roomId);
  const result = await env.DB.prepare(`
    SELECT
      rooms.owner_user_id,
      rooms.name,
      rooms.default_talk_limit_seconds,
      room_members.role
    FROM rooms
    JOIN room_members ON room_members.room_id = rooms.id
    WHERE rooms.id = ?
      AND room_members.user_id = ?
      AND room_members.removed_at IS NULL
      AND rooms.status = 'active'
    LIMIT 1
  `).bind(roomId, userId).all<RoomAccessRow>();
  const access = result.results[0];
  if (!access) throw new AppError("ROOM_NOT_FOUND", 404);
  return access;
}

async function activeMember(env: Env, roomId: string, userId: string) {
  const result = await env.DB.prepare(`
    SELECT role
    FROM room_members
    WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
    LIMIT 1
  `).bind(roomId, userId).all<MemberRow>();
  return result.results[0] || null;
}

export async function listRooms(env: Env, userId: string) {
  const result = await env.DB.prepare(`
    SELECT
      rooms.id,
      rooms.name,
      rooms.join_code,
      room_members.role,
      rooms.default_talk_limit_seconds,
      rooms.created_at,
      room_members.joined_at,
      (
        SELECT COUNT(*)
        FROM room_members AS active_members
        WHERE active_members.room_id = rooms.id
          AND active_members.removed_at IS NULL
      ) AS member_count
    FROM room_members
    JOIN rooms ON rooms.id = room_members.room_id
    WHERE room_members.user_id = ?
      AND room_members.removed_at IS NULL
      AND rooms.status = 'active'
    ORDER BY room_members.joined_at DESC, rooms.name COLLATE NOCASE
  `).bind(userId).all<RoomRow>();

  return result.results.map(roomPayload);
}

export async function createRoom(env: Env, user: AuthUser, body: Record<string, unknown>) {
  const name = normalizedRoomName(body.name);
  const defaultTalkLimitSeconds = normalizedTalkLimit(body.defaultTalkLimitSeconds);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomId = crypto.randomUUID();
    const joinCode = generateJoinCode();
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO user_profiles (user_id, display_name)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            display_name = excluded.display_name,
            updated_at = unixepoch()
        `).bind(user.id, user.name),
        env.DB.prepare(`
          INSERT INTO rooms (
            id, owner_user_id, name, join_code, default_talk_limit_seconds
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(roomId, user.id, name, joinCode, defaultTalkLimitSeconds),
        env.DB.prepare(`
          INSERT INTO room_members (room_id, user_id, role)
          VALUES (?, ?, 'owner')
        `).bind(roomId, user.id),
      ]);

      const room = await roomForUser(env, roomId, user.id);
      if (!room) throw new AppError("ROOM_CREATE_FAILED", 500);
      return roomPayload(room);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unique.*join_code|rooms\.join_code/i.test(message)) continue;
      if (error instanceof AppError) throw error;
      throw new AppError("ROOM_CREATE_FAILED", 500, { cause: error });
    }
  }

  throw new AppError("ROOM_CODE_GENERATION_FAILED", 503, { retryable: true });
}

export async function joinRoom(env: Env, user: AuthUser, body: Record<string, unknown>) {
  const joinCode = normalizedJoinCode(body.joinCode);
  const found = await env.DB.prepare(`
    SELECT id
    FROM rooms
    WHERE join_code = ? COLLATE NOCASE AND status = 'active'
    LIMIT 1
  `).bind(joinCode).all<{ id: string }>();
  const roomId = found.results[0]?.id;
  if (!roomId) throw new AppError("ROOM_NOT_FOUND", 404);

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO user_profiles (user_id, display_name)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = excluded.display_name,
          updated_at = unixepoch()
      `).bind(user.id, user.name),
      env.DB.prepare(`
        INSERT INTO room_members (room_id, user_id, role)
        VALUES (?, ?, 'member')
        ON CONFLICT(room_id, user_id) DO UPDATE SET
          role = CASE
            WHEN room_members.removed_at IS NOT NULL THEN 'member'
            ELSE room_members.role
          END,
          joined_at = CASE
            WHEN room_members.removed_at IS NOT NULL THEN unixepoch()
            ELSE room_members.joined_at
          END,
          removed_at = NULL
      `).bind(roomId, user.id),
    ]);
  } catch (error) {
    throw new AppError("ROOM_JOIN_FAILED", 500, { cause: error });
  }

  const room = await roomForUser(env, roomId, user.id);
  if (!room) throw new AppError("ROOM_JOIN_FAILED", 500);
  return roomPayload(room);
}

export async function getRoom(env: Env, roomId: string, userId: string) {
  validateRoomId(roomId);
  const room = await roomForUser(env, roomId, userId);
  if (!room) throw new AppError("ROOM_NOT_FOUND", 404);

  const members = await env.DB.prepare(`
    SELECT
      user_profiles.user_id AS id,
      user_profiles.display_name AS name,
      room_members.role,
      room_members.joined_at
    FROM room_members
    JOIN user_profiles ON user_profiles.user_id = room_members.user_id
    WHERE room_members.room_id = ? AND room_members.removed_at IS NULL
    ORDER BY
      CASE room_members.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      user_profiles.display_name COLLATE NOCASE
  `).bind(roomId).all<{ id: string; name: string; role: string; joined_at: number }>();

  return {
    ...roomPayload(room),
    members: members.results.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      joinedAt: Number(member.joined_at),
      isCurrentUser: member.id === userId,
    })),
  };
}

export async function updateRoom(
  env: Env,
  roomId: string,
  actorUserId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccessForUser(env, roomId, actorUserId);
  if (access.role !== "owner" && access.role !== "admin") {
    throw new AppError("ROOM_FORBIDDEN", 403);
  }

  const updatesName = body.name !== undefined;
  const updatesTalkLimit = body.defaultTalkLimitSeconds !== undefined;
  if (!updatesName && !updatesTalkLimit) throw new AppError("INVALID_ROOM_UPDATE", 400);

  const name = updatesName ? normalizedRoomName(body.name) : access.name;
  const talkLimit = updatesTalkLimit
    ? normalizedTalkLimit(body.defaultTalkLimitSeconds)
    : Number(access.default_talk_limit_seconds);

  await env.DB.prepare(`
    UPDATE rooms
    SET name = ?, default_talk_limit_seconds = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'active'
  `).bind(name, talkLimit, roomId).all();

  return getRoom(env, roomId, actorUserId);
}

export async function updateMemberRole(
  env: Env,
  roomId: string,
  actorUserId: string,
  memberUserId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccessForUser(env, roomId, actorUserId);
  if (access.role !== "owner") throw new AppError("ROOM_FORBIDDEN", 403);
  if (body.role !== "admin" && body.role !== "member") {
    throw new AppError("INVALID_MEMBER_ROLE", 400);
  }

  const member = await activeMember(env, roomId, memberUserId);
  if (!member) throw new AppError("MEMBER_NOT_FOUND", 404);
  if (member.role === "owner") throw new AppError("OWNER_ROLE_IMMUTABLE", 409);

  await env.DB.prepare(`
    UPDATE room_members
    SET role = ?
    WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
  `).bind(body.role, roomId, memberUserId).all();

  return getRoom(env, roomId, actorUserId);
}

export async function removeRoomMember(
  env: Env,
  roomId: string,
  actorUserId: string,
  memberUserId: string,
) {
  const access = await roomAccessForUser(env, roomId, actorUserId);
  const member = await activeMember(env, roomId, memberUserId);
  if (!member) throw new AppError("MEMBER_NOT_FOUND", 404);

  if (memberUserId === actorUserId) {
    if (access.role === "owner") throw new AppError("OWNER_CANNOT_LEAVE", 409);
  } else {
    if (access.role === "member") throw new AppError("ROOM_FORBIDDEN", 403);
    if (access.role === "admin" && member.role !== "member") {
      throw new AppError("ROOM_FORBIDDEN", 403);
    }
    if (member.role === "owner") throw new AppError("OWNER_CANNOT_BE_REMOVED", 409);
  }

  await env.DB.prepare(`
    UPDATE room_members
    SET removed_at = unixepoch()
    WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
  `).bind(roomId, memberUserId).all();

  return { roomId, memberId: memberUserId };
}

export async function archiveRoom(env: Env, roomId: string, actorUserId: string) {
  const access = await roomAccessForUser(env, roomId, actorUserId);
  if (access.role !== "owner") throw new AppError("ROOM_FORBIDDEN", 403);

  await env.DB.prepare(`
    UPDATE rooms
    SET status = 'archived', archived_at = unixepoch(), updated_at = unixepoch()
    WHERE id = ? AND status = 'active'
  `).bind(roomId).all();

  return { roomId, archived: true };
}
