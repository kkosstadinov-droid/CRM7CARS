"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="brand-btn px-3 py-2 text-sm disabled:opacity-60"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}

