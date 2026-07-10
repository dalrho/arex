"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Link2, Loader2, Play, RefreshCw, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  generateRemediationDrafts,
  getCurrentUser,
  listRegulations,
  runImpactAssessment,
  getImpactForRegulation,
  listRemediations,
  generateImplementationTasks,
  updateRegulationStatus,
  listTasks,
} from "@/lib/apiClient";
import { demoImpactForRegulation, demoRegulations, demoRemediations } from "@/lib/demoData";
import { formatDate, getAccountDisplayName } from "@/lib/format";
import type { AuthUser, ImpactResponse, RegulationResponse, TaskResponse } from "@/types/api";

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

function RegulationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const msg = searchParams.get("success_msg");
    if (msg) {
      setSuccessMsg(msg);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  const [regulations, setRegulations] = useState<RegulationResponse[]>(demoRegulations);
  const [selectedId, setSelectedId] = useState<string | null>(demoRegulations[0]?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [closingCase, setClosingCase] = useState(false);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [remediationDrafts, setRemediationDrafts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [showImpactDetails, setShowImpactDetails] = useState(true);
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

  // Automatically fetch existing impact assessment, remediation drafts, and tasks on selection
  useEffect(() => {
    if (!selectedId) return;
    setImpact(null);
    setRemediationDrafts([]);
    setSelectedDocIds([]);
    setTasks([]);
    setShowImpactDetails(true);
    
    getImpactForRegulation(selectedId)
      .then((res) => {
        setImpact(res);
        if (res.affected_documents) {
          setSelectedDocIds(res.affected_documents.map((d: any) => d.document_id));
        }
      })
      .catch(() => {
        setImpact(null);
      });

    listRemediations()
      .then((drafts) => {
        const filtered = drafts.filter((d) => d.regulation_id === selectedId);
        setRemediationDrafts(filtered);
      })
      .catch(() => {});

    listTasks()
      .then((allTasks) => {
        const filtered = allTasks.filter((t) => t.regulation_id === selectedId && t.status !== "REJECTED");
        setTasks(filtered);
      })
      .catch(() => {});
  }, [selectedId]);

  async function handleRunAssessment(regulation = selected) {
    if (!regulation) return;
    setSelectedId(regulation.id);
    setAssessing(true);
    try {
      const res = await runImpactAssessment(regulation.id);
      setImpact(res);
      if (res.affected_documents) {
        setSelectedDocIds(res.affected_documents.map((d: any) => d.document_id));
      } else {
        setSelectedDocIds([]);
      }
    } catch {
      const demoRes = demoImpactForRegulation(regulation.id);
      setImpact(demoRes);
      if (demoRes.affected_documents) {
        setSelectedDocIds(demoRes.affected_documents.map((d: any) => d.document_id));
      } else {
        setSelectedDocIds([]);
      }
    } finally {
      setAssessing(false);
    }
  }

  async function handleGenerateDrafts() {
    if (!selected) return;
    setGenerating(true);
    try {
      const created = await generateRemediationDrafts(selected.id, selectedDocIds);
      const nextDrafts = created.length > 0 ? created : demoRemediations;
      setRemediationDrafts(nextDrafts);
      router.push(`/remediation/${nextDrafts[0].id}`);
    } catch {
      router.push(`/remediation/${demoRemediations[0].id}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateTasks() {
    if (!selected) return;
    setGeneratingTasks(true);
    try {
      const res = await generateImplementationTasks(selected.id);
      if (res.requires_tasks === false) {
        await updateRegulationStatus(selected.id, "Closed");
        setSuccessMsg(res.message || "No operational tasks are required for this case. Compliance Case marked as complete.");
        // Refresh regulations to update status
        const rows = await listRegulations();
        if (rows.length > 0) setRegulations(rows);
        setTasks([]);
      } else {
        // Navigate to the implementation workspace
        router.push(`/cases/${selected.id}/implementation`);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to check/generate tasks.");
    } finally {
      setGeneratingTasks(false);
    }
  }

  async function handleCloseCase() {
    if (!selected) return;
    setClosingCase(true);
    try {
      const updated = await updateRegulationStatus(selected.id, "Closed");
      setRegulations((prev) =>
        prev.map((r) => (r.id === selected.id ? updated : r))
      );
      setSuccessMsg("Compliance Case has been closed successfully.");
    } catch (err: any) {
      alert(err?.message || "Failed to close compliance case.");
    } finally {
      setClosingCase(false);
    }
  }

  async function handleReopenCase() {
    if (!selected) return;
    setClosingCase(true);
    try {
      const newStatus = tasks.length > 0 ? "Implementation Planning" : (remediationDrafts.length > 0 ? "Draft Approved" : "Impact Assessment Complete");
      const updated = await updateRegulationStatus(selected.id, newStatus);
      setRegulations((prev) =>
        prev.map((r) => (r.id === selected.id ? updated : r))
      );
      setSuccessMsg("Compliance Case has been reopened.");
    } catch (err: any) {
      alert(err?.message || "Failed to reopen compliance case.");
    } finally {
      setClosingCase(false);
    }
  }


  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {successMsg && (
          <div className="mx-6 mt-6 p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-200 flex items-center justify-between text-sm transition-all duration-300">
            <span>{successMsg}</span>
            <button 
              type="button" 
              onClick={() => setSuccessMsg(null)}
              className="text-slate-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}
        {!selected ? (
          <section className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-full">
            <div className="w-full max-w-3xl text-center">
              <h1 className="text-2xl font-extrabold uppercase tracking-normal text-white md:text-3xl">
                No Compliance Case Opened
              </h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-normal text-slate-400">
                Please select or import a regulation from the rail.
              </p>
            </div>
          </section>
        ) : (
          <section className="px-6 py-8 md:px-10">
            <div className="mx-auto max-w-5xl space-y-8 pb-32">
              
              {/* Compliance Case Dashboard Header */}
              <div className="rounded-2xl border border-slate-750 bg-[#081024]/90 p-6 shadow-2xl space-y-6 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-blue-400 tracking-wider">Compliance Case</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1 leading-tight">{selected.title}</h2>
                    <p className="text-xs text-slate-400 mt-2">
                      Source: {hostFor(selected.source_url)} | Published {formatDate(selected.published_date)}
                    </p>
                  </div>
                  <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase block">Status</span>
                      <div className="mt-1">
                        <StatusBadge label={selected.status || "Not Analyzed"} tone={selected.status === "Closed" ? "emerald" : "blue"} />
                      </div>
                    </div>
                    {selected.status === "Closed" ? (
                      <button
                        type="button"
                        onClick={() => void handleReopenCase()}
                        disabled={closingCase}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-[11px] font-bold text-blue-450 hover:bg-slate-800 hover:text-blue-300 disabled:opacity-50"
                      >
                        {closingCase ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reopen Case"}
                      </button>
                    ) : (
                      selected.status !== "Not Analyzed" && selected.status !== "pending_analysis" && (
                        <button
                          type="button"
                          onClick={() => void handleCloseCase()}
                          disabled={closingCase}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-750 bg-slate-900 px-3 text-[11px] font-bold text-rose-450 hover:bg-slate-800 hover:text-rose-350 disabled:opacity-50"
                        >
                          {closingCase ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close Case"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Progress Tracker */}
                <div className="bg-[#040816]/60 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">Case Progress</h3>
                  <div className="flex flex-wrap gap-4 md:gap-8 items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border",
                        impact ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {impact ? "✓" : "⚪"}
                      </span>
                      <span className={clsx(impact ? "text-slate-200 font-bold" : "text-slate-500")}>Impact Assessment</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border",
                        (impact?.affected_documents && impact.affected_documents.length > 0) ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {(impact?.affected_documents && impact.affected_documents.length > 0) ? "✓" : "⚪"}
                      </span>
                      <span className={clsx((impact?.affected_documents && impact.affected_documents.length > 0) ? "text-slate-200 font-bold" : "text-slate-500")}>Documents Identified</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border",
                        remediationDrafts.length > 0 ? (remediationDrafts.every(d => d.status === "APPROVED") ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30") : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {remediationDrafts.length > 0 ? (remediationDrafts.every(d => d.status === "APPROVED") ? "✓" : "🟡") : "⚪"}
                      </span>
                      <span className={clsx(remediationDrafts.length > 0 ? "text-slate-200 font-bold" : "text-slate-500")}>Remediation Draft</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border",
                        tasks.length > 0 ? (selected.status === "Closed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30") : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {tasks.length > 0 ? (selected.status === "Closed" ? "✓" : "🟡") : "⚪"}
                      </span>
                      <span className={clsx(tasks.length > 0 ? "text-slate-200 font-bold" : "text-slate-500")}>Implementation</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border",
                        selected.status === "Closed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {selected.status === "Closed" ? "✓" : "⚪"}
                      </span>
                      <span className={clsx(selected.status === "Closed" ? "text-slate-200 font-bold" : "text-slate-500")}>Closed</span>
                    </div>
                  </div>
                </div>

                {/* Stage Cards Grid */}
                <div className="grid gap-6 md:grid-cols-3">
                  
                  {/* Stage 1: Impact Assessment Card */}
                  <div className="rounded-xl border border-slate-800 bg-[#040816]/75 p-5 flex flex-col justify-between min-h-[170px] hover:border-slate-700 transition duration-200">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Impact Assessment</h4>
                        <span className={clsx("h-2.5 w-2.5 rounded-full", impact ? "bg-emerald-500" : "bg-slate-600")} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">
                        {impact ? "Completed" : "Not Started"}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                      {impact ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowImpactDetails(!showImpactDetails)}
                            className="px-3.5 py-1.5 rounded bg-blue-600/10 border border-blue-500/30 text-blue-200 text-xs font-bold hover:bg-blue-600/20 transition duration-200"
                          >
                            {showImpactDetails ? "Hide Findings" : "View Findings →"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRunAssessment()}
                            disabled={assessing || selected.status === "Closed"}
                            className="px-3.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-750 transition duration-200 flex items-center gap-1 disabled:opacity-50"
                          >
                            {assessing && <Loader2 className="h-3 w-3 animate-spin" />}
                            Re-run
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleRunAssessment()}
                          disabled={assessing || selected.status === "Closed"}
                          className="w-full py-2 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                          Run Assessment
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stage 2: Remediation Draft Card */}
                  <div className="rounded-xl border border-slate-800 bg-[#040816]/75 p-5 flex flex-col justify-between min-h-[170px] hover:border-slate-700 transition duration-200">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Remediation Draft</h4>
                        <span className={clsx(
                          "h-2.5 w-2.5 rounded-full",
                          remediationDrafts.length === 0 ? "bg-slate-600" :
                          remediationDrafts.every(d => d.status === "APPROVED") ? "bg-emerald-500" : "bg-yellow-500"
                        )} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">
                        {remediationDrafts.length === 0 ? "Not Started" : 
                         remediationDrafts.every(d => d.status === "APPROVED") ? "Approved" : 
                         remediationDrafts.some(d => d.status === "REJECTED") ? "Rejected" : "Pending Review"}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                      {remediationDrafts.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => router.push(`/remediation/${remediationDrafts[0].id}`)}
                            className="px-3.5 py-1.5 rounded bg-emerald-600/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600/20 transition duration-200"
                          >
                            Open Draft →
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleGenerateDrafts()}
                            disabled={generating || selectedDocIds.length === 0 || selected.status === "Closed"}
                            className="px-3.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-750 transition duration-200 flex items-center gap-1 disabled:opacity-50"
                          >
                            {generating && <Loader2 className="h-3 w-3 animate-spin" />}
                            Regenerate
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleGenerateDrafts()}
                          disabled={generating || !impact || selectedDocIds.length === 0 || selected.status === "Closed"}
                          className="w-full py-2 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Generate Draft
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stage 3: Implementation Card */}
                  <div className="rounded-xl border border-slate-800 bg-[#040816]/75 p-5 flex flex-col justify-between min-h-[170px] hover:border-slate-700 transition duration-200">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Implementation</h4>
                        <span className={clsx(
                          "h-2.5 w-2.5 rounded-full",
                          tasks.length === 0 ? "bg-slate-600" :
                          selected.status === "Closed" ? "bg-emerald-500" : "bg-yellow-500"
                        )} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">
                        {tasks.length === 0 ? "Not Started" : 
                         selected.status === "Closed" ? "Complete" : "In Progress"}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                      { (remediationDrafts.length > 0 && (remediationDrafts.some(d => d.status === "APPROVED") || selected.status === "Draft Approved" || selected.status === "Implementation Planning" || selected.status === "Implementation Complete" || selected.status === "Closed" || tasks.length > 0)) ? (
                        tasks.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => router.push(`/cases/${selected.id}/implementation`)}
                              className="px-3.5 py-1.5 rounded bg-emerald-600/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600/20 transition duration-200"
                            >
                              Open Plan →
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/cases/${selected.id}/implementation?regenerate=true`)}
                              disabled={generatingTasks || selected.status === "Closed"}
                              className="px-3.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-750 transition duration-200 disabled:opacity-50"
                            >
                              Regenerate
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleGenerateTasks()}
                            disabled={generatingTasks || selected.status === "Closed"}
                            className="w-full py-2 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {generatingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Generate Plan
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-500 italic py-1">Awaiting draft approval</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Collapsible Impact Assessment findings detail */}
              {impact && showImpactDetails && (
                <div className="space-y-6 animate-fadeIn duration-200">
                  <AssessmentSummary regulation={selected} impact={impact} onOpenCitation={() => setCitationOpen(true)} />
                  <ImpactNarrative impact={impact} onOpenCitation={() => setCitationOpen(true)} />
                  
                  <AffectedDocumentsList
                    affectedDocs={impact.affected_documents || []}
                    selectedDocIds={selectedDocIds}
                    onToggleDoc={handleToggleDoc}
                  />
                </div>
              )}
              
              <AuditHistorySection history={selected?.audit_history || []} />
            </div>
          </section>
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
          const isUnopened = regulation.status === "Not Analyzed" || regulation.status === "pending_analysis";
          const isClosed = regulation.status === "Closed";
          const badgeLabel = isClosed ? "Closed Case" : (isUnopened ? "Unopened" : "Active Case");
          const badgeTone = isClosed ? "emerald" : (isUnopened ? "slate" : "blue");
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
                <StatusBadge label={badgeLabel} tone={badgeTone} />
                <button
                  type="button"
                  onClick={() => onRun(regulation)}
                  disabled={assessing || isClosed}
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
          <div className="flex items-center gap-3">
            <p className="text-xs font-extrabold uppercase text-slate-400">Regulatory Summary</p>
            <StatusBadge label={regulation?.status || "Not Analyzed"} tone="blue" />
          </div>
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

function AffectedDocumentsList({
  affectedDocs,
  selectedDocIds,
  onToggleDoc,
}: {
  affectedDocs: any[];
  selectedDocIds: string[];
  onToggleDoc: (docId: string) => void;
}) {
  if (!affectedDocs || affectedDocs.length === 0) return null;
  
  return (
    <section className="rounded-lg border border-slate-700 bg-[#081024] p-6 shadow-lg">
      <div className="border-b border-slate-800 pb-4 mb-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
          Affected Company Documents
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Select the documents you wish to generate remediation drafts for based on the FDA impact assessment.
        </p>
      </div>

      <div className="space-y-4">
        {affectedDocs.map((doc) => {
          const isChecked = selectedDocIds.includes(doc.document_id);
          return (
            <div
              key={doc.document_id}
              className={clsx(
                "p-4 rounded-lg border transition flex items-start gap-4",
                isChecked ? "border-blue-500/50 bg-[#0b1736]" : "border-slate-800 bg-[#040815]"
              )}
            >
              <input
                type="checkbox"
                id={`doc-check-${doc.document_id}`}
                checked={isChecked}
                onChange={() => onToggleDoc(doc.document_id)}
                className="mt-1 h-4 w-4 rounded border-slate-750 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {doc.document_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-850 text-slate-400 font-semibold uppercase">
                      {doc.document_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">Confidence:</span>
                    <span className={clsx(
                      "text-xs font-bold px-1.5 py-0.5 rounded",
                      doc.confidence_score >= 80 ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"
                    )}>
                      {doc.confidence_score}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-350 leading-relaxed bg-[#02050e] p-3 rounded border border-slate-850">
                  <strong className="text-blue-400 block mb-1">Affected Section Snippet:</strong>
                  {doc.affected_sections}
                </div>

                <p className="mt-2 text-xs text-slate-400 leading-normal">
                  <strong className="text-slate-300">Impact Explanation:</strong> {doc.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AuditHistorySection({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-700 bg-[#081024] p-6 shadow-lg">
      <div className="border-b border-slate-800 pb-4 mb-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
          GxP Case Audit History
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Immutable audit trail for this compliance case under 21 CFR Part 11.
        </p>
      </div>

      <div className="flow-root">
        <ul className="-mb-8">
          {history.map((event, idx) => (
            <li key={idx}>
              <div className="relative pb-8">
                {idx !== history.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-800"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-xs text-slate-250 leading-relaxed text-slate-200 font-semibold">
                        {event.event_type.replace(/_/g, " ").toUpperCase()}{" "}
                        <span className="font-normal text-slate-400">- {event.description}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap text-slate-500">
                      <time dateTime={event.timestamp}>
                        {new Date(event.timestamp).toLocaleString()}
                      </time>
                      <p className="text-[10px] text-slate-600 font-semibold">{event.user}</p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
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

export default function RegulationsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#020613] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <RegulationsPage />
    </Suspense>
  );
}
