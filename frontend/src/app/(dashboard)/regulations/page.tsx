"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Loader2, Play, RefreshCw, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  generateRemediationDrafts,
  getCurrentUser,
  listRegulations,
  runImpactAssessment,
} from "@/lib/apiClient";
import { demoImpactForRegulation, demoRegulations, demoRemediations } from "@/lib/demoData";
import { formatDate, getAccountDisplayName } from "@/lib/format";
import type { AuthUser, ImpactResponse, RegulationResponse } from "@/types/api";

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function statusFor(regulation: RegulationResponse, activeImpact: ImpactResponse | null): string {
  if (activeImpact?.regulation_id === regulation.id) return "Analysis Complete";
  return regulation.status?.replace(/_/g, " ") || "Pending Analysis";
}

export default function RegulationsPage() {
  const router = useRouter();
  const [regulations, setRegulations] = useState<RegulationResponse[]>(demoRegulations);
  const [selectedId, setSelectedId] = useState<string | null>(demoRegulations[0]?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listRegulations();
      const nextRows = rows.length > 0 ? rows : demoRegulations;
      nextRows.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());
      setRegulations(nextRows);
      setSelectedId((current) => current ?? nextRows[0]?.id ?? null);
    } catch {
      setRegulations(demoRegulations);
      setSelectedId((current) => current ?? demoRegulations[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => regulations.find((regulation) => regulation.id === selectedId) ?? regulations[0] ?? null,
    [regulations, selectedId]
  );

  async function handleRunAssessment(regulation = selected) {
    if (!regulation) return;
    setSelectedId(regulation.id);
    setAssessing(true);
    try {
      setImpact(await runImpactAssessment(regulation.id));
    } catch {
      setImpact(demoImpactForRegulation(regulation.id));
    } finally {
      setAssessing(false);
    }
  }

  async function handleGenerateDrafts() {
    if (!selected) return;
    setGenerating(true);
    try {
      const created = await generateRemediationDrafts(selected.id);
      const nextDrafts = created.length > 0 ? created : demoRemediations;
      router.push(`/remediation/${nextDrafts[0].id}`);
    } catch {
      router.push(`/remediation/${demoRemediations[0].id}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {!impact ? (
          <section className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-full">
            <div className="w-full max-w-3xl text-center">
              <h1 className="text-2xl font-extrabold uppercase tracking-normal text-white md:text-3xl">
                Welcome, {getAccountDisplayName(user)}!
              </h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-normal text-slate-400">
                Select regulation then, run impact assessment
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleRunAssessment()}
                  disabled={!selected || assessing}
                  className="inline-flex h-10 w-full max-w-[360px] items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-[0_16px_40px_rgba(37,99,235,0.24)] hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {assessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-white text-white" />}
                  Run Impact Assessment
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateDrafts()}
                  disabled={!selected || generating}
                  className="inline-flex h-10 w-full max-w-[360px] items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-6 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                  Generate Remediation Drafts
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="px-6 py-5 md:px-10">
            <div className="mx-auto max-w-5xl space-y-6 pb-32">
              <AssessmentSummary regulation={selected} impact={impact} onOpenCitation={() => setCitationOpen(true)} />
              <ImpactNarrative impact={impact} onOpenCitation={() => setCitationOpen(true)} />
              <SopComparison />
            </div>
          </section>
        )}

        {impact && (
          <div className="sticky bottom-0 z-20 border-t border-slate-700 bg-[#020613]/95 px-6 py-5 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-col items-stretch justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleRunAssessment()}
                disabled={assessing}
                className="inline-flex h-10 items-center justify-center gap-3 rounded-lg bg-blue-600 px-7 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {assessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-white text-white" />}
                Re-run Impact Assessment
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateDrafts()}
                disabled={generating}
                className="inline-flex h-10 items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-7 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                Generate Remediation Drafts
              </button>
            </div>
          </div>
        )}
      </div>

      <RegulationRail
        regulations={regulations}
        selectedId={selected?.id ?? null}
        loading={loading}
        impact={impact}
        assessing={assessing}
        onFetch={() => void load()}
        onSelect={(id) => setSelectedId(id)}
        onRun={(regulation) => void handleRunAssessment(regulation)}
      />

      <CitationPanel open={citationOpen} onClose={() => setCitationOpen(false)} regulation={selected} />
    </div>
  );
}

function RegulationRail({
  regulations,
  selectedId,
  loading,
  impact,
  assessing,
  onFetch,
  onSelect,
  onRun,
}: {
  regulations: RegulationResponse[];
  selectedId: string | null;
  loading: boolean;
  impact: ImpactResponse | null;
  assessing: boolean;
  onFetch: () => void;
  onSelect: (id: string) => void;
  onRun: (regulation: RegulationResponse) => void;
}) {
  return (
    <aside className="hidden w-shell-rail flex-shrink-0 overflow-y-auto border-l border-slate-700 bg-[#020613] px-6 py-6 xl:block">
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={onFetch}
          className="inline-flex h-10 items-center gap-3 rounded-lg bg-blue-600 px-7 text-sm font-bold text-white hover:bg-blue-500"
        >
          <RefreshCw className={clsx("h-5 w-5", loading && "animate-spin")} />
          Fetch
        </button>
      </div>

      <div className="space-y-5">
        {regulations.map((regulation) => {
          const active = regulation.id === selectedId;
          const analyzed = impact?.regulation_id === regulation.id || regulation.status === "ANALYSIS_COMPLETE";
          return (
            <article
              key={regulation.id}
              className={clsx(
                "rounded-lg border bg-slate-800/90 p-4 transition",
                active ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.35)]" : "border-slate-700"
              )}
            >
              <button type="button" onClick={() => onSelect(regulation.id)} className="block w-full text-left">
                <h2 className="line-clamp-3 text-sm font-extrabold uppercase leading-5 text-white">
                  {regulation.title}
                </h2>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Link2 className="h-3.5 w-3.5" />
                  {hostFor(regulation.source_url)}
                </p>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <StatusBadge label={analyzed ? "Analysis Complete" : statusFor(regulation, impact)} tone={analyzed ? "emerald" : "amber"} />
                <button
                  type="button"
                  onClick={() => onRun(regulation)}
                  disabled={assessing}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {assessing && active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-white" />}
                  {analyzed ? "Rerun" : "Run"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function AssessmentSummary({
  regulation,
  impact,
  onOpenCitation,
}: {
  regulation: RegulationResponse | null;
  impact: ImpactResponse;
  onOpenCitation: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-[#081024] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase text-slate-400">Regulatory Summary</p>
          <h2 className="mt-4 text-2xl font-bold leading-tight text-white">
            {regulation?.title ?? "Selected regulation"}
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Published {regulation ? formatDate(regulation.published_date) : "recently"} from{" "}
            {regulation ? hostFor(regulation.source_url) : "federalregister.gov"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-[#040817] px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase text-slate-500">Risk Score</p>
          <p className="mt-1 text-4xl font-extrabold text-red-300">{Math.round(impact.risk_score)}</p>
        </div>
      </div>
      <p className="mt-6 max-w-4xl text-base leading-7 text-slate-300">
        {regulation?.rationale || regulation?.raw_content || "The selected update affects validated QMS controls."}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {impact.affected_departments.map((department) => (
          <StatusBadge key={department} label={department} tone="blue" />
        ))}
        <button
          type="button"
          onClick={onOpenCitation}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/20"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Citation detail
        </button>
      </div>
    </section>
  );
}

function ImpactNarrative({ impact, onOpenCitation }: { impact: ImpactResponse; onOpenCitation: () => void }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-[#081024] p-6">
      <p className="text-xs font-extrabold uppercase text-slate-400">Impact Assessment</p>
      <p className="mt-6 text-base leading-7 text-slate-300">
        {impact.rationale.split("Validation SOP section 3.2")[0]}
        <button
          type="button"
          onClick={onOpenCitation}
          className="font-semibold text-blue-400 underline decoration-blue-500/70 underline-offset-4"
        >
          Validation SOP section 3.2
        </button>
        {impact.rationale.split("Validation SOP section 3.2")[1] ?? ""}
      </p>
      <div className="mt-6 border-t border-slate-800 pt-5 text-xs text-slate-500">
        <button type="button" onClick={onOpenCitation} className="block text-left hover:text-blue-300">
          [1] Validation SOP - Section 4.1: Electronic Signature Validation
        </button>
        <button type="button" onClick={onOpenCitation} className="mt-2 block text-left hover:text-blue-300">
          [2] Validation SOP - Section 3.2: Audit Trail Requirements
        </button>
        <button type="button" onClick={onOpenCitation} className="mt-2 block text-left hover:text-blue-300">
          [3] CSV Validation SOP - Section 5.4: Electronic Signature Procedures
        </button>
      </div>
    </section>
  );
}

function SopComparison() {
  const rows = [
    ["Users must authenticate before accessing validated systems.", "Users must authenticate with MFA before accessing validated systems."],
    ["Audit trails must capture regulated record changes.", "Audit trails must capture regulated record changes and session events."],
    ["Reviewer decisions must be retained.", "Reviewer decisions must be retained with explicit session-control evidence."],
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-700 bg-[#081024]">
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <p className="text-xs font-extrabold uppercase text-slate-400">SOP Comparison</p>
        <div className="flex gap-2">
          <StatusBadge label="Added" tone="emerald" />
          <StatusBadge label="Deleted" tone="red" />
          <StatusBadge label="Citations" tone="blue" />
        </div>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b border-slate-700 md:border-b-0 md:border-r">
          <div className="border-b border-slate-800 px-6 py-3 text-xs font-bold uppercase text-slate-500">
            Current SOP <StatusBadge label="v2.1" tone="slate" className="ml-2" />
          </div>
          <div className="divide-y divide-slate-800">
            {rows.map(([before], index) => (
              <p key={before} className={clsx("px-6 py-4 text-sm leading-6", index < 2 ? "bg-red-500/10 text-red-100" : "text-slate-400")}>
                <span className="mr-4 font-mono text-slate-500">{index + 1}</span>
                {before}
              </p>
            ))}
          </div>
        </div>
        <div>
          <div className="border-b border-slate-800 px-6 py-3 text-xs font-bold uppercase text-slate-500">
            Draft SOP <StatusBadge label="v2.2" tone="emerald" className="ml-2" />
          </div>
          <div className="divide-y divide-slate-800">
            {rows.map(([, after], index) => (
              <p key={after} className="bg-emerald-500/10 px-6 py-4 text-sm leading-6 text-emerald-100">
                <span className="mr-4 font-mono text-slate-500">{index + 1}</span>
                {after}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CitationPanel({
  open,
  onClose,
  regulation,
}: {
  open: boolean;
  onClose: () => void;
  regulation: RegulationResponse | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close citation panel" className="absolute inset-0 bg-black/75" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto border-l border-slate-800 bg-[#061026] px-6 py-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-extrabold uppercase text-slate-300">Knowledge Base Citation</p>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 border-t border-slate-800 pt-6">
          <h2 className="text-2xl font-extrabold text-white">Validation SOP</h2>
          <p className="mt-2 text-base italic text-slate-200">Section 3.2: Audit Trail Requirements</p>
        </div>
        <div className="mt-8 rounded-lg border border-slate-600 bg-[#081024] p-6 text-base leading-8 text-slate-200">
          Audit trails for validated systems must record user identity, timestamp, action, prior value, new value,
          and reviewer decision. Access controls must be reviewed when authentication rules or session controls change.
        </div>
        <div className="mt-8 rounded-lg bg-[#0a132d] p-6">
          <p className="text-xs font-extrabold uppercase text-slate-400">Matched Regulation</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            {regulation?.title ?? "FDA mandatory multi-factor authentication and session idle timeout requirements"}
          </p>
        </div>
        <div className="mt-8">
          <p className="text-xs font-extrabold uppercase text-slate-400">Why Flagged</p>
          <p className="mt-3 text-base leading-7 text-slate-300">
            The current SOP covers audit trail capture, but it does not explicitly bind audit evidence to MFA and idle timeout
            configuration. The remediation draft closes that traceability gap.
          </p>
        </div>
      </aside>
    </div>
  );
}
