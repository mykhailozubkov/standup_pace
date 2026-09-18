import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

type RoomRole = "owner" | "admin" | "member";
type SpeechStatus = "running" | "paused" | "completed";

interface RoomAccessRow {
  role: RoomRole;
}

interface MeetingRow {
  status: "active" | "completed";
  talk_limit_seconds: number;
}

interface SpeechRow {
  id: string;
  meeting_id: string;
  status: SpeechStatus;
  speaker_user_id: string;
  speaker_name: string;
  started_by_user_id: string;
  started_by_name: string;
  ended_by_user_id: string | null;
  ended_by_name: string | null;
  talk_limit_seconds: number;
  accumulated_seconds: number;
  resumed_at: number | null;
  started_at: number;
  ended_at: number | null;
}

function validateIdentifier(value: string, errorCode: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new AppError(errorCode, 404);
}

async function roomAccess(env: Env, roomId: string, userId: string) {
  validateIdentifier(roomId, "ROOM_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT room_members.role
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

function requireManager(role: RoomRole) {
  if (role !== "owner" && role !== "admin") throw new AppError("ROOM_FORBIDDEN", 403);
}

async function meetingById(env: Env, roomId: string, meetingId: string) {
  validateIdentifier(meetingId, "MEETING_NOT_FOUND");
  const result = await env.DB.prepare(`
    SELECT status, talk_limit_seconds
    FROM meetings
    WHERE id = ? AND room_id = ?
    LIMIT 1
  `).bind(meetingId, roomId).all<MeetingRow>();
  const meeting = result.results[0];
  if (!meeting) throw new AppError("MEETING_NOT_FOUND", 404);
  return meeting;
}

const SPEECH_SELECT = `
  SELECT
    speeches.id,
    speeches.meeting_id,
    speeches.status,
    speeches.speaker_user_id,
    speakers.display_name AS speaker_name,
    speeches.started_by_user_id,
    starters.display_name AS started_by_name,
    speeches.ended_by_user_id,
    enders.display_name AS ended_by_name,
    speeches.talk_limit_seconds,
    speeches.accumulated_seconds,
    speeches.resumed_at,
    speeches.started_at,
    speeches.ended_at
  FROM speeches
  JOIN user_profiles AS speakers ON speakers.user_id = speeches.speaker_user_id
  JOIN user_profiles AS starters ON starters.user_id = speeches.started_by_user_id
  LEFT JOIN user_profiles AS enders ON enders.user_id = speeches.ended_by_user_id
`;

function speechPayload(speech: SpeechRow) {
  const accumulatedSeconds = Number(speech.accumulated_seconds);
  const talkLimitSeconds = Number(speech.talk_limit_seconds);
  return {
    id: speech.id,
    meetingId: speech.meeting_id,
    status: speech.status,
    speaker: { id: speech.speaker_user_id, name: speech.speaker_name },
    startedBy: { id: speech.started_by_user_id, name: speech.started_by_name },
    endedBy: speech.ended_by_user_id
      ? { id: speech.ended_by_user_id, name: speech.ended_by_name }
      : null,
    talkLimitSeconds,
    accumulatedSeconds,
    resumedAt: speech.resumed_at === null ? null : Number(speech.resumed_at),
    startedAt: Number(speech.started_at),
    endedAt: speech.ended_at === null ? null : Number(speech.ended_at),
    overLimit: speech.status === "completed" && accumulatedSeconds > talkLimitSeconds,
  };
}

async function speechById(env: Env, meetingId: string, speechId: string) {
  validateIdentifier(speechId, "SPEECH_NOT_FOUND");
  const result = await env.DB.prepare(`${SPEECH_SELECT}
    WHERE speeches.id = ? AND speeches.meeting_id = ?
    LIMIT 1
  `).bind(speechId, meetingId).all<SpeechRow>();
  return result.results[0] || null;
}

async function requireOpenSpeech(
  env: Env,
  meetingId: string,
  speechId: string,
  expectedStatus?: "running" | "paused",
) {
  const speech = await speechById(env, meetingId, speechId);
  if (!speech) throw new AppError("SPEECH_NOT_FOUND", 404);
  if (speech.status === "completed") throw new AppError("SPEECH_NOT_ACTIVE", 409);
  if (expectedStatus && speech.status !== expectedStatus) {
    throw new AppError(expectedStatus === "running" ? "SPEECH_NOT_RUNNING" : "SPEECH_NOT_PAUSED", 409);
  }
  return speech;
}

async function requireActiveMeeting(env: Env, roomId: string, meetingId: string) {
  const meeting = await meetingById(env, roomId, meetingId);
  if (meeting.status !== "active") throw new AppError("MEETING_NOT_ACTIVE", 409);
  return meeting;
}

export async function listSpeeches(
  env: Env,
  roomId: string,
  meetingId: string,
  userId: string,
) {
  await roomAccess(env, roomId, userId);
  await meetingById(env, roomId, meetingId);
  const result = await env.DB.prepare(`${SPEECH_SELECT}
    WHERE speeches.meeting_id = ?
    ORDER BY
      CASE speeches.status WHEN 'running' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      speeches.started_at DESC
    LIMIT 51
  `).bind(meetingId).all<SpeechRow>();
  const speeches = result.results.map(speechPayload);
  return {
    activeSpeech: speeches.find((speech) => speech.status !== "completed") || null,
    recentSpeeches: speeches.filter((speech) => speech.status === "completed").slice(0, 50),
  };
}

export async function listRoomSpeeches(env: Env, roomId: string, userId: string) {
  await roomAccess(env, roomId, userId);
  const result = await env.DB.prepare(`${SPEECH_SELECT}
    JOIN meetings ON meetings.id = speeches.meeting_id
    WHERE meetings.room_id = ?
    ORDER BY
      CASE speeches.status WHEN 'running' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      speeches.started_at DESC
    LIMIT 51
  `).bind(roomId).all<SpeechRow>();
  const speeches = result.results.map(speechPayload);
  return {
    activeSpeech: speeches.find((speech) => speech.status !== "completed") || null,
    recentSpeeches: speeches.filter((speech) => speech.status === "completed").slice(0, 50),
  };
}

export async function startSpeech(
  env: Env,
  roomId: string,
  meetingId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access.role);
  const meeting = await requireActiveMeeting(env, roomId, meetingId);
  if (typeof body.speakerUserId !== "string" || !body.speakerUserId.trim()) {
    throw new AppError("INVALID_SPEAKER", 400);
  }
  const speakerUserId = body.speakerUserId.trim();
  const member = await env.DB.prepare(`
    SELECT 1 AS active
    FROM room_members
    WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
    LIMIT 1
  `).bind(roomId, speakerUserId).all<{ active: number }>();
  if (!member.results[0]) throw new AppError("SPEAKER_NOT_IN_ROOM", 400);

  const speechId = crypto.randomUUID();
  try {
    await env.DB.prepare(`
      INSERT INTO speeches (
        id, meeting_id, speaker_user_id, started_by_user_id,
        talk_limit_seconds, resumed_at
      ) VALUES (?, ?, ?, ?, ?, unixepoch())
    `).bind(
      speechId,
      meetingId,
      speakerUserId,
      userId,
      Number(meeting.talk_limit_seconds),
    ).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/speeches_one_open_per_meeting|unique.*speeches\.meeting_id/i.test(message)) {
      throw new AppError("SPEECH_ALREADY_ACTIVE", 409);
    }
    throw new AppError("SPEECH_START_FAILED", 500, { cause: error });
  }

  const speech = await speechById(env, meetingId, speechId);
  if (!speech) throw new AppError("SPEECH_START_FAILED", 500);
  return speechPayload(speech);
}

