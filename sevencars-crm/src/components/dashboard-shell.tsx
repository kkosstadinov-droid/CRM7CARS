"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { AppRole, DashboardPreset } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { BossDashboard } from "@/components/boss-dashboard";
import { ChangePasswordForm } from "@/components/change-password-form";
import { CrmWorkspace } from "@/components/crm-workspace";
import { LogoutButton } from "@/components/logout-button";
import { SalesDashboard } from "@/components/sales-dashboard";
import { canSeeDashboard } from "@/lib/permissions.mjs";

const profileOptions: AppRole[] = ["Boss", "Sales", "Showroom", "AccountManager", "TeamLeadAM", "OperationManager", "Logistics", "Service", "Insurance"];
const showroomAccessRoles: AppRole[] = ["Sales", "AccountManager", "TeamLeadAM", "Logistics", "Service", "Insurance"];

export function DashboardShell({
  activeRole,
  activeUsername,
  activeDashboardPreset,
}: {
  activeRole: AppRole;
  activeUsername: string;
  activeDashboardPreset: DashboardPreset;
}) {
  const canShowroomSwitch = showroomAccessRoles.includes(activeRole);
  const canProfileSwitch = activeRole === "OperationManager" || activeRole === "Boss" || canShowroomSwitch;
  const defaultRole = activeRole === "Boss" ? "Boss" : activeRole;
  const [profileRole, setProfileRole] = useState<AppRole>(() => {
    if (typeof window === "undefined") return defaultRole;
    const forcedProfile = new URLSearchParams(window.location.search).get("profile");
    if (forcedProfile && profileOptions.includes(forcedProfile as AppRole)) {
      return forcedProfile as AppRole;
    }
    return defaultRole;
  });
  const opStatsPopupMode = useMemo(() => {
    if (activeRole !== "OperationManager") return false;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("opstats") === "1";
  }, [activeRole]);
  const standaloneShowroomAddLead = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("addLead") === "1" || params.get("showroomAddLead") === "1";
  }, []);
  const effectiveRole = canProfileSwitch ? profileRole : activeRole;
  const readOnlyView = (activeRole === "OperationManager" || activeRole === "Boss") && effectiveRole !== activeRole;

  const visibleOptions = useMemo(() => {
    if (activeRole === "Boss") return profileOptions;
    if (activeRole === "OperationManager") return profileOptions.filter((role) => role !== "Boss");
    if (canShowroomSwitch) return [activeRole, "Showroom"];
    return [activeRole];
  }, [activeRole, canShowroomSwitch]);

  const canUseManagementDashboard = canSeeDashboard({ username: activeUsername, role: activeRole });
  const useStatsByPreset = canUseManagementDashboard && activeDashboardPreset === "stats";
  const renderStats = canUseManagementDashboard && (effectiveRole === "Boss" || (!canProfileSwitch && useStatsByPreset) || (activeRole === "OperationManager" && opStatsPopupMode));

  if (standaloneShowroomAddLead && (effectiveRole === "Showroom" || effectiveRole === "Sales")) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:px-8">
        <SalesDashboard role={effectiveRole} readOnlyView={readOnlyView} username={activeUsername} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 md:px-8">
      <header className="card mb-6 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/7cars-logo.svg" alt="7CARS logo" width={124} height={44} />
            <div>
              <p className="text-sm font-semibold text-[#b98e10]">7CARS CRM</p>
              <h1 className="brand-title text-2xl font-bold tracking-tight md:text-3xl">Automotive Lifecycle Workspace</h1>
              <p className="text-xs text-gray-600">Signed in as: {activeUsername} ({activeRole})</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canProfileSwitch ? (
              <label className="min-w-52">
                <span className="field-label">Profile</span>
                <select value={profileRole} onChange={(e) => setProfileRole(e.target.value as AppRole)} className="brand-input">
                  {visibleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ChangePasswordForm />
            <LogoutButton />
          </div>
        </div>
      </header>

      {activeRole === "Admin" ? (
        <AdminDashboard activeUsername={activeUsername} />
      ) : renderStats ? (
        <BossDashboard />
      ) : effectiveRole === "Sales" || effectiveRole === "Showroom" || effectiveRole === "AccountManager" || effectiveRole === "TeamLeadAM" || effectiveRole === "Logistics" || effectiveRole === "Service" || effectiveRole === "Insurance" || effectiveRole === "OperationManager" ? (
        <SalesDashboard role={effectiveRole} readOnlyView={readOnlyView} username={activeUsername} />
      ) : (
        <CrmWorkspace role={effectiveRole} />
      )}
    </main>
  );
}
