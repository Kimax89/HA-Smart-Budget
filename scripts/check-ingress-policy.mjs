import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const base = "http://budget-ci:8099";
const administrator = {
  "X-Remote-User-Id": "admin",
  "X-Remote-User-Groups": "system-admin",
};
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    ready = (await fetch(`${base}/api/health`, { headers: administrator })).ok;
    if (ready) break;
  } catch {
    /* Wait for the restarted container. */
  }
  await setTimeout(500);
}
assert.ok(ready, "Administrator can access restarted container");
const before = await (
  await fetch(`${base}/api/months/2030-01`, { headers: administrator })
).json();
for (const headers of [
  {},
  { "X-Remote-User-Id": "regular", "X-Remote-User-Groups": "system-users" },
  { "X-Remote-User-Groups": "system-admin" },
]) {
  for (const route of [
    "/",
    "/app.js",
    "/api/health",
    "/api/ledger?year=2030",
    "/api/months/2030-01",
  ]) {
    assert.equal((await fetch(base + route, { headers })).status, 403, route);
  }
  for (const [route, method] of [
    ["/api/months/2030-01", "PUT"],
    ["/api/months/2030-01/close", "POST"],
    ["/api/months/2030-01/reopen", "POST"],
  ]) {
    assert.equal(
      (
        await fetch(base + route, {
          method,
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "X-Budget-Request": "1",
          },
          body: JSON.stringify({
            state: before.state,
            revision: before.revision,
          }),
        })
      ).status,
      403,
    );
  }
}
const after = await (
  await fetch(`${base}/api/months/2030-01`, { headers: administrator })
).json();
assert.equal(after.revision, before.revision);
assert.deepEqual(after.state, before.state);
assert.equal(
  (
    await fetch(`${base}/api/months/2030-01`, {
      method: "PUT",
      headers: {
        ...administrator,
        "Content-Type": "application/json",
        "X-Budget-Request": "1",
      },
      body: JSON.stringify({ state: before.state, revision: before.revision }),
    })
  ).status,
  200,
);
console.log(
  "Ingress administrator policy protects pages, API reads and writes; administrator writes succeed.",
);
