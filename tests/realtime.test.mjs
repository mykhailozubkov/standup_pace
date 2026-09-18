import assert from "node:assert/strict";
import test from "node:test";
import { publishRoomEvent, RoomSync } from "../src/realtime.ts";

test("broadcasts a validated room event to every connected socket", async () => {
  const messages = [];
  const state = {
    getWebSockets() {
      return [
        { send: (message) => messages.push(message), close() {} },
        { send: (message) => messages.push(message), close() {} },
      ];
    },
  };
  const hub = new RoomSync(state, {});
  const event = {
    id: "event-1",
    roomId: "688285e9-dbea-4b57-bf5c-a283ccca9716",
    type: "speech.updated",
    createdAt: Date.now(),
  };

  const response = await hub.fetch(new Request("https://room-sync.internal/broadcast", {
    method: "POST",
    body: JSON.stringify(event),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { delivered: 2 });
  assert.deepEqual(messages.map(JSON.parse), [event, event]);
});

test("rejects malformed internal room events", async () => {
  const hub = new RoomSync({ getWebSockets: () => [] }, {});
  const response = await hub.fetch(new Request("https://room-sync.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({ type: "unknown" }),
  }));

  assert.equal(response.status, 400);
});

test("normalizes a WebSocket close without a status code", () => {
  const closes = [];
  const hub = new RoomSync({ getWebSockets: () => [] }, {});

  hub.webSocketClose({ close: (...args) => closes.push(args) }, 1005, "");

  assert.deepEqual(closes, [[1000, ""]]);
});

test("publishes room changes through the room-specific Durable Object", async () => {
  const calls = [];
  const env = {
    ROOM_SYNC: {
      getByName(roomId) {
        calls.push({ roomId });
        return {
          async fetch(url, init) {
            calls.push({ url, event: JSON.parse(init.body) });
            return Response.json({ delivered: 0 });
          },
        };
      },
    },
  };

  await publishRoomEvent(env, "room-1", "meeting.updated");

  assert.equal(calls[0].roomId, "room-1");
  assert.equal(calls[1].url, "https://room-sync.internal/broadcast");
  assert.equal(calls[1].event.roomId, "room-1");
  assert.equal(calls[1].event.type, "meeting.updated");
  assert.match(calls[1].event.id, /^[0-9a-f-]{36}$/);
});
