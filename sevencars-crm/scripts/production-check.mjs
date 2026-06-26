const baseUrl = process.env.BASE_URL || "https://sevencars-crm.vercel.app";
const expectedUsers = [
  ["admin", "Admin", "stats"],
  ["boss", "Boss", "stats"],
  ["boss1", "Boss", "stats"],
  ["sales", "Sales", "pipeline"],
  ["sales1", "Sales", "pipeline"],
  ["sales2", "Sales", "pipeline"],
  ["sales3", "Sales", "pipeline"],
  ["accountmanager", "AccountManager", "pipeline"],
  ["accountmanager1", "AccountManager", "pipeline"],
  ["accountmanager2", "AccountManager", "pipeline"],
  ["accountmanager3", "AccountManager", "pipeline"],
  ["accountmanager4", "AccountManager", "pipeline"],
  ["accountmanager5", "AccountManager", "pipeline"],
  ["teamleadam", "TeamLeadAM", "pipeline"],
  ["operationmanager", "OperationManager", "stats"],
  ["operationmanager1", "OperationManager", "stats"],
  ["logistics", "Logistics", "pipeline"],
  ["logistics1", "Logistics", "pipeline"],
  ["service", "Service", "pipeline"],
  ["service1", "Service", "pipeline"],
  ["insurance", "Insurance", "pipeline"],
  ["insurance1", "Insurance", "pipeline"],
  ["showroom", "Showroom", "pipeline"],
  ["showroom1", "Showroom", "pipeline"],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function request(pathname, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { response, json, text };
}

async function login(username, password = username) {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert(result.response.ok, `Login failed for ${username}: ${result.response.status}`);
  const cookie = parseSetCookie(result.response.headers.get("set-cookie"));
  assert(cookie.includes("sevencars_session="), `Missing session cookie for ${username}`);
  return cookie;
}

const adminCookie = await login("admin");
const usersResult = await request("/api/admin/users", {}, adminCookie);
assert(usersResult.response.ok, `Admin users endpoint failed: ${usersResult.response.status}`);
const users = Array.isArray(usersResult.json) ? usersResult.json : [];
const byUsername = new Map(users.map((user) => [user.username, user]));

for (const [username, role, dashboardPreset] of expectedUsers) {
  const user = byUsername.get(username);
  assert(user, `Missing expected user ${username}`);
  assert(user.role === role, `${username} role mismatch: expected ${role}, got ${user.role}`);
  assert(user.dashboardPreset === dashboardPreset, `${username} dashboard preset mismatch: expected ${dashboardPreset}, got ${user.dashboardPreset}`);
  assert(user.mustChangePassword === true, `${username} should require password change`);
}

const roleChecks = [];
for (const username of ["admin", "boss", "operationmanager", "sales", "accountmanager", "showroom1"]) {
  const cookie = await login(username);
  const me = await request("/api/auth/me", {}, cookie);
  assert(me.response.ok, `/api/auth/me failed for ${username}: ${me.response.status}`);
  const adminUsers = await request("/api/admin/users", {}, cookie);
  const auditLog = await request("/api/audit-log?limit=5", {}, cookie);
  roleChecks.push({ username, role: me.json.role, adminUsers: adminUsers.response.status, auditLog: auditLog.response.status });
}

for (const check of roleChecks) {
  if (["Admin", "Boss", "OperationManager"].includes(check.role)) {
    assert(check.adminUsers === 200, `${check.username} should see admin users`);
    assert(check.auditLog === 200, `${check.username} should see audit log`);
  } else {
    assert(check.adminUsers === 403, `${check.username} should not see admin users`);
    assert(check.auditLog === 403, `${check.username} should not see audit log`);
  }
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  expectedUsers: expectedUsers.length,
  productionUsers: users.length,
  roleChecks,
}, null, 2));
