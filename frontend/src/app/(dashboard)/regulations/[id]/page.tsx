"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileDiff, Loader2, Play } from "lucide-react";
import ImpactSummaryCard from "@/components/dashboard/ImpactSummaryCard";
import RiskBadge from "@/components/dashboard/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ApiError,
  getImpactForRegulation,
  getRegulation,
  listRemediations,
  runImpactAssessment,
} from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ImpactResponse, RegulationResponse, RemediationResponse } from "@/types/api";

/**
 * Regulation Detail Page ("/regulations/[id]")
 * Regulation header plus AI impact assessment and related remediation drafts.
 */
export default function RegulationDetailPage({ params }: { params: { id: string } }) {
  const [regulation, setRegulation] = useState<RegulationResponse | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [impactMissing, setImpactMissing] = useState(false);
  const [drafts, setDrafts] = useState<RemediationResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);

  const loadImpact = useCallback(async () => {
    try {
      setImpact(await getImpactForRegulation(params.id));
      setImpactMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setImpactMissing(true);
      }
    }
  }, [params.id]);

  useEffect(() => {
    getRegulation(params.id)
      .then(setRegulation)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load regulation.")
      );
    void loadImpact();
    listRemediations()
      .then((all) => setDrafts(all.filter((d) => d.regulation_id === params.id)))
      .catch(() => setDrafts([]));
  }, [params.id, loadImpact]);

  async function handleRunAssessment() {
    setAssessing(true);
    setAssessError(null);
    try {
      const result = await runImpactAssessment(params.id);
      setImpact(result);
      setImpactMissing(false);
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : "Impact assessment failed.");
    } finally {
      setAssessing(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!regulation) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading regulation...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Regulation header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{regulation.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <a
                href={regulation.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {regulation.source_url}
                <ExternalLink className="h-3 w-3" />
              </a>
              <span>•</span>
              <span>Published {formatDate(regulation.published_date)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {regulation.urgency ? (
              <RiskBadge level={regulation.urgency} />
            ) : (
              <StatusBadge label="Pending Analysis" tone="slate" />
            )}
            {regulation.category && (
              <StatusBadge
                label={regulation.category.charAt(0).toUpperCase() + regulation.category.slice(1)}
                tone="slate"
              />
            )}
          </div>
        </div>

        {regulation.rationale && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Regulatory Intelligence Verdict
            </p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {regulation.rationale}
            </p>
            {regulation.affected_business_areas && regulation.affected_business_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {regulation.affected_business_areas.map((area) => (
                  <span
                    key={area}
                    className="px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold"
                  >
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Impact assessment */}
      {impact ? (
        <ImpactSummaryCard impact={impact} />
      ) : impactMissing ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <p className="text-sm text-slate-500">
            No impact assessment has been run against your QMS documents for this regulation yet.
          </p>
          <button
            type="button"
            onClick={() => void handleRunAssessment()}
            disabled={assessing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {assessing ? "Running Assessment..." : "Run Impact Assessment"}
          </button>
          {assessError && <p className="text-sm text-red-600">{assessError}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading impact assessment...
        </div>
      )}

      {/* Related remediation drafts */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <FileDiff className="h-5 w-5 text-blue-500" />
            <h3 className="font-bold text-slate-950 text-base">Remediation Drafts</h3>
            <span className="text-xs text-slate-400">({drafts.length})</span>
          </div>
          <div className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/remediation/${draft.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Draft {draft.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drafted {formatDateTime(draft.created_at)}
                  </p>
                </div>
                <StatusBadge label={draft.status.replace("_", " ")} tone={undefined} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/regulations"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Regulations
    </Link>
  );
}
