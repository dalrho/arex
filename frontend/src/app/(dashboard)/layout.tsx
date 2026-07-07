"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Bell,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  HelpCircle,
  Files,
  LayoutDashboard,
  Menu,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Download,
} from "lucide-react";
import clsx from "clsx";

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
  const pathname = usePathname();

  const navigation = [
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
        { name: "Audit Trail", href: "/approvals", icon: SlidersHorizontal },
        { name: "Users", href: "/dashboard", icon: Users },
      ],
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-950">
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:flex">
        <div className="flex min-h-0 w-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-400/40 bg-blue-500/10 text-blue-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-bold tracking-tight">Sentinel OS</span>
              <span className="block text-[11px] font-medium uppercase text-slate-500">Validated QMS</span>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
            {navigation.map((group) => (
              <div key={group.section} className="mb-6">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase text-slate-500">
                  {group.section}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={`${group.section}-${item.name}`}
                        href={item.href}
                        className={clsx(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-950/40"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                21 CFR Part 11 Audit Ready
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[78%] rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900 px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-900">
                AM
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">Alex Morgan</p>
                <p className="truncate text-[11px] text-slate-400">Quality Manager</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm shadow-slate-950/[0.02] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:inline-flex"
              aria-label="Collapse navigation"
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
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                3
              </span>
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 sm:inline-flex"
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                AM
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold leading-4 text-slate-900">Acme BioPharma</p>
                <p className="text-[11px] text-slate-500">QMS Workspace</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
