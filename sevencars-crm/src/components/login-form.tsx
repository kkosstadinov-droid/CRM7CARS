"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Invalid username or password.");
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto w-full max-w-md space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Image
          src="/7cars-logo.svg"
          alt="7CARS logo"
          width={110}
          height={40}
          unoptimized
          priority
          className="h-auto w-[110px] shrink-0 object-contain"
        />
        <h1 className="brand-title text-2xl font-bold">CRM Login</h1>
      </div>
      <p className="text-sm text-gray-600">Sign in with your profile credentials.</p>

      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Sales"
          autoComplete="username"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Sales"
          autoComplete="current-password"
        />
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button type="submit" disabled={isLoading} className="brand-btn w-full px-4 py-2 disabled:opacity-60">
        {isLoading ? "Signing in..." : "Sign in"}
      </button>

      <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
        Use the credentials provided by your CRM administrator.
      </p>
    </form>
  );
}

