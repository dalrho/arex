import React from "react";
import Link from "next/link";

/**
 * Landing Page ("/")
 * This is the public entry point of Sentinel OS.
 * Features a modern premium aesthetic redirecting users to login or dashboard.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-brand-900 text-white p-6">
      <div className="max-w-2xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-brand-100 text-xs font-semibold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          FDA 21 CFR Part 11 Regulatory Intelligence
        </div>
        
        <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl bg-gradient-to-r from-white via-slate-200 to-brand-100 bg-clip-text text-transparent">
          Welcome to Sentinel OS
        </h1>
        
        <p className="text-lg text-slate-300">
          Enforcing safety-critical compliance through decoupled agentic LLM remediation and deterministic database audit logs.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-all shadow-lg hover:shadow-blue-600/20"
          >
            Access Platform
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-slate-700 hover:bg-slate-800/40 text-sm font-semibold transition-all"
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
