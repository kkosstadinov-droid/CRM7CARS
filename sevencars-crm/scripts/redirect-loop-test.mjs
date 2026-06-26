import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const middleware = await readFile("middleware.ts", "utf8");

assert.match(middleware, /PUBLIC_PATHS = \["\/login"/, "middleware must keep /login public");
assert.doesNotMatch(
  middleware,
  /pathname === "\/login"[\s\S]{0,160}NextResponse\.redirect\(new URL\("\/"/,
  "/login must not redirect to / just because sevencars_session cookie exists; stale cookies cause ERR_TOO_MANY_REDIRECTS",
);
assert.match(
  middleware,
  /NextResponse\.next\(\)/,
  "middleware should allow /login to render so users can recover from stale cookies",
);

console.log(JSON.stringify({ ok: true, behavior: "/login renders even when a stale session cookie exists" }, null, 2));
