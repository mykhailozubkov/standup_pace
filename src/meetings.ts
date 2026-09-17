import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

type RoomRole = "owner" | "admin" | "member";

interface RoomAccessRow {
  role: RoomRole;
  default_talk_limit_seconds: number;
}

interface MeetingRow {
  id: string;
  room_id: string;
  status: "active" | "completed";
  talk_limit_seconds: number;
  started_by_user_id: string;
  started_by_name: string;
  ended_by_user_id: string | null;
  ended_by_name: string | null;
  started_at: number;
  ended_at: number | null;
}

function validateIdentifier(value: string, errorCode: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new AppError(errorCode, 404);
}

async function roomAccess(env: Env, roomId: string, userId: string) {
  validateIdentifier(roomId, "ROOM_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT room_members.role, rooms.default_talk_limit_seconds
    FROM room_members
    JOIN rooms ON rooms.id = room_members.room_id
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

function requireMeetingManager(role: RoomRole) {
  if (role !== "owner" && role !== "admin") {
    throw new AppError("ROOM_FORBIDDEN", 403);
  }
}

function meetingPayload(meeting: MeetingRow) {
  return {
    id: meeting.id,
    roomId: meeting.room_id,
    status: meeting.status,
    talkLimitSeconds: Number(meeting.talk_limit_seconds),
    startedBy: {
      id: meeting.started_by_user_id,
      name: meeting.started_by_name,
    },
    endedBy: meeting.ended_by_user_id
      ? { id: meeting.ended_by_user_id, name: meeting.ended_by_name }
      : null,
    startedAt: Number(meeting.started_at),
    endedAt: meeting.ended_at === null ? null : Number(meeting.ended_at),
  };
}

const MEETING_SELECT = `
  SELECT
    meetings.id,
    meetings.room_id,
    meetings.status,
    meetings.talk_limit_seconds,
    meetings.started_by_user_id,
    starters.display_name AS started_by_name,
    meetings.ended_by_user_id,
    enders.display_name AS ended_by_name,
    meetings.started_at,
    meetings.ended_at
  FROM meetings
  JOIN user_profiles AS starters ON starters.user_id = meetings.started_by_user_id
  LEFT JOIN user_profiles AS enders ON enders.user_id = meetings.ended_by_user_id
`;

async function meetingById(env: Env, roomId: string, meetingId: string) {
  const result = await env.DB.prepare(`${MEETING_SELECT}
    WHERE meetings.id = ? AND meetings.room_id = ?
    LIMIT 1
  `).bind(meetingId, roomId).all<MeetingRow>();
  return result.results[0] || null;
}

export async function listMeetings(env: Env, roomId: string, userId: string) {
  await roomAccess(env, roomId, userId);
  const result = await env.DB.prepare(`${MEETING_SELECT}
    WHERE meetings.room_id = ?
    ORDER BY
      CASE meetings.status WHEN 'active' THEN 0 ELSE 1 END,
      meetings.started_at DESC
    LIMIT 11
  `).bind(roomId).all<MeetingRow>();

  const meetings = result.results.map(meetingPayload);
  return {
    activeMeeting: meetings.find((meeting) => meeting.status === "active") || null,
    recentMeetings: meetings.filter((meeting) => meeting.status === "completed").slice(0, 10),
  };
}

export async function startMeeting(env: Env, roomId: string, userId: string) {
  const access = await roomAccess(env, roomId, userId);
  requireMeetingManager(access.role);
  const meetingId = crypto.randomUUID();

  try {
    await env.DB.prepare(`
      INSERT INTO meetings (
        id, room_id, talk_limit_seconds, started_by_user_id
      ) VALUES (?, ?, ?, ?)
    `).bind(
      meetingId,
      roomId,
      Number(access.default_talk_limit_seconds),
      userId,
    ).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/meetings_one_active_per_room|unique.*meetings\.room_id/i.test(message)) {
      throw new AppError("MEETING_ALREADY_ACTIVE", 409);
    }
    throw new AppError("MEETING_START_FAILED", 500, { cause: error });
  }

  const meeting = await meetingById(env, roomId, meetingId);
  if (!meeting) throw new AppError("MEETING_START_FAILED", 500);
  return meetingPayload(meeting);
}

export async function endMeeting(
  env: Env,
  roomId: string,
  meetingId: string,
  userId: string,
) {
  validateIdentifier(meetingId, "MEETING_NOT_FOUND");
  const access = await roomAccess(env, roomId, userId);
  requireMeetingManager(access.role);

  const existing = await meetingById(env, roomId, meetingId);
  if (!existing) throw new AppError("MEETING_NOT_FOUND", 404);
  if (existing.status !== "active") throw new AppError("MEETING_NOT_ACTIVE", 409);

  const result = await env.DB.prepare(`
    UPDATE meetings
    SET
      status = 'completed',
      ended_by_user_id = ?,
      ended_at = unixepoch()
    WHERE id = ? AND room_id = ? AND status = 'active'
  `).bind(userId, meetingId, roomId).all();
  if (Number(result.meta.changes) !== 1) throw new AppError("MEETING_NOT_ACTIVE", 409);

  const meeting = await meetingById(env, roomId, meetingId);
  if (!meeting) throw new AppError("MEETING_NOT_FOUND", 404);
  return meetingPayload(meeting);
}
