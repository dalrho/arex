import React from "react";
import { Gauge } from "lucide-react";
import clsx from "clsx";
import RiskBadge from "@/components/dashboard/RiskBadge";
import { formatDateTime } from "@/lib/format";
import type { ImpactResponse } from "@/types/api";

interface ImpactSummaryCardProps {
  impact: ImpactResponse;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-emerald-600";
}

/** Impact assessment summary: risk score, level, departments, and agent rationale. */
export default function ImpactSummaryCard({ impact }: ImpactSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-500" />
          Impact Assessment
        </h3>
        <RiskBadge level={impact.impact_level} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk Score</p>
          <p className={clsx("text-4xl font-bold mt-1", scoreColor(impact.risk_score))}>
            {Math.round(impact.risk_score)}
            <span className="text-sm font-medium text-slate-400"> / 100</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Affected Departments
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {impact.affected_departments.length > 0 ? (
              impact.affected_departments.map((dept) => (
                <span
                  key={dept}
                  className="px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-semibold"
                >
                  {dept}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">None identified</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Agent Rationale
        </p>
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
          {impact.rationale}
        </p>
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        Last analyzed {formatDateTime(impact.created_at)} by Compliance Impact Engine
      </p>
    </div>
  );
}
