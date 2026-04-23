const baseUrl = process.env.BASE_URL || "http://localhost:3001";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function request(path, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { response, json, text };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActivity(activityId, cookie, attempts = 16) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const listedActivities = await request("/api/activities", {}, cookie);
    if (Array.isArray(listedActivities.json) && listedActivities.json.some((item) => item.id === activityId)) {
      return listedActivities;
    }
    await sleep(250 * (attempt + 1));
  }

  throw new Error("Created activity not returned by list API");
}

async function main() {
  console.log(`Smoke test against ${baseUrl}`);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sales", password: "sales" }),
  });
  assert(login.response.ok, `Login failed: ${login.response.status}`);
  const cookie = parseSetCookie(login.response.headers.get("set-cookie"));
  assert(cookie.includes("sevencars_session="), "Missing session cookie from login");

  const me = await request("/api/auth/me", {
    headers: { Cookie: cookie },
  });
  assert(me.response.ok, `/api/auth/me failed: ${me.response.status}`);
  assert(me.json?.username === "sales", "Unexpected authenticated username");

  const initialActivities = await request("/api/activities", {}, cookie);
  assert(initialActivities.response.ok, "GET /api/activities failed");
  const beforeActivityCount = Array.isArray(initialActivities.json) ? initialActivities.json.length : 0;

  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const createdActivity = await request("/api/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Smoke Activity",
      note: "calendar verification",
      startsAt,
      department: "sales",
    }),
  }, cookie);
  assert(createdActivity.response.status === 201, `Create activity failed: ${createdActivity.response.status}`);
  const activityId = createdActivity.json?.id;
  assert(activityId, "Created activity missing id");

  await waitForActivity(activityId, cookie);

  const updatedActivity = await request(`/api/activities/${activityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Smoke Activity Updated",
      status: "done",
    }),
  }, cookie);
  assert(updatedActivity.response.ok, `Update activity failed: ${updatedActivity.response.status}`);
  assert(updatedActivity.json?.status === "done", "Activity status did not update");

  const uploadedDoc = await (async () => {
    const form = new FormData();
    form.set("leadId", "showroom-smoke");
    form.set("file", new Blob(["smoke-contract"], { type: "text/plain" }), "contract.txt");
    const upload = await fetch(`${baseUrl}/api/lead-documents`, { method: "POST", body: form, headers: { Cookie: cookie } });
    const json = await upload.json();
    if (upload.status === 503) {
      console.log("Document upload unavailable in this environment; continuing without upload assertion.");
      return null;
    }
    assert(upload.ok, `Document upload failed: ${upload.status}`);
    assert(json?.url, "Uploaded document missing url");
    return json;
  })();

  const createdLead = await request("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Smoke Showroom Client",
      phone: "+359880000001",
      vehicleRequest: "BMW X5 2022",
      handoverDepartment: "showroom",
      brand: "BMW",
      model: "X5",
      firstRegistrationDate: "2022",
      engine: "3.0D",
      mileage: "45000",
      vin: "SMOKEVIN000000001",
      serviceOfferDetails: "Full history",
      purchaseLocation: "Germany",
      warranty: "Yes",
      inspection: "Yes",
      tiresInfo: "Winter + Summer",
      addonOther: "Smoke lead description",
      showroomOwnership: "Client",
      showroomReserved: "Yes",
      showroomSold: "No",
      showroomContract: uploadedDoc ? [uploadedDoc] : [],
      insuranceGoPrice: "500",
      insuranceCascoPrice: "1200",
      lastUpdatedBy: "sales",
    }),
  }, cookie);
  assert(createdLead.response.status === 201, `Create showroom lead failed: ${createdLead.response.status}`);
  const leadId = createdLead.json?.id;
  assert(leadId, "Created lead missing id");

  const showroomLeads = await request("/api/leads?department=showroom&limit=5000", {}, cookie);
  assert(showroomLeads.response.ok, "GET showroom leads failed");
  const createdShowroomLead = Array.isArray(showroomLeads.json) ? showroomLeads.json.find((item) => item.id === leadId) : null;
  assert(createdShowroomLead, "Created showroom lead missing from showroom list");
  assert(createdShowroomLead.showroomOwnership === "Client", "Showroom ownership was not saved");
  if (uploadedDoc) {
    assert(createdShowroomLead.showroomContract?.length === 1, "Showroom contract was not saved");
  }

  const updatedLead = await request(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      showroomSold: "Yes",
      showroomReserved: "No",
      lastUpdatedBy: "sales",
    }),
  }, cookie);
  assert(updatedLead.response.ok, `Update showroom lead failed: ${updatedLead.response.status}`);
  assert(updatedLead.json?.showroomSold === "Yes", "Showroom sold flag did not update");

  const deletedLead = await request(`/api/leads/${leadId}`, { method: "DELETE" }, cookie);
  assert(deletedLead.response.ok, `Delete showroom lead failed: ${deletedLead.response.status}`);

  await sleep(250);
  const deletedActivity = await request(`/api/activities/${activityId}`, { method: "DELETE" }, cookie);
  assert(deletedActivity.response.ok, `Delete activity failed: ${deletedActivity.response.status}`);
  const afterDeleteActivities = await request("/api/activities", {}, cookie);
  assert(
    Array.isArray(afterDeleteActivities.json) && !afterDeleteActivities.json.some((item) => item.id === activityId),
    "Deleted activity still present in list",
  );
  const showroomLeadsAfterDelete = await request("/api/leads?department=showroom&limit=5000", {}, cookie);
  assert(
    Array.isArray(showroomLeadsAfterDelete.json) && !showroomLeadsAfterDelete.json.some((item) => item.id === leadId),
    "Deleted showroom lead still present in showroom list",
  );

  console.log(JSON.stringify({
    login: "ok",
    authMe: "ok",
    activitiesBefore: beforeActivityCount,
    leadCreated: leadId,
    activityCreated: activityId,
    showroomListVerified: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
