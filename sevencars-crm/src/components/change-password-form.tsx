"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Попълни всички полета.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Новата парола и потвърждението не съвпадат.");
      return;
    }
    if (newPassword.length < 4) {
      setError("Новата парола трябва да е поне 4 символа.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Неуспешна смяна на парола.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Паролата е сменена успешно.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2">
      <button type="button" className="mini-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "Скрий парола" : "Смени парола"}
      </button>
      {open ? (
        <div className="mt-2 min-w-72 space-y-2">
          <label className="block">
            <span className="field-label">Текуща парола</span>
            <input type="password" className="brand-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">Нова парола</span>
            <input type="password" className="brand-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">Потвърди нова парола</span>
            <input type="password" className="brand-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          {success ? <p className="text-xs text-green-700">{success}</p> : null}
          <button type="button" className="brand-btn w-full px-3 py-2 text-sm" onClick={() => void submit()} disabled={saving}>
            {saving ? "Запис..." : "Запази"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