export async function pauseSpeech(
  env: Env,
  roomId: string,
  meetingId: string,
  speechId: string,
  userId: string,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access.role);
  await requireActiveMeeting(env, roomId, meetingId);
  await requireOpenSpeech(env, meetingId, speechId, "running");
  const result = await env.DB.prepare(`
    UPDATE speeches
    SET
      accumulated_seconds = accumulated_seconds + MAX(0, unixepoch() - resumed_at),
      resumed_at = NULL,
      status = 'paused'
    WHERE id = ? AND meeting_id = ? AND status = 'running'
  `).bind(speechId, meetingId).all();
  if (Number(result.meta.changes) !== 1) throw new AppError("SPEECH_NOT_RUNNING", 409);
  const speech = await speechById(env, meetingId, speechId);
  if (!speech) throw new AppError("SPEECH_NOT_FOUND", 404);
  return speechPayload(speech);
}

export async function resumeSpeech(
  env: Env,
  roomId: string,
  meetingId: string,
  speechId: string,
  userId: string,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access.role);
  await requireActiveMeeting(env, roomId, meetingId);
  await requireOpenSpeech(env, meetingId, speechId, "paused");
  const result = await env.DB.prepare(`
    UPDATE speeches
    SET resumed_at = unixepoch(), status = 'running'
    WHERE id = ? AND meeting_id = ? AND status = 'paused'
  `).bind(speechId, meetingId).all();
  if (Number(result.meta.changes) !== 1) throw new AppError("SPEECH_NOT_PAUSED", 409);
  const speech = await speechById(env, meetingId, speechId);
  if (!speech) throw new AppError("SPEECH_NOT_FOUND", 404);
  return speechPayload(speech);
}

export async function finishSpeech(
  env: Env,
  roomId: string,
  meetingId: string,
  speechId: string,
  userId: string,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access.role);
  await requireActiveMeeting(env, roomId, meetingId);
  await requireOpenSpeech(env, meetingId, speechId);
  const result = await env.DB.prepare(`
    UPDATE speeches
    SET
      accumulated_seconds = accumulated_seconds + CASE
        WHEN status = 'running' THEN MAX(0, unixepoch() - resumed_at)
        ELSE 0
      END,
      resumed_at = NULL,
      status = 'completed',
      ended_by_user_id = ?,
      ended_at = unixepoch()
    WHERE id = ? AND meeting_id = ? AND status IN ('running', 'paused')
  `).bind(userId, speechId, meetingId).all();
  if (Number(result.meta.changes) !== 1) throw new AppError("SPEECH_NOT_ACTIVE", 409);
  const speech = await speechById(env, meetingId, speechId);
  if (!speech) throw new AppError("SPEECH_NOT_FOUND", 404);
  return speechPayload(speech);
}
