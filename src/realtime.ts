import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

export const ROOM_EVENT_TYPES = [
  "room.updated",
  "membership.updated",
  "meeting.updated",
  "speech.updated",
  "assignment.updated",
] as const;

export type RoomEventType = typeof ROOM_EVENT_TYPES[number];

interface RoomEvent {
  id: string;
  roomId: string;
  type: RoomEventType;
  createdAt: number;
}

function isRoomEvent(value: unknown): value is RoomEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<RoomEvent>;
  return typeof event.id === "string"
    && typeof event.roomId === "string"
    && typeof event.createdAt === "number"
    && ROOM_EVENT_TYPES.includes(event.type as RoomEventType);
}

export class RoomSync {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/broadcast") {
      const text = await request.text();
      if (text.length > 2_048) return new Response("Event is too large", { status: 413 });

      let event: unknown;
      try {
        event = JSON.parse(text);
      } catch {
        return new Response("Invalid event", { status: 400 });
      }
      if (!isRoomEvent(event)) return new Response("Invalid event", { status: 400 });

      const message = JSON.stringify(event);
      let delivered = 0;
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(message);
          delivered += 1;
        } catch {
          try {
            socket.close(1011, "Delivery failed");
          } catch {
            // The runtime may already have closed this socket.
          }
        }
      }
      return Response.json({ delivered });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") socket.send("pong");
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    try {
      socket.close(code === 1005 ? 1000 : code, reason);
    } catch {
      // The runtime may already have completed the closing handshake.
    }
  }

  webSocketError(socket: WebSocket) {
    try {
      socket.close(1011, "WebSocket error");
    } catch {
      // The runtime may already have closed this socket.
    }
  }
}

function roomSync(env: Env, roomId: string) {
  if (!env.ROOM_SYNC) throw new AppError("REALTIME_NOT_CONFIGURED", 503);
  return env.ROOM_SYNC.getByName(roomId);
}

export function connectRoomSocket(env: Env, roomId: string, request: Request) {
  return roomSync(env, roomId).fetch(request);
}

export async function publishRoomEvent(
  env: Env,
  roomId: string,
  type: RoomEventType,
) {
  if (!env.ROOM_SYNC) return;

  const event: RoomEvent = {
    id: crypto.randomUUID(),
    roomId,
    type,
    createdAt: Date.now(),
  };

  try {
    const response = await roomSync(env, roomId).fetch("https://room-sync.internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) console.warn(`Room event broadcast returned ${response.status}`);
  } catch (error) {
    console.warn("Room event broadcast failed", error);
  }
}
