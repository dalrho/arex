"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Files,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  User as UserIcon,
  Users,
  Download,
  X,
} from "lucide-react";
import clsx from "clsx";
import Dropdown, { menuItemClass, menuSectionClass } from "@/components/ui/Dropdown";
import { clearSession, getCurrentUser, listRemediations } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { AuthUser, RemediationResponse } from "@/types/api";

const NAVIGATION = [
  {
    section: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Regulations", href: "/regulations", icon: Scale },
      { name: "Documents", href: "/documents", icon: Files },
    ],
  },
  {
    section: "Workflows",
    items: [
      { name: "Tasks", href: "/tasks", icon: FileCheck2 },
      { name: "Approvals", href: "/approvals", icon: ShieldCheck },
      { name: "Exports", href: "/exports", icon: Download },
    ],
  },
  {
    section: "Controls",
    items: [
      { name: "Audit Trail", href: "/audit", icon: SlidersHorizontal },
      { name: "Users", href: "/users", icon: Users },
    ],
  },
];

const BRAND_LOGO_SRC = "/brand/sentinel-os-logo.svg";

/**
 * Dashboard Layout
 * Wraps all pages inside the (dashboard) route group.
 * Provides a persistent sidebar navigation and top status bar.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<RemediationResponse[]>([]);

  // Read auth state and notification data after mount to avoid hydration mismatch.
  useEffect(() => {
    setUser(getCurrentUser());
    listRemediations()
      .then((drafts) =>
        setPendingDrafts(
          drafts
            .filter((d) => d.status === "PENDING_REVIEW")
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        )
      )
      .catch(() => setPendingDrafts([]));
  }, []);

  function handleSignOut() {
    clearSession();
    setUser(null);
    router.push("/login");
  }

  const initials = user
    ? user.email.slice(0, 2).toUpperCase()
    : "AM";
  const displayName = user ? user.email.split("@")[0] : "Alex Morgan";
  const displayRole = user?.role ?? "Quality Manager";

  const accountMenu = (close: () => void) => (
    <>
      <div className="border-b border-slate-100 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
        <p className="truncate text-xs text-slate-500">{user ? user.email : "Not signed in"}</p>
        <p className="mt-0.5 text-[11px] font-medium uppercase text-slate-400">{displayRole}</p>
      </div>
      <div className="pt-1">
        <Link
          href="/dashboard"
          onClick={close}
          className={menuItemClass}
        >
          <UserIcon className="h-4 w-4 text-slate-500" />
          Workspace overview
        </Link>
        {user ? (
          <button
            type="button"
            onClick={() => {
              close();
              handleSignOut();
            }}
            className={clsx(menuItemClass, "text-red-600 hover:bg-red-50 hover:text-red-700")}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : (
          <Link href="/login" onClick={close} className={menuItemClass}>
            <LogIn className="h-4 w-4 text-slate-500" />
            Sign in
          </Link>
        )}
      </div>
    </>
  );

  const renderSidebar = (collapsed: boolean) => (
    <div className="flex min-h-0 w-full flex-col">
      <div className={clsx("flex h-16 items-center gap-3 border-b border-white/10", collapsed ? "justify-center px-2" : "px-5")}>
        <Image
          src={BRAND_LOGO_SRC}
          alt="Sentinel OS"
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0 rounded-xl shadow-lg shadow-blue-950/30"
        />
        {!collapsed && (
          <div>
            <span className="block text-lg font-bold tracking-tight">Sentinel OS</span>
            <span className="block text-[11px] font-medium uppercase text-slate-500">Validated QMS</span>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        {NAVIGATION.map((group) => (
          <div key={group.section} className="mb-6">
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase text-slate-500">
                {group.section}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarLink
                  key={`${group.section}-${item.name}`}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        {!collapsed && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              21 CFR Part 11 Audit Ready
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-[78%] rounded-full bg-emerald-400" />
            </div>
          </div>
        )}
        <Dropdown
          align="left"
          direction="up"
          panelClassName="w-56"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg border border-white/10 bg-slate-900 py-3 text-left hover:bg-slate-800",
                collapsed ? "justify-center px-2" : "px-3"
              )}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-900">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="truncate text-[11px] text-slate-400">{displayRole}</p>
                  </div>
                  <ChevronDown
                    className={clsx("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")}
                  />
                </>
              )}
            </button>
          )}
        >
          {accountMenu}
        </Dropdown>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-950">
      <aside
        className={clsx(
          "hidden flex-shrink-0 border-r border-slate-800 bg-slate-950 text-white transition-[width] lg:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        {renderSidebar(collapsed)}
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 border-r border-slate-800 bg-slate-950 text-white shadow-2xl">
            {renderSidebar(false)}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm shadow-slate-950/[0.02] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:inline-flex"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-[320px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 xl:flex">
              <Search className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Search Sentinel OS</span>
              <span className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 md:flex">
              <Shield className="h-4 w-4" />
              Validated Environment
            </div>

            <Dropdown
              panelClassName="w-80"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {pendingDrafts.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {pendingDrafts.length}
                    </span>
                  )}
                </button>
              )}
            >
              {(close) => (
                <>
                  <p className={menuSectionClass}>Notifications</p>
                  {pendingDrafts.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-500">
                      You are all caught up. New items awaiting review will appear here.
                    </p>
                  ) : (
                    pendingDrafts.slice(0, 5).map((draft) => (
                      <Link
                        key={draft.id}
                        href={`/remediation/${draft.id}`}
                        onClick={close}
                        className="block rounded-md px-3 py-2 hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          Remediation draft awaiting review
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Draft {draft.id.slice(0, 8).toUpperCase()} · {formatDateTime(draft.created_at)}
                        </p>
                      </Link>
                    ))
                  )}
                  <div className="mt-1 border-t border-slate-100 pt-1">
                    <Link
                      href="/approvals"
                      onClick={close}
                      className={clsx(menuItemClass, "justify-center text-blue-700 hover:bg-blue-50 hover:text-blue-800")}
                    >
                      View approval queue
                    </Link>
                  </div>
                </>
              )}
            </Dropdown>

            <Dropdown
              panelClassName="w-64"
              className="hidden sm:block"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Help"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <p className={menuSectionClass}>Help &amp; Support</p>
                  <Link href="/dashboard" onClick={close} className={menuItemClass}>
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    Getting started guide
                  </Link>
                  <a
                    href="https://www.fda.gov/regulatory-information"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                    className={menuItemClass}
                  >
                    <ExternalLink className="h-4 w-4 text-slate-500" />
                    FDA regulatory resources
                  </a>
                  <a href="mailto:support@sentinel-os.example" onClick={close} className={menuItemClass}>
                    <LifeBuoy className="h-4 w-4 text-slate-500" />
                    Contact support
                  </a>
                </>
              )}
            </Dropdown>

            <Dropdown
              panelClassName="w-64"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-md border-l border-slate-200 py-1 pl-3 pr-1 hover:bg-slate-50"
                  aria-label="Account menu"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold leading-4 text-slate-900">Acme BioPharma</p>
                    <p className="text-[11px] text-slate-500">QMS Workspace</p>
                  </div>
                  <ChevronDown
                    className={clsx(
                      "hidden h-4 w-4 text-slate-400 transition-transform md:block",
                      open && "rotate-180"
                    )}
                  />
                </button>
              )}
            >
              {accountMenu}
            </Dropdown>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.name : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "px-3",
        isActive
          ? "bg-blue-600 text-white shadow-sm shadow-blue-950/40"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}
