import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";
import { requestOpenRouterTask } from "./openrouter.ts";

type AssignmentKind = "current" | "next";
type RoomRole = "owner" | "admin" | "member";

interface RoomAccessRow {
  role: RoomRole;
}

interface MeetingRow {
  id: string;
}

interface MemberRow {
  id: string;
  name: string;
}

interface AssignmentRow {
  id: string;
  room_id: string;
  meeting_id: string | null;
  kind: AssignmentKind;
  cycle_number: number;
  participant_user_id: string;
  participant_name: string;
  assigned_by_user_id: string;
  assigned_by_name: string;
  task_en: string;
  task_ru: string;
  model: string;
  created_at: number;
}

interface CycleRow {
  cycle_number: number;
  participant_user_id: string;
  sequence: number;
}

type TaskGenerator = typeof requestOpenRouterTask;

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

async function activeMeeting(env: Env, roomId: string) {
  const result = await env.DB.prepare(`
    SELECT id
    FROM meetings
    WHERE room_id = ? AND status = 'active'
    LIMIT 1
  `).bind(roomId).all<MeetingRow>();
  return result.results[0] || null;
}

async function activeMembers(env: Env, roomId: string) {
  const result = await env.DB.prepare(`
    SELECT user_profiles.user_id AS id, user_profiles.display_name AS name
    FROM room_members
    JOIN user_profiles ON user_profiles.user_id = room_members.user_id
    WHERE room_members.room_id = ? AND room_members.removed_at IS NULL
    ORDER BY user_profiles.display_name COLLATE NOCASE
  `).bind(roomId).all<MemberRow>();
  return result.results;
}

const ASSIGNMENT_SELECT = `
  SELECT
    assignments.id,
    assignments.room_id,
    assignments.meeting_id,
    assignments.kind,
    assignments.cycle_number,
    assignments.participant_user_id,
    participants.display_name AS participant_name,
    assignments.assigned_by_user_id,
    assigners.display_name AS assigned_by_name,
    assignments.task_en,
    assignments.task_ru,
    assignments.model,
    assignments.created_at
  FROM assignments
  JOIN user_profiles AS participants ON participants.user_id = assignments.participant_user_id
  JOIN user_profiles AS assigners ON assigners.user_id = assignments.assigned_by_user_id
`;

function assignmentPayload(row: AssignmentRow, currentUserId: string) {
  return {
    id: row.id,
    roomId: row.room_id,
    meetingId: row.meeting_id,
    kind: row.kind,
    cycleNumber: Number(row.cycle_number),
    participant: {
      id: row.participant_user_id,
      name: row.participant_name,
      isCurrentUser: row.participant_user_id === currentUserId,
    },
    assignedBy: { id: row.assigned_by_user_id, name: row.assigned_by_name },
    taskEn: row.task_en,
    taskRu: row.task_ru,
    model: row.model,
    createdAt: Number(row.created_at),
  };
}

async function assignmentById(env: Env, assignmentId: string) {
  const result = await env.DB.prepare(`${ASSIGNMENT_SELECT}
    WHERE assignments.id = ?
    LIMIT 1
  `).bind(assignmentId).all<AssignmentRow>();
  return result.results[0] || null;
}

function scopeClause(kind: AssignmentKind) {
  return kind === "current"
    ? "assignments.kind = 'current' AND assignments.meeting_id = ?"
    : "assignments.kind = 'next' AND assignments.room_id = ?";
}

async function cycleRows(
  env: Env,
  kind: AssignmentKind,
  scopeId: string,
) {
  const result = await env.DB.prepare(`
    SELECT cycle_number, participant_user_id, assignments.rowid AS sequence
    FROM assignments
    WHERE ${scopeClause(kind)}
    ORDER BY cycle_number DESC, assignments.rowid DESC
  `).bind(scopeId).all<CycleRow>();
  return result.results;
}

async function latestAssignment(
  env: Env,
  kind: AssignmentKind,
  scopeId: string,
) {
  const result = await env.DB.prepare(`${ASSIGNMENT_SELECT}
    WHERE ${scopeClause(kind)}
    ORDER BY assignments.created_at DESC, assignments.rowid DESC
    LIMIT 1
  `).bind(scopeId).all<AssignmentRow>();
  return result.results[0] || null;
}

function cycleSnapshot(rows: CycleRow[], members: MemberRow[]) {
  const currentCycle = rows.length ? Number(rows[0].cycle_number) : 1;
  const activeMemberIds = new Set(members.map((member) => member.id));
  const assignedIds = new Set(
    rows
      .filter((row) => Number(row.cycle_number) === currentCycle)
      .map((row) => row.participant_user_id)
      .filter((id) => activeMemberIds.has(id)),
  );
  return {
    cycleNumber: currentCycle,
    assignedIds,
    remaining: Math.max(0, members.length - assignedIds.size),
  };
}

async function drawSummary(
  env: Env,
  kind: AssignmentKind,
  scopeId: string | null,
  members: MemberRow[],
  currentUserId: string,
) {
  if (!scopeId) {
    return {
      available: false,
      cycleNumber: 1,
      remaining: members.length,
      total: members.length,
      latestAssignment: null,
    };
  }
  const [rows, latest] = await Promise.all([
    cycleRows(env, kind, scopeId),
    latestAssignment(env, kind, scopeId),
  ]);
  const cycle = cycleSnapshot(rows, members);
  return {
    available: true,
    cycleNumber: cycle.cycleNumber,
    remaining: cycle.remaining,
    total: members.length,
    latestAssignment: latest ? assignmentPayload(latest, currentUserId) : null,
  };
}

