const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const resetExistingPasswords = args.has("--reset-existing-passwords");
const baseUrl = process.env.BASE_URL || "https://sevencars-crm.vercel.app";
const adminUsername = process.env.CRM_ADMIN_USERNAME || "admin";
const adminPassword = process.env.CRM_ADMIN_PASSWORD || "admin";

const desiredUsers = Object.freeze([
  { username: "admin", role: "Admin", dashboardPreset: "stats", keep: true },
  { username: "boss", role: "Boss", dashboardPreset: "stats", keep: true },
  { username: "boss1", role: "Boss", dashboardPreset: "stats" },
  { username: "sales", role: "Sales", dashboardPreset: "pipeline" },
  { username: "sales1", role: "Sales", dashboardPreset: "pipeline" },
  { username: "sales2", role: "Sales", dashboardPreset: "pipeline" },
  { username: "sales3", role: "Sales", dashboardPreset: "pipeline" },
  { username: "accountmanager", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "accountmanager1", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "accountmanager2", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "accountmanager3", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "accountmanager4", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "accountmanager5", role: "AccountManager", dashboardPreset: "pipeline" },
  { username: "teamleadam", role: "TeamLeadAM", dashboardPreset: "pipeline" },
  { username: "operationmanager", role: "OperationManager", dashboardPreset: "stats" },
  { username: "operationmanager1", role: "OperationManager", dashboardPreset: "stats" },
  { username: "logistics", role: "Logistics", dashboardPreset: "pipeline" },
  { username: "logistics1", role: "Logistics", dashboardPreset: "pipeline" },
  { username: "service", role: "Service", dashboardPreset: "pipeline" },
  { username: "service1", role: "Service", dashboardPreset: "pipeline" },
  { username: "insurance", role: "Insurance", dashboardPreset: "pipeline" },
  { username: "insurance1", role: "Insurance", dashboardPreset: "pipeline" },
  { username: "showroom", role: "Showroom", dashboardPreset: "pipeline" },
  { username: "showroom1", role: "Showroom", dashboardPreset: "pipeline" },
]);

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

async function login() {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assert(result.response.ok, `Admin login failed: ${result.response.status}`);
  const cookie = parseSetCookie(result.response.headers.get("set-cookie"));
  assert(cookie.includes("sevencars_session="), "Admin login did not return a CRM session cookie");
  return cookie;
}

async function main() {
  if (dryRun) {
    console.log(JSON.stringify({
      mode: "dry-run",
      baseUrl,
      adminUsername,
      desiredCount: desiredUsers.length,
      resetExistingPasswords,
      desiredUsers: desiredUsers.map(({ username, role, dashboardPreset, keep }) => ({ username, role, dashboardPreset, keep: Boolean(keep) })),
      note: "No network write was performed. In real mode, missing users are created with temporary password equal to username and mustChangePassword=true.",
    }, null, 2));
    return;
  }

  const cookie = await login();
  const usersResult = await request("/api/admin/users", {}, cookie);
  assert(usersResult.response.ok, `List users failed: ${usersResult.response.status}`);
  const currentUsers = Array.isArray(usersResult.json) ? usersResult.json : [];
  const byUsername = new Map(currentUsers.map((user) => [user.username, user]));
  const created = [];
  const updated = [];
  const passwordReset = [];
  const unchanged = [];

  for (const desired of desiredUsers) {
    const existing = byUsername.get(desired.username);
    if (!existing) {
      const createdResult = await request("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: desired.username,
          password: desired.username,
          role: desired.role,
          dashboardPreset: desired.dashboardPreset,
        }),
      }, cookie);
      assert(createdResult.response.ok, `Create ${desired.username} failed: ${createdResult.response.status} ${createdResult.text}`);
      created.push(desired.username);
      continue;
    }

    const needsUpdate = existing.role !== desired.role || existing.dashboardPreset !== desired.dashboardPreset || existing.mustChangePassword !== true;
    if (needsUpdate) {
      const updateResult = await request(`/api/admin/users/${encodeURIComponent(desired.username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: desired.role,
          dashboardPreset: desired.dashboardPreset,
          mustChangePassword: true,
        }),
      }, cookie);
      assert(updateResult.response.ok, `Update ${desired.username} failed: ${updateResult.response.status} ${updateResult.text}`);
      updated.push(desired.username);
    } else {
      unchanged.push(desired.username);
    }

    if (resetExistingPasswords) {
      const resetResult = await request(`/api/admin/users/${encodeURIComponent(desired.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", newPassword: desired.username }),
      }, cookie);
      assert(resetResult.response.ok, `Reset password ${desired.username} failed: ${resetResult.response.status} ${resetResult.text}`);
      passwordReset.push(desired.username);
    }
  }

  const verify = await request("/api/admin/users", {}, cookie);
  assert(verify.response.ok, `Verify users failed: ${verify.response.status}`);
  const finalUsers = Array.isArray(verify.json) ? verify.json : [];
  const finalNames = new Set(finalUsers.map((user) => user.username));
  const missing = desiredUsers.map((user) => user.username).filter((username) => !finalNames.has(username));
  assert(missing.length === 0, `Missing users after provisioning: ${missing.join(", ")}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    desiredCount: desiredUsers.length,
    finalUserCount: finalUsers.length,
    created,
    updated,
    passwordReset,
    unchanged,
    note: "Temporary password policy for placeholder users: password=username; mustChangePassword=true.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
