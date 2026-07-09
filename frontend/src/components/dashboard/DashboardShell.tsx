"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ClipboardCheck, Files, LogOut, Menu, Scale, X } from "lucide-react";
import clsx from "clsx";
import { clearSession, getCurrentUser } from "@/lib/apiClient";
import type { AuthUser } from "@/types/api";

const BRAND_LOGO_SRC = "/brand/sentinel-os-logo.svg";

const navigation = [
  { label: "Regulations", href: "/regulations", icon: Scale },
  { label: "Documents", href: "/documents", icon: Files },
  { label: "Tasks", href: "/tasks", icon: ClipboardCheck },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#020613] text-slate-100">
      <div className="flex h-full min-w-0">
        <Sidebar onNavigate={() => setMobileOpen(false)} />

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-shell-sidebar border-r border-slate-700 bg-[#040817] shadow-2xl">
              <Sidebar onNavigate={() => setMobileOpen(false)} mobile />
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
          <div className="h-full pt-16 lg:pt-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate, mobile = false }: { onNavigate: () => void; mobile?: boolean }) {
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

  const initials = user
    ? user.email.slice(0, 2).toUpperCase()
    : "QA";
  const displayName = user?.email ?? "qa";
  const displayRole = user?.role ?? "QA Manager";

  return (
    <aside
      className={clsx(
        "flex h-full flex-col border-r border-slate-700 bg-[#040817]",
        mobile ? "w-full" : "hidden w-shell-sidebar flex-shrink-0 lg:flex"
      )}
    >
      <Link href="/regulations" onClick={onNavigate} className="flex h-shell-header items-center gap-3 border-b border-slate-800 px-7">
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
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Validated QMS</p>
        </div>
      </Link>

      <nav className="flex-1 px-5 py-6">
        <div className="space-y-4">
          {navigation.map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

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
          <ChevronDown className={clsx("h-4 w-4 text-slate-500 transition", menuOpen && "rotate-180")} />
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
    (item.href === "/regulations" && (pathname.startsWith("/remediation") || pathname.startsWith("/exports")));

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
