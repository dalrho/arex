"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardCheck,
  Files,
  LogOut,
  Menu,
  Scale,
  X,
  Cpu,
} from "lucide-react";
import clsx from "clsx";
import { clearSession, getCurrentUser, getAiStatus, type AIStatusResponse } from "@/lib/apiClient";
import type { AuthUser } from "@/types/api";

const BRAND_LOGO_SRC = "/brand/sentinel-os-logo.svg";

const navigation = [
  { label: "Regulations", href: "/regulations", icon: Scale },
  { label: "Documents", href: "/documents", icon: Files },
  { label: "Tasks", href: "/tasks", icon: ClipboardCheck },
];

// ---------------------------------------------------------------------------
// AI Mode Indicator — rendered inside the sidebar below the logo
// ---------------------------------------------------------------------------
function AIModePanel({ status }: { status: AIStatusResponse | null | "loading" }) {
  // Loading skeleton
  if (status === "loading") {
    return (
      <div className="mx-4 mb-1 mt-1 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-slate-600" />
        <div className="h-3 w-16 animate-pulse rounded bg-slate-700" />
      </div>
    );
  }

  const isOnline = status?.mode === "online";
  const modelShort = status?.model
    ? status.model.replace("models/", "").replace(/-/g, " ")
    : null;

  if (isOnline) {
    return (
      <div
        title={`Live AI | ${status?.model} | Embeddings: ${status?.embedding_model}`}
        className="mx-4 mb-1 mt-1 overflow-hidden rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-950/60 to-slate-900/80 px-3 py-2 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          {/* Status dot + label */}
          <div className="flex items-center gap-2">
            {/* Animated pulse ring */}
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            <span className="text-xs font-bold tracking-wide text-emerald-400">
              Online AI
            </span>
          </div>
          {/* Cpu icon */}
          <Cpu className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        {/* Model name */}
        {modelShort && (
          <p className="mt-1 truncate text-[10px] capitalize text-emerald-600/80">
            {modelShort}
          </p>
        )}
      </div>
    );
  }

  // Offline
  return (
    <div
      title={status?.reason ?? "Offline Mode — mock responses active"}
      className="mx-4 mb-1 mt-1 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-500" />
        <span className="text-xs font-medium text-slate-500">Offline Mode</span>
      </div>
      <p className="mt-0.5 text-[10px] text-slate-600">Mock responses active</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null | "loading">("loading");

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getAiStatus();
        setAiStatus(status);
      } catch {
        setAiStatus({
          mode: "offline",
          model: null,
          embedding_model: null,
          gemini_key_configured: false,
          reason: "Backend unreachable",
        });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[#020613] text-slate-100">
      <div className="flex h-full min-w-0">
        <Sidebar
          onNavigate={() => setMobileOpen(false)}
          aiStatus={aiStatus}
        />

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-shell-sidebar border-r border-slate-700 bg-[#040817] shadow-2xl">
              <Sidebar
                onNavigate={() => setMobileOpen(false)}
                mobile
                aiStatus={aiStatus}
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="absolute left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-[#081024] text-slate-200 shadow-lg lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="h-full pt-16 lg:pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({
  onNavigate,
  mobile = false,
  aiStatus,
}: {
  onNavigate: () => void;
  mobile?: boolean;
  aiStatus: AIStatusResponse | null | "loading";
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleSignOut() {
    clearSession();
    setUser(null);
    setMenuOpen(false);
    onNavigate();
    router.push("/login");
  }

  const initials = user ? user.email.slice(0, 2).toUpperCase() : "QA";
  const displayName = user?.email ?? "qa";
  const displayRole = user?.role ?? "QA Manager";

  return (
    <aside
      className={clsx(
        "flex h-full flex-col border-r border-slate-700 bg-[#040817]",
        mobile ? "w-full" : "hidden w-shell-sidebar flex-shrink-0 lg:flex"
      )}
    >
      {/* Logo + brand */}
      <Link
        href="/regulations"
        onClick={onNavigate}
        className="flex h-shell-header items-center gap-3 border-b border-slate-800 px-7"
      >
        <Image
          src={BRAND_LOGO_SRC}
          alt="Sentinel OS"
          width={36}
          height={36}
          className="h-9 w-9 rounded-xl shadow-[0_0_24px_rgba(14,116,233,0.35)]"
          priority
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-none text-white">Sentinel OS</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Validated QMS
          </p>
        </div>
      </Link>

      {/* AI Mode indicator — sits just below the logo */}
      <div className="border-b border-slate-800/60 pb-3 pt-3">
        <AIModePanel status={aiStatus} />
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-5 py-6">
        <div className="space-y-4">
          {navigation.map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {/* User profile */}
      <div className="relative p-5">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-[#0b1629] px-4 py-3 text-left transition hover:border-slate-600"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-950">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{displayName}</p>
            <p className="truncate text-xs text-slate-400">{displayRole}</p>
          </div>
          <ChevronDown
            className={clsx(
              "h-4 w-4 text-slate-500 transition",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-5 right-5 z-10 mb-2 overflow-hidden rounded-lg border border-slate-700 bg-[#0b1629] shadow-xl">
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate();
                }}
                className="block px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SidebarLink
// ---------------------------------------------------------------------------
function SidebarLink({
  item,
  onNavigate,
}: {
  item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.href === "/regulations" &&
      (pathname.startsWith("/remediation") ||
        pathname.startsWith("/implementation-plan") ||
        pathname.startsWith("/cases")));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={clsx(
        "flex h-10 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition",
        active
          ? "bg-blue-600 text-white shadow-[0_14px_34px_rgba(37,99,235,0.25)]"
          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.label}
    </Link>
  );
}
