import { cookies } from "next/headers";
import { getUser, isAppRole, parseSessionCookieValue, type DashboardPreset } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function Home() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const parsedSession = parseSessionCookieValue(sessionRaw);
  const user = parsedSession ? await getUser(parsedSession.username) : null;
  const activeRole = user?.role ?? (parsedSession?.role && isAppRole(parsedSession.role) ? parsedSession.role : "Admin");
  const activeUsername = user?.username ?? parsedSession?.username ?? "admin";
  const activeDashboardPreset: DashboardPreset = user?.dashboardPreset ?? (activeRole === "Boss" || activeRole === "OperationManager" ? "stats" : "pipeline");

  return <DashboardShell activeRole={activeRole} activeUsername={activeUsername} activeDashboardPreset={activeDashboardPreset} />;
}
