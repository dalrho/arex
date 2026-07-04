"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Files, 
  Scale, 
  CheckSquare, 
  ShieldCheck, 
  Download,
  ShieldAlert
} from "lucide-react";

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
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Documents", href: "/documents", icon: Files },
    { name: "Regulations", href: "/regulations", icon: Scale },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Approvals", href: "/approvals", icon: ShieldCheck },
    { name: "Exports", href: "/exports", icon: Download },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
            <ShieldAlert className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Sentinel OS
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Tenant Scoping Footer */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs">
                QA
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">Acme BioPharma</p>
                <p className="text-[10px] text-slate-500 truncate">Tenant: default-org-id</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200">
          <div className="text-sm font-medium text-slate-500">
            Compliance Management Workspace
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              FDA 21 CFR Part 11 Compliant
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold">
              US
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
