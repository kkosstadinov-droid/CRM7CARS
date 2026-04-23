const baseUrl = process.env.BASE_URL || "http://localhost:3001";
const batchSize = Number.parseInt(process.env.STRESS_BATCH_SIZE || "20", 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { response, json };
}

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActivity(id, withCookie, attempts = 16) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const listed = await jsonRequest("/api/activities", withCookie());
    assert(listed.response.ok, "List activities failed during stress test");
    const found = Array.isArray(listed.json) ? listed.json.find((item) => item.id === id) : null;
    if (found) return found;
    await sleep(250 * (attempt + 1));
  }

  throw new Error(`Missing created activity ${id} after ${attempts} list attempts.`);
}

async function main() {
  console.log(`Stress test against ${baseUrl} with batchSize=${batchSize}`);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sales", password: "sales" }),
  });
  assert(login.ok, `Login failed before stress test: ${login.status}`);
  const cookie = parseSetCookie(login.headers.get("set-cookie"));
  const withCookie = (init = {}) => ({
    ...init,
    headers: {
      ...(init.headers || {}),
      Cookie: cookie,
    },
  });

  let created = 0;
  let listed = 0;
  let patched = 0;
  let leadReads = 0;
  let deleted = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const create = await jsonRequest(
      "/api/activities",
      withCookie({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Stress Activity ${index + 1}`,
          note: `batch-${index + 1}`,
          startsAt: new Date(Date.now() + (index + 1) * 60_000).toISOString(),
          department: index % 2 === 0 ? "sales" : "account",
        }),
      }),
    );
    assert(create.response.status === 201, `Create failed at index ${index}: ${create.response.status}`);
    created += 1;

    const activityId = create.json?.id;
    assert(activityId, `Create response missing id at index ${index}`);

    await waitForActivity(activityId, withCookie);
    listed += 1;

    const patch = await jsonRequest(
      `/api/activities/${activityId}`,
      withCookie({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: index % 2 === 0 ? "done" : "planned" }),
      }),
    );
    assert(patch.response.ok, `Patch failed at index ${index}: ${patch.response.status}`);
    patched += 1;

    const reads = await Promise.all(
      Array.from({ length: 3 }, () => jsonRequest("/api/leads?limit=200", withCookie())),
    );
    reads.forEach(({ response }, readIndex) => {
      assert(response.ok, `Lead list failed at cycle ${index}, read ${readIndex}: ${response.status}`);
    });
    leadReads += reads.length;

    const remove = await jsonRequest(`/api/activities/${activityId}`, withCookie({ method: "DELETE" }));
    assert(remove.response.ok, `Delete failed at index ${index}: ${remove.response.status}`);
    deleted += 1;
  }

  console.log(JSON.stringify({ created, listed, patched, leadReads, deleted }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
