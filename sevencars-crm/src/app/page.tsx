import { cookies } from "next/headers";
import { getUser, parseSessionCookieValue, type DashboardPreset } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { redirect } from "next/navigation";

export default async function Home() {
  const sessionRaw = (await cookies()).get("sevencars_session")?.value;
  const parsedSession = parseSessionCookieValue(sessionRaw);
  const user = parsedSession ? await getUser(parsedSession.username) : null;
  if (!parsedSession || !user) redirect("/login");

  const activeRole = user.role;
  const activeUsername = user.username;
  const activeDashboardPreset: DashboardPreset = user?.dashboardPreset ?? (activeRole === "Boss" || activeRole === "OperationManager" ? "stats" : "pipeline");

  return <DashboardShell activeRole={activeRole} activeUsername={activeUsername} activeDashboardPreset={activeDashboardPreset} />;
}

