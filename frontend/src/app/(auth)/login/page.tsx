"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, setSession } from "@/lib/apiClient";
import { FadeIn } from "@/components/ui/FadeIn";

/**
 * Login Page ("/login")
 * Part of the (auth) route group. Authenticates against the backend and
 * stores the JWT + user (role, org_id) for tenant-scoped API calls.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setSession(result.access_token, result.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <FadeIn onMount direction="down" className="px-6 py-4">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          &larr; Back to Home
        </Link>
      </FadeIn>
      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8 pb-8">
        <FadeIn onMount delay={80} className="w-full max-w-md">
          <div className="space-y-8 bg-slate-950/50 p-8 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md motion-safe:transition-shadow motion-safe:duration-500 hover:shadow-2xl hover:shadow-blue-950/20">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
                Sign in to Sentinel OS
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Secure multi-tenant workspace login
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4 rounded-md shadow-sm">
                <FadeIn onMount delay={180}>
                  <div>
                    <label htmlFor="email-address" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="relative block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-3 text-white placeholder-slate-500 transition-colors focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                      placeholder="Email address"
                    />
                  </div>
                </FadeIn>
                <FadeIn onMount delay={260}>
                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="relative block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-3 text-white placeholder-slate-500 transition-colors focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                      placeholder="Password"
                    />
                  </div>
                </FadeIn>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 motion-safe:animate-fade-in">
                  {error}
                </div>
              )}

              <FadeIn onMount delay={340}>
                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? "Signing in..." : "Sign In"}
                  </button>
                </div>
              </FadeIn>
            </form>
            <FadeIn onMount delay={420}>
              <div className="text-center text-xs text-slate-500 mt-4">
                By signing in, you agree to the FDA 21 CFR Part 11 auditing regulations.
              </div>
            </FadeIn>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
