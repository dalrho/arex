"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckSquare,
  Files,
  Loader2,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { getDashboard } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DashboardActivity, DashboardMetrics } from "@/types/api";

function activityTone(type: string): string {
  if (type === "remediation_approved") return "bg-emerald-50 text-emerald-700";
  if (type === "remediation_rejected") return "bg-red-50 text-red-700";
  if (type === "regulation_monitored") return "bg-purple-50 text-purple-700";
  return "bg-blue-50 text-blue-700";
}

function activityLabel(type: string): string {
  switch (type) {
    case "document_uploaded":
      return "Document";
    case "regulation_monitored":
      return "Regulation";
    case "remediation_approved":
      return "Approved";
    case "remediation_rejected":
      return "Rejected";
    default:
      return "Activity";
  }
}

/**
 * Dashboard Page ("/dashboard")
 * Part of the (dashboard) route group. Displays aggregate metrics and action logs.
 */
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setMetrics)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load dashboard metrics.")
      )
      .finally(() => setLoading(false));
  }, []);

  const stats = metrics
    ? [
        {
          name: "Active SOPs & Policies",
          value: String(metrics.total_documents),
          change: `${metrics.pending_assessments} pending assessment${metrics.pending_assessments === 1 ? "" : "s"}`,
          icon: Files,
          color: "text-blue-600 bg-blue-50",
        },
        {
          name: "FDA Updates Tracked",
          value: String(metrics.total_regulations),
          change: `${metrics.open_tasks} open task${metrics.open_tasks === 1 ? "" : "s"}`,
          icon: Scale,
          color: "text-purple-600 bg-purple-50",
        },
        {
          name: "Pending Human Sign-off",
          value: String(metrics.pending_remediations),
          change: "Requires review",
          icon: ShieldCheck,
          color: "text-amber-600 bg-amber-50",
        },
        {
          name: "Max Risk Score",
          value: metrics.max_risk_score.toFixed(1),
          change: "Across impact assessments",
          icon: TrendingUp,
          color: "text-red-600 bg-red-50",
        },
      ]
    : [];

  const recentActivity: DashboardActivity[] = metrics?.recent_activity ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compliance Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time FDA 21 CFR Part 11 auditing overview.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.name}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {item.name}
                  </p>
                  <h3 className="text-3xl font-bold text-slate-950">{item.value}</h3>
                  <p className="text-xs font-medium text-slate-500">{item.change}</p>
                </div>
                <div className={`p-4 rounded-lg ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-950 text-base">Recent Activity</h3>
                <Link
                  href="/audit"
                  className="text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                >
                  View Audit Trail
                </Link>
              </div>
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No recent activity yet. Upload documents or monitor regulations to get started.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-3">
                  {recentActivity.map((item, index) => (
                    <div key={`${item.type}-${item.timestamp}-${index}`} className="pt-3 flex items-start gap-4 justify-between">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{item.message}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{formatDateTime(item.timestamp)}</span>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${activityTone(item.type)}`}
                      >
                        {activityLabel(item.type)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                  Safety-Critical Status
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  ACTIVE AUDIT
                </span>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Human-in-the-Loop Boundary
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {metrics?.pending_remediations ?? 0} remediation draft
                    {(metrics?.pending_remediations ?? 0) === 1 ? " is" : "s are"} awaiting explicit
                    reviewer sign-off before adoption.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    Open Implementation Tasks
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {metrics?.open_tasks ?? 0} task{(metrics?.open_tasks ?? 0) === 1 ? "" : "s"} remain
                    open across departments.{" "}
                    <Link href="/tasks" className="font-semibold text-blue-600 hover:underline">
                      View task board
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
