import React from "react";
import { Files, Scale, ShieldCheck, AlertCircle } from "lucide-react";

/**
 * Dashboard Page ("/dashboard")
 * Part of the (dashboard) route group. Displays aggregate metrics and action logs.
 */
export default function DashboardPage() {
  const stats = [
    { name: "Active SOPs & Policies", value: "24", change: "+2 this month", icon: Files, color: "text-blue-600 bg-blue-50" },
    { name: "FDA Updates Tracked", value: "12", change: "4 new releases", icon: Scale, color: "text-purple-600 bg-purple-50" },
    { name: "Pending Human Sign-off", value: "3", change: "Requires review", icon: ShieldCheck, color: "text-amber-600 bg-amber-50" },
  ];

  const recentUpdates = [
    { id: 1, title: "FDA-2026-D-01: Cybersecurity in Medical Devices", category: "Subpart B - Records", urgency: "High", date: "Jul 2, 2026" },
    { id: 2, title: "Part 11.10(a): Updated Validation Rules for SaaS QMS", category: "Subpart B - Validation", urgency: "Critical", date: "Jun 28, 2026" },
    { id: 3, title: "Federal Register Vol. 91: Digital Signature Certificates", category: "Subpart C - Signatures", urgency: "Medium", date: "Jun 15, 2026" },
  ];

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compliance Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time FDA 21 CFR Part 11 auditing overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <div key={item.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.name}</p>
              <h3 className="text-3xl font-bold text-slate-950">{item.value}</h3>
              <p className="text-xs font-medium text-slate-500">{item.change}</p>
            </div>
            <div className={`p-4 rounded-lg ${item.color}`}>
              <item.icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Regulations Feed */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-950 text-base">Recent Regulatory Alerts</h3>
            <span className="text-xs font-semibold text-blue-600 cursor-pointer hover:underline">View All</span>
          </div>
          <div className="divide-y divide-slate-100 space-y-3">
            {recentUpdates.map((item) => (
              <div key={item.id} className="pt-3 flex items-start gap-4 justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 hover:text-blue-600 cursor-pointer">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.date}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  item.urgency === "Critical" ? "bg-red-50 text-red-700" :
                  item.urgency === "High" ? "bg-amber-50 text-amber-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {item.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Activity & Safety Audit Trail */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              Safety-Critical Status
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">ACTIVE AUDIT</span>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">Decoupled Architecture Boundary</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sentinel OS runs LLM agentic code strictly within a sandbox. All proposed SOP changes require manual Human-in-the-Loop authorization.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">Database Tenancy Scoping</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                All read/write operations scoped to organizational identifiers. Row-level filters prevent data exposure between tenants.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
