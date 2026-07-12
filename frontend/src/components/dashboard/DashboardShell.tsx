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
  Settings,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  clearSession,
  getAiStatus,
  getCurrentUser,
  type AIStatusResponse,
} from "@/lib/apiClient";
import type { AuthUser } from "@/types/api";

const BRAND_LOGO_SRC = "/brand/arex-logo.png";

const navigation = [
  { label: "Regulations", href: "/regulations", icon: Scale },
  { label: "Documents", href: "/documents", icon: Files },
  { label: "Tasks", href: "/tasks", icon: ClipboardCheck },
];

const settingsNavigation = [
  { label: "Data Management", href: "/settings/data-management", icon: Settings },
];


// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#020613] text-slate-100">
      <div className="flex h-full min-w-0">
        <Sidebar
          onNavigate={() => setMobileOpen(false)}
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
}: {
  onNavigate: () => void;
  mobile?: boolean;
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
        className="flex h-shell-header items-center justify-center border-b border-slate-800 px-4"
      >
        <Image
          src={BRAND_LOGO_SRC}
          alt="AREX"
          width={144}
          height={42}
          className="h-7 w-auto max-w-[8.5rem] object-contain drop-shadow-[0_0_14px_rgba(14,116,233,0.24)]"
          priority
        />
      </Link>

      {/* Navigation links */}
      <nav className="flex-1 px-5 py-6 flex flex-col gap-6">
        <InferenceStatusBadge />
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Workspace</p>
          {navigation.map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Settings</p>
          {settingsNavigation.map((item) => (
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
// InferenceStatusBadge — demo AI / AMD compute indicator (no settings icon)
// ---------------------------------------------------------------------------
function InferenceStatusBadge() {
  const [status, setStatus] = useState<AIStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await getAiStatus();
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) {
          setStatus({
            mode: "offline",
            provider: "Unavailable",
            model: null,
            embedding_model: null,
            inference_label: "Offline · Mock",
            cumulative_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            gemini_key_configured: false,
            fireworks_key_configured: false,
            reason: "Unable to reach AI status endpoint.",
          });
        }
      }
    }

    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const isOffline = !status || status.mode === "offline";
  const isHackathon = status?.mode === "hackathon";
  const label = status?.inference_label ?? "Checking inference…";
  const tokens = status?.cumulative_tokens ?? 0;

  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2.5",
        isOffline
          ? "border-slate-700/80 bg-slate-900/60"
          : isHackathon
            ? "border-emerald-500/30 bg-emerald-950/40"
            : "border-emerald-500/25 bg-emerald-950/30"
      )}
      title={status?.reason ?? undefined}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={clsx(
            "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
            isOffline
              ? "bg-slate-500"
              : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "text-[11px] font-semibold leading-snug",
              isOffline ? "text-slate-400" : "text-emerald-300"
            )}
          >
            {label}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Tokens used: {tokens.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
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