export async function listAssignments(env: Env, roomId: string, userId: string) {
  await roomAccess(env, roomId, userId);
  const [meeting, members, recentResult, mineResult] = await Promise.all([
    activeMeeting(env, roomId),
    activeMembers(env, roomId),
    env.DB.prepare(`${ASSIGNMENT_SELECT}
      WHERE assignments.room_id = ?
      ORDER BY assignments.created_at DESC, assignments.rowid DESC
      LIMIT 50
    `).bind(roomId).all<AssignmentRow>(),
    env.DB.prepare(`${ASSIGNMENT_SELECT}
      WHERE assignments.room_id = ? AND assignments.participant_user_id = ?
      ORDER BY assignments.created_at DESC, assignments.rowid DESC
      LIMIT 20
    `).bind(roomId, userId).all<AssignmentRow>(),
  ]);
  const [currentDraw, nextDraw] = await Promise.all([
    drawSummary(env, "current", meeting?.id || null, members, userId),
    drawSummary(env, "next", roomId, members, userId),
  ]);
  return {
    activeMeetingId: meeting?.id || null,
    currentDraw,
    nextDraw,
    recentAssignments: recentResult.results.map((row) => assignmentPayload(row, userId)),
    myAssignments: mineResult.results.map((row) => assignmentPayload(row, userId)),
  };
}

function randomMember(members: MemberRow[]) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return members[random[0] % members.length];
}

export async function drawAssignment(
  env: Env,
  roomId: string,
  userId: string,
  body: Record<string, unknown>,
  appOrigin: string,
  taskGenerator: TaskGenerator = requestOpenRouterTask,
) {
  const access = await roomAccess(env, roomId, userId);
  requireManager(access.role);
  if (body.kind !== "current" && body.kind !== "next") {
    throw new AppError("INVALID_TASK_KIND", 400);
  }
  const kind = body.kind;
  const meeting = kind === "current" ? await activeMeeting(env, roomId) : null;
  if (kind === "current" && !meeting) throw new AppError("MEETING_NOT_ACTIVE", 409);
  const scopeId = kind === "current" ? meeting!.id : roomId;
  let members = await activeMembers(env, roomId);
  if (!members.length) throw new AppError("NO_ROOM_MEMBERS", 409);

  const recentTasks = await env.DB.prepare(`
    SELECT task_en
    FROM assignments
    WHERE room_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 12
  `).bind(roomId).all<{ task_en: string }>();
  const generated = await taskGenerator(
    env,
    kind,
    recentTasks.results.map((row) => row.task_en),
    appOrigin,
  );

  const refreshedAccess = await roomAccess(env, roomId, userId);
  requireManager(refreshedAccess.role);

  for (let attempt = 0; attempt < Math.max(3, members.length + 1); attempt += 1) {
    members = await activeMembers(env, roomId);
    if (!members.length) throw new AppError("NO_ROOM_MEMBERS", 409);
    const rows = await cycleRows(env, kind, scopeId);
    const snapshot = cycleSnapshot(rows, members);
    let cycleNumber = snapshot.cycleNumber;
    let eligible = members.filter((member) => !snapshot.assignedIds.has(member.id));
    if (!eligible.length) {
      cycleNumber += 1;
      eligible = [...members];
      const previousParticipantId = rows[0]?.participant_user_id;
      if (eligible.length > 1 && previousParticipantId) {
        eligible = eligible.filter((member) => member.id !== previousParticipantId);
      }
    }
    const participant = randomMember(eligible);
    const assignmentId = crypto.randomUUID();
    try {
      const insert = kind === "current"
        ? env.DB.prepare(`
          INSERT INTO assignments (
            id, room_id, meeting_id, kind, cycle_number,
            participant_user_id, assigned_by_user_id,
            task_en, task_ru, model
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM room_members
            WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
          ) AND EXISTS (
            SELECT 1 FROM meetings
            WHERE id = ? AND room_id = ? AND status = 'active'
          )
        `).bind(
          assignmentId,
          roomId,
          scopeId,
          kind,
          cycleNumber,
          participant.id,
          userId,
          generated.taskEn,
          generated.taskRu,
          generated.model,
          roomId,
          participant.id,
          scopeId,
          roomId,
        )
        : env.DB.prepare(`
        INSERT INTO assignments (
          id, room_id, meeting_id, kind, cycle_number,
          participant_user_id, assigned_by_user_id,
          task_en, task_ru, model
        )
        SELECT ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM room_members
          WHERE room_id = ? AND user_id = ? AND removed_at IS NULL
        )
      `).bind(
          assignmentId,
          roomId,
          kind,
          cycleNumber,
          participant.id,
          userId,
          generated.taskEn,
          generated.taskRu,
          generated.model,
          roomId,
          participant.id,
        );
      const result = await insert.all();
      if (Number(result.meta.changes) !== 1) {
        if (kind === "current") {
          const stillActive = await activeMeeting(env, roomId);
          if (stillActive?.id !== scopeId) throw new AppError("MEETING_NOT_ACTIVE", 409);
        }
        continue;
      }
      const assignment = await assignmentById(env, assignmentId);
      if (!assignment) throw new AppError("ASSIGNMENT_CREATE_FAILED", 500);
      return {
        assignment: assignmentPayload(assignment, userId),
        state: await listAssignments(env, roomId, userId),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (/assignments_(?:current|next)_cycle_participant|unique.*assignments/i.test(message)) {
        continue;
      }
      throw new AppError("ASSIGNMENT_CREATE_FAILED", 500, { cause: error });
    }
  }

  throw new AppError("ASSIGNMENT_CONFLICT", 409, { retryable: true });
}
