import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps Worker routing in control of protected HTML pages", async () => {
  const configUrl = new URL("../wrangler.jsonc", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));

  assert.equal(config.main, "src/worker.ts");
  assert.equal(config.assets?.run_worker_first, true);
  assert.equal(config.assets?.html_handling, "none");
  assert.equal(config.workers_dev, true);
  assert.ok(config.compatibility_flags.includes("nodejs_compat"));
  assert.equal(config.d1_databases?.[0]?.binding, "DB");
  assert.deepEqual(config.durable_objects?.bindings, [{
    name: "ROOM_SYNC",
    class_name: "RoomSync",
  }]);
  assert.deepEqual(config.migrations?.[0]?.new_sqlite_classes, ["RoomSync"]);
});
