"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, FileText, Link2, Loader2, Play, RefreshCw, ShieldCheck, Upload, X, Trash2 } from "lucide-react";
import clsx from "clsx";
import AssessmentLoadingView from "@/components/assessments/AssessmentLoadingView";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";
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
  fetchRegulationsFromFDA,
  uploadRegulation,
  deleteRegulation,
  type UploadRegulationPayload,
} from "@/lib/apiClient";
import { formatDate, getAccountDisplayName } from "@/lib/format";
import type { AuthUser, ImpactResponse, RegulationResponse, TaskResponse } from "@/types/api";

const MIN_ASSESSMENT_ANIMATION_MS = 6500;

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function CleanContentDisplay({ text }: { text?: string | null }) {
  if (!text) {
    return (
      <p className="mt-6 max-w-4xl text-base leading-7 text-slate-300">
        The selected update affects validated QMS controls.
      </p>
    );
  }

  // If GPO content/metadata is not present, render as standard paragraph (like AI Rationale)
  if (!text.includes("Federal Register") && !text.includes("CFR Part")) {
    return <p className="mt-6 max-w-4xl text-base leading-7 text-slate-300 whitespace-pre-wrap">{text}</p>;
  }

  let metaBlock = "";
  let cleanText = text;

  // Extract Federal Register metadata block if present
  const frRegex = /^\[Federal Register[^\]]+\][^]*?\[FR Doc[^\]]+\]/;
  const match = cleanText.match(frRegex);
  if (match) {
    metaBlock = match[0];
    cleanText = cleanText.substring(match[0].length).trim();
  }

  // Clean lines of separator noise: ============ or --------------
  cleanText = cleanText.replace(/^[=\-\s_]{4,}\s*$/gm, "");
  cleanText = cleanText.replace(/^[=\-\s_]{4,}/gm, "");
  cleanText = cleanText.replace(/[=\-\s_]{4,}$/gm, "");

  // Split by double newlines for paragraphs
  const paragraphs = cleanText.split(/\n\s*\n+/);

  return (
    <div className="mt-6 space-y-6 text-sm text-slate-300 leading-7 max-w-4xl">
      {metaBlock && (
        <div className="rounded-lg bg-[#040817] p-4 border border-slate-800 text-[11px] text-slate-400 space-y-2 font-mono">
          <p className="font-extrabold text-blue-400 uppercase tracking-wider text-[9px]">
            Federal Register Publication Info
          </p>
          <p className="leading-relaxed">
            {metaBlock
              .replace(/[\[\]]/g, " ")
              .replace(/\s+/g, " ")
              .trim()}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {paragraphs.map((p, idx) => {
          const trimmed = p.trim();
          if (!trimmed) return null;

          // Check if this is a main department / agency header
          const isAllCapsHeader =
            trimmed.toUpperCase() === trimmed &&
            trimmed.length < 150 &&
            (trimmed.includes("DEPARTMENT OF") ||
              trimmed.includes("ADMINISTRATION") ||
              trimmed.includes("COMMISSION"));

          if (isAllCapsHeader && !trimmed.includes(":")) {
            return (
              <h4
                key={idx}
                className="text-xs font-extrabold text-blue-400 tracking-widest uppercase border-l-2 border-blue-500 pl-3 mt-8 mb-3"
              >
                {trimmed}
              </h4>
            );
          }

          // Highlight common federal document sections
          const sectionPrefixes = [
            "SUMMARY:",
            "AGENCY:",
            "ACTION:",
            "DATES:",
            "ADDRESSES:",
            "FOR FURTHER INFORMATION CONTACT:",
            "SUPPLEMENTARY INFORMATION:",
            "BACKGROUND:",
          ];

          for (const prefix of sectionPrefixes) {
            if (trimmed.toUpperCase().startsWith(prefix)) {
              const content = trimmed.substring(prefix.length).trim();
              return (
                <div key={idx} className="mt-4 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                    {prefix.replace(":", "")}
                  </span>
                  <p className="text-slate-300 leading-relaxed pl-4 border-l border-slate-800/80">
                    {content}
                  </p>
                </div>
              );
            }
          }

          // Default paragraph
          return (
            <p key={idx} className="whitespace-pre-wrap leading-relaxed">
              {trimmed}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function waitForAssessmentAnimation(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MIN_ASSESSMENT_ANIMATION_MS);
  });
}

function normalizedStatus(status?: string | null): string {
  return (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

function affectedDocumentsCount(impact: ImpactResponse | null | undefined): number {
  if (!impact) return 0;
  if (typeof impact.affected_documents_count === "number") {
    return impact.affected_documents_count;
  }
  return impact.affected_documents?.length ?? 0;
}

function hasNoAffectedDocuments(impact: ImpactResponse | null | undefined): boolean {
  return !!impact && affectedDocumentsCount(impact) === 0;
}

function hasCompletedAssessment(
  regulation: RegulationResponse | null,
  activeImpact: ImpactResponse | null
): boolean {
  if (!regulation) return false;
  if (activeImpact?.regulation_id === regulation.id) return true;

  return [
    "analysis_complete",
    "impact_assessment_complete",
    "draft_approved",
    "implementation_planning",
    "implementation_complete",
    "closed",
  ].includes(normalizedStatus(regulation.status));
}

function displayStatusLabel(regulation: RegulationResponse, activeImpact: ImpactResponse | null): string {
  if (hasCompletedAssessment(regulation, activeImpact)) return "Analysis Complete";
  return regulation.status?.replace(/_/g, " ") || "Pending Analysis";
}

function markRegulationAssessed(
  regulation: RegulationResponse,
  impact?: ImpactResponse | null
): RegulationResponse {
  if (hasNoAffectedDocuments(impact)) {
    return { ...regulation, status: "Closed" };
  }
  if (normalizedStatus(regulation.status) === "closed") return regulation;
  return { ...regulation, status: "ANALYSIS_COMPLETE" };
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

  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
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
  const [activeCitationDoc, setActiveCitationDoc] = useState<any | null>(null);

  const handleOpenCitation = (doc: any) => {
    setActiveCitationDoc(doc);
    setCitationOpen(true);
  };

  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [selectedCaseImpact, setSelectedCaseImpact] = useState<ImpactResponse | null>(null);
  const [selectedCaseImpactLoading, setSelectedCaseImpactLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fetchingFDA, setFetchingFDA] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const [deletingRegulationId, setDeletingRegulationId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listRegulations();
      rows.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());
      setRegulations(rows);
      setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : null));
      setOpenedId((current) => (current && rows.some((row) => row.id === current) ? current : null));
    } catch {
      // Backend unreachable — show empty state, not demo data
      setRegulations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const caseId = searchParams.get("case_id") || searchParams.get("regulation_id");
    if (caseId && regulations.length > 0 && regulations.some(r => r.id === caseId)) {
      setSelectedId(caseId);
      setOpenedId(caseId);
    }
  }, [searchParams, regulations]);

  function triggerDeleteRegulation(id: string) {
    setDeletingRegulationId(id);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deletingRegulationId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteRegulation(deletingRegulationId);
      setRegulations((prev) => prev.filter((r) => r.id !== deletingRegulationId));
      if (openedId === deletingRegulationId) {
        setOpenedId(null);
      }
      if (selectedId === deletingRegulationId) {
        setSelectedId(null);
      }
      setFetchMsg("Regulation successfully deleted.");
      setDeleteConfirmOpen(false);
      setDeletingRegulationId(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete regulation. It may have active remediation drafts or implementation tasks.");
    } finally {
      setIsDeleting(false);
    }
  }


  async function handleFetchFromFDA() {
    setFetchingFDA(true);
    try {
      const res = await fetchRegulationsFromFDA(10);
      setFetchMsg(`Fetched ${res.ingested_count} new regulation(s) from the FDA.`);
      void load();
    } catch (err: any) {
      setFetchMsg(err?.message || "Failed to fetch from FDA.");
    } finally {
      setFetchingFDA(false);
    }
  }

  const selectedRailRegulation = useMemo(
    () => regulations.find((regulation) => regulation.id === selectedId) ?? null,
    [regulations, selectedId]
  );

  const selected = useMemo(
    () => regulations.find((regulation) => regulation.id === openedId) ?? null,
    [regulations, openedId]
  );

  const relatedDocs = useMemo(() => {
    const activeImpact =
      impact?.regulation_id === (selectedRailRegulation?.id || selected?.id)
        ? impact
        : selectedCaseImpact?.regulation_id === (selectedRailRegulation?.id || selected?.id)
          ? selectedCaseImpact
          : null;
    return activeImpact?.affected_documents?.map((d: any) => ({
      id: d.document_id,
      filename: d.document_name || "SOP Document",
    })) || [];
  }, [impact, selectedCaseImpact, selectedRailRegulation, selected]);

  // Fetch existing case artifacts only when a case is explicitly opened.
  useEffect(() => {
    if (!openedId) {
      setImpact(null);
      setRemediationDrafts([]);
      setSelectedDocIds([]);
      setTasks([]);
      setShowImpactDetails(true);
      setCitationOpen(false);
      return;
    }

    setImpact(null);
    setRemediationDrafts([]);
    setSelectedDocIds([]);
    setTasks([]);
    setShowImpactDetails(true);
    
    getImpactForRegulation(openedId)
      .then((res) => {
        setImpact(res);
        if (res.affected_documents) {
          setSelectedDocIds(res.affected_documents.map((d: any) => d.document_id));
        }
      })
      .catch(() => {
        setImpact(null);
      });

    listRemediations(openedId)
      .then((drafts) => {
        setRemediationDrafts(drafts);
      })
      .catch(() => {});

    listTasks()
      .then((allTasks) => {
        const filtered = allTasks.filter((t) => t.regulation_id === openedId && t.status !== "REJECTED");
        setTasks(filtered);
      })
      .catch(() => {});
  }, [openedId]);

  useEffect(() => {
    if (!selectedRailRegulation) {
      setSelectedCaseImpact(null);
      setSelectedCaseImpactLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedCaseImpact(null);
    setSelectedCaseImpactLoading(true);

    getImpactForRegulation(selectedRailRegulation.id)
      .then((res) => {
        if (!cancelled) setSelectedCaseImpact(res);
      })
      .catch(() => {
        if (!cancelled) setSelectedCaseImpact(null);
      })
      .finally(() => {
        if (!cancelled) setSelectedCaseImpactLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRailRegulation]);

  async function handleRunAssessment(regulation = selected) {
    if (!regulation) return;
    setSelectedId(regulation.id);
    setOpenedId(regulation.id);
    setAssessing(true);
    const minimumAnimation = waitForAssessmentAnimation();
    try {
      const res = await runImpactAssessment(regulation.id);
      setImpact(res);
      setSelectedCaseImpact(res);
      setRegulations((prev) =>
        prev.map((item) => (item.id === regulation.id ? markRegulationAssessed(item, res) : item))
      );
      if (res.affected_documents && res.affected_documents.length > 0) {
        setSelectedDocIds(res.affected_documents.map((d: any) => d.document_id));
      } else {
        setSelectedDocIds([]);
      }
    } catch (err: any) {
      alert(err?.message || "Impact assessment failed. Please check the backend connection.");
    } finally {
      await minimumAnimation;
      setAssessing(false);
    }
  }

  async function handleGenerateDrafts(regulation = selected) {
    if (!regulation) return;
    const availableImpact =
      impact?.regulation_id === regulation.id
        ? impact
        : selectedCaseImpact?.regulation_id === regulation.id
          ? selectedCaseImpact
          : null;

    if (!hasCompletedAssessment(regulation, availableImpact)) return;
    if (hasNoAffectedDocuments(availableImpact)) return;

    setSelectedId(regulation.id);
    setOpenedId(regulation.id);
    setGenerating(true);
    const documentIds =
      impact?.regulation_id === regulation.id && selectedDocIds.length > 0
        ? selectedDocIds
        : availableImpact?.affected_documents?.map((document) => document.document_id) ?? [];

    try {
      const created = await generateRemediationDrafts(
        regulation.id,
        documentIds.length > 0 ? documentIds : undefined
      );
      const scopedDrafts = created.filter((draft) => draft.regulation_id === regulation.id);
      if (scopedDrafts.length > 0) {
        setRemediationDrafts(scopedDrafts);
        router.push(`/remediation/${scopedDrafts[0].id}`);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to generate remediation drafts.");
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

  function handleRailSelect(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      if (openedId === id) setOpenedId(null);
      return;
    }

    setSelectedId(id);
    setOpenedId(null);
  }

  function handleRailOpen(id: string) {
    setSelectedId(id);
    setOpenedId(id);
  }

  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const selectedRailImpact =
    impact?.regulation_id === selectedRailRegulation?.id
      ? impact
      : selectedCaseImpact?.regulation_id === selectedRailRegulation?.id
        ? selectedCaseImpact
        : null;
  const canGenerateSelectedDrafts =
    hasCompletedAssessment(selectedRailRegulation, selectedRailImpact) &&
    !hasNoAffectedDocuments(selectedRailImpact);
  const selectedIsClosed = normalizedStatus(selected?.status) === "closed";
  const selectedHasNoAffectedDocs = hasNoAffectedDocuments(impact);
  const selectedStatusComplete = selected ? hasCompletedAssessment(selected, impact) : false;
  const selectedStatusLabel = selected
    ? selectedIsClosed
      ? selectedHasNoAffectedDocs
        ? "Closed — No Action Required"
        : "Closed Case"
      : displayStatusLabel(selected, impact)
    : "Not Analyzed";
  const selectedStatusTone = selectedIsClosed || selectedStatusComplete ? "emerald" : "amber";
  const selectedStatusDescription = selectedIsClosed
    ? selectedHasNoAffectedDocs
      ? "No company documents are affected; this case was closed automatically."
      : "Case has been closed after implementation review."
    : selectedStatusComplete
      ? "Impact assessment is complete and ready for the next workflow step."
      : "Run the assessment to determine affected controls.";

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {(successMsg || fetchMsg) && (
          <div className="mx-6 mt-6 p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-200 flex items-center justify-between text-sm">
            <span>{successMsg || fetchMsg}</span>
            <button type="button" onClick={() => { setSuccessMsg(null); setFetchMsg(null); }} className="text-slate-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}
        {assessing ? (
          <AssessmentLoadingView 
            regulationTitle={selectedRailRegulation?.title || selected?.title} 
            documents={relatedDocs.length > 0 ? relatedDocs : undefined}
            affectedFileCount={relatedDocs.length > 0 ? relatedDocs.length : null}
          />
        ) : !selected ? (
          <RegulationsHome
            welcomeName={getAccountDisplayName(user)}
            hasRegulations={regulations.length > 0}
            selectedRegulation={selectedRailRegulation}
            canGenerateDrafts={canGenerateSelectedDrafts}
            checkingAssessment={selectedCaseImpactLoading}
            assessing={assessing}
            generating={generating}
            fetchingFDA={fetchingFDA}
            onRunAssessment={() => void handleRunAssessment(selectedRailRegulation)}
            onGenerateDrafts={() => void handleGenerateDrafts(selectedRailRegulation)}
            onFetchFromFDA={() => void handleFetchFromFDA()}
            onUpload={() => setShowUploadModal(true)}
          />
        ) : (
          <section className="px-6 py-8 md:px-10">
            <div className="mx-auto max-w-5xl space-y-8 pb-32">
              
              {/* Compliance Case Dashboard Header */}
              <div className="rounded-2xl border border-slate-750 bg-[#081024]/90 p-6 shadow-2xl space-y-6 backdrop-blur-sm">
                <div className="grid gap-5 border-b border-slate-800 pb-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-blue-400 tracking-wider">Compliance Case</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1 leading-tight">{selected.title}</h2>
                    <p className="text-xs text-slate-400 mt-2">
                      Source: {hostFor(selected.source_url)} | Published {formatDate(selected.published_date)}
                    </p>
                  </div>
                  <div className="border-t border-slate-800 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                          selectedIsClosed || selectedStatusComplete
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        )}
                      >
                        {selectedIsClosed || selectedStatusComplete ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Clock3 className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                          Status
                        </p>
                        <StatusBadge
                          label={selectedStatusLabel}
                          tone={selectedStatusTone}
                          className="mt-2 px-2.5 py-1 text-xs"
                        />
                        <p className="mt-2 text-xs leading-5 text-slate-400">{selectedStatusDescription}</p>
                      </div>
                    </div>
                    {selectedIsClosed ? (
                      <button
                        type="button"
                        onClick={() => void handleReopenCase()}
                        disabled={closingCase}
                        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-[11px] font-bold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
                      >
                        {closingCase ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reopen Case"}
                      </button>
                    ) : (
                      !["not_analyzed", "pending_analysis"].includes(normalizedStatus(selected.status)) && (
                        <button
                          type="button"
                          onClick={() => void handleCloseCase()}
                          disabled={closingCase}
                          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-[11px] font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
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
                        impact
                          ? selectedHasNoAffectedDocs
                            ? "bg-slate-700/40 text-slate-300 border-slate-600/50"
                            : affectedDocumentsCount(impact) > 0
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          : "bg-slate-800 text-slate-500 border-slate-700"
                      )}>
                        {impact
                          ? selectedHasNoAffectedDocs
                            ? "–"
                            : affectedDocumentsCount(impact) > 0
                              ? "✓"
                              : "⚪"
                          : "⚪"}
                      </span>
                      <span className={clsx(
                        impact && (selectedHasNoAffectedDocs || affectedDocumentsCount(impact) > 0)
                          ? selectedHasNoAffectedDocs
                            ? "text-slate-400 font-medium"
                            : "text-slate-200 font-bold"
                          : "text-slate-500"
                      )}>
                        {selectedHasNoAffectedDocs ? "None Affected" : "Documents Identified"}
                      </span>
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
                      {selectedHasNoAffectedDocs ? (
                        <span className="text-[11px] text-slate-500 italic py-1">No action required</span>
                      ) : remediationDrafts.length > 0 ? (
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
                            disabled={generating || !impact || selected.status === "Closed"}
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
                          disabled={generating || !impact || selected.status === "Closed" || selectedHasNoAffectedDocs}
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
                      {selectedHasNoAffectedDocs ? (
                        <span className="text-[11px] text-slate-500 italic py-1">No action required</span>
                      ) : (remediationDrafts.length > 0 && (remediationDrafts.some(d => d.status === "APPROVED") || selected.status === "Draft Approved" || selected.status === "Implementation Planning" || selected.status === "Implementation Complete" || selected.status === "Closed" || tasks.length > 0)) ? (
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
                  <AssessmentSummary regulation={selected} impact={impact} onOpenCitation={handleOpenCitation} />
                  <ImpactNarrative impact={impact} onOpenCitation={handleOpenCitation} />
                  
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
        selectedId={selectedId}
        loading={loading}
        fetchingFDA={fetchingFDA}
        impact={impact}
        selectedImpact={selectedCaseImpact}
        assessing={assessing}
        onFetch={() => void handleFetchFromFDA()}
        onUpload={() => setShowUploadModal(true)}
        onSelect={handleRailSelect}
        onOpen={handleRailOpen}
        onRun={(regulation) => void handleRunAssessment(regulation)}
        onDelete={triggerDeleteRegulation}
      />

      <CitationPanel
        open={citationOpen}
        onClose={() => {
          setCitationOpen(false);
          setActiveCitationDoc(null);
        }}
        regulation={selected}
        activeDoc={activeCitationDoc}
      />

      {showUploadModal && (
        <UploadRegulationModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(reg) => {
            setShowUploadModal(false);
            setRegulations((prev) => [reg, ...prev]);
            setFetchMsg(`Regulation "${reg.title}" uploaded successfully.`);
          }}
        />
      )}

      {deleteConfirmOpen && (
        <Modal
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Regulation Update"
          description="Confirm removal of this regulatory case. This action will permanently delete all associated AI impact assessments."
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-10 rounded-md border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Delete
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {deleteError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-250">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-slate-350 leading-relaxed">
              Are you sure you want to delete this regulation? If there are any active remediation drafts or implementation tasks, deletion will be blocked to preserve GxP audit trails.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RegulationsHome({
  welcomeName,
  hasRegulations,
  selectedRegulation,
  canGenerateDrafts,
  checkingAssessment,
  assessing,
  generating,
  fetchingFDA,
  onRunAssessment,
  onGenerateDrafts,
  onFetchFromFDA,
  onUpload,
}: {
  welcomeName: string;
  hasRegulations: boolean;
  selectedRegulation: RegulationResponse | null;
  canGenerateDrafts: boolean;
  checkingAssessment: boolean;
  assessing: boolean;
  generating: boolean;
  fetchingFDA: boolean;
  onRunAssessment: () => void;
  onGenerateDrafts: () => void;
  onFetchFromFDA: () => void;
  onUpload: () => void;
}) {
  // Empty state — no regulations in the database yet
  if (!hasRegulations) {
    return (
      <section className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50">
            <FileText className="h-8 w-8 text-slate-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">No regulations found</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your regulatory database is empty. Get started by fetching guidance updates from the FDA or uploading a regulation document.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onFetchFromFDA}
              disabled={fetchingFDA}
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-sm font-extrabold text-white shadow-[0_16px_40px_rgba(37,99,235,0.18)] hover:bg-blue-500 disabled:opacity-50"
            >
              {fetchingFDA ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              Fetch from FDA
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-6 text-sm font-extrabold text-slate-200 hover:bg-slate-700"
            >
              <Upload className="h-5 w-5" />
              Upload Regulation
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Regulations exist — show workflow home
  const assessmentDisabled = !selectedRegulation || assessing;
  const draftsDisabled = !selectedRegulation || checkingAssessment || !canGenerateDrafts || generating;

  return (
    <section className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl text-center">
        <h1 className="break-words text-3xl font-extrabold uppercase tracking-normal text-white md:text-4xl">
          WELCOME, {welcomeName}!
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-normal text-slate-300">
          SELECT REGULATION THEN, RUN IMPACT ASSESSMENT
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row">
          <button
            type="button"
            data-testid="home-run-assessment"
            onClick={onRunAssessment}
            disabled={assessmentDisabled}
            title={!selectedRegulation ? "Select a regulation from the right rail first." : undefined}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-sm font-extrabold text-white shadow-[0_16px_40px_rgba(37,99,235,0.18)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-72"
          >
            {assessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-white" />}
            Run Impact Assessment
          </button>
          <button
            type="button"
            data-testid="home-generate-drafts"
            onClick={onGenerateDrafts}
            disabled={draftsDisabled}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-6 text-sm font-extrabold text-slate-950 shadow-[0_16px_40px_rgba(255,255,255,0.08)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-72"
          >
            {checkingAssessment || generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            Generate Remediation Drafts
          </button>
        </div>
      </div>
    </section>
  );
}

function RegulationRail({
  regulations,
  selectedId,
  loading,
  fetchingFDA,
  impact,
  selectedImpact,
  assessing,
  onFetch,
  onUpload,
  onSelect,
  onOpen,
  onRun,
  onDelete,
}: {
  regulations: RegulationResponse[];
  selectedId: string | null;
  loading: boolean;
  fetchingFDA: boolean;
  impact: ImpactResponse | null;
  selectedImpact: ImpactResponse | null;
  assessing: boolean;
  onFetch: () => void;
  onUpload: () => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRun: (regulation: RegulationResponse) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="hidden w-shell-rail flex-shrink-0 overflow-y-auto border-l border-slate-700 bg-[#020613] px-4 py-6 xl:block">
      {/* Action buttons */}
      <div className="mb-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onFetch}
          disabled={fetchingFDA}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", fetchingFDA && "animate-spin")} />
          {fetchingFDA ? "Fetching…" : "Fetch from FDA"}
        </button>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Regulation
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : regulations.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-center">
          <p className="text-xs font-semibold text-slate-400">No regulations yet.</p>
          <p className="mt-1 text-[11px] text-slate-600">Use the buttons above to add regulations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {regulations.map((regulation) => {
            const active = regulation.id === selectedId;
            const activeImpact =
              impact?.regulation_id === regulation.id
                ? impact
                : selectedImpact?.regulation_id === regulation.id
                  ? selectedImpact
                  : null;
            const analyzed = hasCompletedAssessment(regulation, activeImpact);
            const isClosed = normalizedStatus(regulation.status) === "closed";
            const badgeLabel = isClosed ? "Closed Case" : displayStatusLabel(regulation, activeImpact);
            const badgeTone = isClosed ? "emerald" : analyzed ? "emerald" : "amber";
            const isUpload = regulation.source === "DOCUMENT_UPLOAD";
            return (
              <article
                key={regulation.id}
                className={clsx(
                  "rounded-lg border bg-slate-800/90 p-4 transition",
                  active ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.35)]" : "border-slate-700"
                )}
              >
                <button
                  type="button"
                  data-testid={`regulation-card-${regulation.id}`}
                  onClick={() => onSelect(regulation.id)}
                  onDoubleClick={() => onOpen(regulation.id)}
                  aria-pressed={active}
                  className="block w-full text-left"
                >
                  <h2 className="line-clamp-3 text-sm font-extrabold uppercase leading-5 text-white">
                    {regulation.title}
                  </h2>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    {isUpload ? (
                      <><Upload className="h-3 w-3" /> Uploaded Document</>
                    ) : (
                      <><Link2 className="h-3.5 w-3.5" />{hostFor(regulation.source_url)}</>
                    )}
                  </p>
                </button>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge label={badgeLabel} tone={badgeTone} />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid={`regulation-run-${regulation.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRun(regulation);
                      }}
                      disabled={assessing || isClosed}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {assessing && active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-white" />}
                      {analyzed ? "Rerun" : "Run"}
                    </button>
                    <button
                      type="button"
                      data-testid={`regulation-delete-${regulation.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(regulation.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-750 bg-slate-800 text-slate-400 hover:border-rose-500 hover:text-rose-400 transition"
                      title="Delete Regulation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
  onOpenCitation: (doc: any) => void;
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
      <CleanContentDisplay
        text={
          (() => {
            const classificationRationale = regulation?.rationale || "";
            const classificationFailed =
              classificationRationale.startsWith("Analysis failed due to error:") ||
              classificationRationale.includes("fireworks-ai package is not installed");
            if (classificationFailed && impact?.rationale) return impact.rationale;
            return classificationRationale || regulation?.raw_content;
          })()
        }
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {impact.affected_departments.map((department) => (
          <StatusBadge key={department} label={department} tone="blue" />
        ))}
        {impact.affected_documents && impact.affected_documents.length > 0 && (
          <button
            type="button"
            onClick={() => impact.affected_documents?.[0] && onOpenCitation(impact.affected_documents[0])}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Citation detail
          </button>
        )}
      </div>
    </section>
  );
}

function ImpactNarrative({
  impact,
  onOpenCitation,
}: {
  impact: ImpactResponse;
  onOpenCitation: (doc: any) => void;
}) {
  const docs = impact.affected_documents || [];
  return (
    <section className="rounded-lg border border-slate-700 bg-[#081024] p-6">
      <p className="text-xs font-extrabold uppercase text-slate-400">Impact Assessment</p>
      <p className="mt-6 text-base leading-7 text-slate-300">
        {impact.rationale}
      </p>
      {docs.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-5 text-xs text-slate-500">
          <p className="mb-2 font-semibold text-slate-400">Retrieved SOP Citations:</p>
          {docs.map((doc: any, index: number) => (
            <button
              key={doc.document_id || index}
              type="button"
              onClick={() => onOpenCitation(doc)}
              className="block text-left hover:text-blue-300 mt-2 font-medium"
            >
              [{index + 1}] {doc.document_name} - {doc.document_type || "SOP"} (Click for details)
            </button>
          ))}
        </div>
      )}
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
  if (!affectedDocs || affectedDocs.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700 bg-[#081024] p-6 shadow-lg">
        <p className="text-sm text-slate-300 leading-relaxed">
          No company documents are affected by this regulation.
        </p>
      </section>
    );
  }
  
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
  activeDoc,
}: {
  open: boolean;
  onClose: () => void;
  regulation: RegulationResponse | null;
  activeDoc: any | null;
}) {
  if (!open) return null;

  const title = activeDoc?.document_name || "Knowledge Base Citation";
  const type = activeDoc?.document_type || "SOP";
  const snippet = activeDoc?.affected_sections || "No matching snippet text retrieved.";
  const explanation = activeDoc?.explanation || "This document was matched based on semantic similarity to the new regulations.";

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
          <h2 className="text-2xl font-extrabold text-white">{title}</h2>
          <p className="mt-2 text-base italic text-slate-200">{type}</p>
        </div>
        <div className="mt-8 rounded-lg border border-slate-600 bg-[#081024] p-6 text-sm leading-8 text-slate-200">
          <p className="text-xs font-bold uppercase text-slate-500 mb-2">Retrieved Snippet from Vector DB</p>
          <div className="font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto p-3 bg-slate-950 rounded border border-slate-850">
            {snippet}
          </div>
        </div>
        <div className="mt-8 rounded-lg bg-[#0a132d] p-6">
          <p className="text-xs font-extrabold uppercase text-slate-400">Matched Regulation</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            {regulation?.title ?? "FDA Regulatory Update"}
          </p>
        </div>
        <div className="mt-8">
          <p className="text-xs font-extrabold uppercase text-slate-400">Compliance Gap Explanation</p>
          <p className="mt-3 text-base leading-7 text-slate-300">
            {explanation}
          </p>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Regulation Modal
// ---------------------------------------------------------------------------

function UploadRegulationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (reg: RegulationResponse) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [authority, setAuthority] = useState("FDA");
  const [docNumber, setDocNumber] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [category, setCategory] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [summary, setSummary] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File | null) {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) { setError("File and title are required."); return; }
    setUploading(true);
    setError(null);
    try {
      const reg = await uploadRegulation({
        file,
        title: title.trim(),
        regulatory_authority: authority || "FDA",
        document_number: docNumber || undefined,
        published_date: pubDate || undefined,
        category: category || undefined,
        effective_date: effectiveDate || undefined,
        summary: summary || undefined,
      });
      onSuccess(reg);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#08101e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Upload Regulation</p>
            <h2 className="text-base font-extrabold text-white">Upload a Regulation Document</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{error}</div>
          )}

          {/* File drop zone */}
          <label className="block">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">PDF / TXT File <span className="text-rose-400">*</span></p>
            <div
              className={clsx(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer",
                file ? "border-blue-500/50 bg-blue-500/5" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
              )}
              onClick={() => document.getElementById("reg-file-input")?.click()}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-blue-400 mb-2" />
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Click to select a file</p>
                  <p className="text-xs text-slate-500 mt-1">PDF or TXT, up to 20 MB</p>
                </>
              )}
            </div>
            <input
              id="reg-file-input"
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Title <span className="text-rose-400">*</span></p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. FDA Guidance on Electronic Records"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/60 focus:outline-none"
              />
            </label>
            <label>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Regulatory Authority</p>
              <input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="FDA"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/60 focus:outline-none" />
            </label>
            <label>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Document Number</p>
              <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. FDA-2026-N-0001"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/60 focus:outline-none" />
            </label>
            <label>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Publication Date</p>
              <input type="date" value={pubDate} onChange={(e) => setPubDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500/60 focus:outline-none" />
            </label>
            <label>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Category</p>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Validation"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/60 focus:outline-none" />
            </label>
            <label>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Effective Date</p>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500/60 focus:outline-none" />
            </label>
            <label className="sm:col-span-2">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Summary</p>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Brief description of this regulation…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/60 focus:outline-none resize-none" />
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={!file || !title.trim() || uploading}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload</>}
            </button>
          </div>
        </form>
      </div>
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
