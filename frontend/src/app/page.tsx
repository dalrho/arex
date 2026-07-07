import React from "react";
import Image from "next/image";
import Link from "next/link";

const BRAND_LOGO_SRC = "/brand/sentinel-os-logo.svg";

/**
 * Landing Page ("/")
 * This is the public entry point of Sentinel OS.
 * Features a modern premium aesthetic redirecting users to login or dashboard.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-brand-900 text-white p-6">
      <div className="max-w-2xl text-center space-y-8">
        <div className="opacity-0 motion-safe:animate-scale-in">
          <Image
            src={BRAND_LOGO_SRC}
            alt="Sentinel OS"
            width={96}
            height={96}
            priority
            className="mx-auto h-24 w-24 rounded-3xl shadow-2xl shadow-blue-950/40 motion-safe:animate-subtle-float motion-safe:[animation-delay:700ms]"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-brand-100 text-xs font-semibold tracking-wide opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          FDA 21 CFR Part 11 Regulatory Intelligence
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl bg-gradient-to-r from-white via-slate-200 to-brand-100 bg-clip-text text-transparent opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:220ms]">
          Welcome to Sentinel OS
        </h1>

        <p className="text-lg text-slate-300 opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:340ms]">
          Enforcing safety-critical compliance through decoupled agentic LLM remediation and deterministic database audit logs.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:460ms]">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-all shadow-lg hover:shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            Access Platform
          </Link>
          <Link
            href="/about"
            className="px-6 py-3 rounded-lg border border-slate-700 hover:bg-slate-800/40 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            About Sentinel OS
          </Link>
        </div>
      </div>
    </main>
  );
}
