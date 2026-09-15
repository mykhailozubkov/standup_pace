import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps Worker routing in control of protected HTML pages", async () => {
  const configUrl = new URL("../wrangler.jsonc", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));

  assert.equal(config.assets?.run_worker_first, true);
  assert.equal(config.assets?.html_handling, "none");
  assert.equal(config.workers_dev, true);
});
