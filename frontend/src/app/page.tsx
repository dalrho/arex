"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";

const BRAND_LOGO_SRC = "/brand/arex-logo.png";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace("/regulations");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-brand-900 p-6 text-white">
      <div className="max-w-2xl space-y-8 text-center">
        <div className="opacity-0 motion-safe:animate-scale-in">
          <Image
            src={BRAND_LOGO_SRC}
            alt="AREX"
            width={240}
            height={71}
            priority
            className="mx-auto h-auto w-44 object-contain drop-shadow-[0_18px_34px_rgba(14,116,233,0.28)] motion-safe:animate-subtle-float motion-safe:[animation-delay:700ms] md:w-56"
          />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100 opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          FDA 21 CFR Part 11 Regulatory Intelligence
        </div>

        <p className="text-lg text-slate-300 opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:340ms]">
          Enforcing safety-critical compliance through decoupled agentic LLM remediation and deterministic database audit logs.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 opacity-0 motion-safe:animate-fade-in-up motion-safe:[animation-delay:460ms]">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/20 active:translate-y-0"
          >
            Sign In
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-slate-800/40 active:translate-y-0"
          >
            About AREX
          </Link>
        </div>
      </div>
    </main>
  );
}
