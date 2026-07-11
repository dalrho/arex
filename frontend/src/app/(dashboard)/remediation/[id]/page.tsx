"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Loader2,
  PenLine,
  Play,
  RefreshCw,
  XCircle,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import clsx from "clsx";
import AssessmentLoadingView from "@/components/assessments/AssessmentLoadingView";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getDocument,
  getRegulation,
  getRemediation,
  listRemediations,
  listRegulations,
  runImpactAssessment,
  submitApprovalDecision,
  updateRemediation,
  resetRemediation
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type {
  DocumentResponse,
  ImpactResponse,
  RegulationResponse,
  RemediationResponse,
} from "@/types/api";

const MIN_ASSESSMENT_ANIMATION_MS = 6500;

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function waitForAssessmentAnimation(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MIN_ASSESSMENT_ANIMATION_MS);
  });
}

function normalizedStatus(status?: string | null): string {
  return (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

function hasCompletedAssessment(
  regulation: RegulationResponse,
  impact: ImpactResponse | null,
  remediationDraft: RemediationResponse | null
): boolean {
  if (impact?.regulation_id === regulation.id) return true;
  if (remediationDraft?.regulation_id === regulation.id) return true;

  return [
    "analysis_complete",
    "impact_assessment_complete",
    "active_case",
    "pending_review",
    "draft_approved",
    "implementation_planning",
    "implementation_complete",
    "closed",
  ].includes(normalizedStatus(regulation.status));
}


export default function RemediationReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<RemediationResponse[]>([]);
  const [railDrafts, setRailDrafts] = useState<RemediationResponse[]>([]);
  const [documentsMap, setDocumentsMap] = useState<Record<string, DocumentResponse>>({});
  const [regulation, setRegulation] = useState<RegulationResponse | null>(null);
  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regulationsLoading, setRegulationsLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  
  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<RemediationResponse | null>(null);
  const [editText, setEditText] = useState("");
  const [editComments, setEditComments] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRegulations = useCallback(async () => {
    setRegulationsLoading(true);
    try {
      const rows = await listRegulations();
      setRegulations(rows);
    } catch {
      setRegulations([]);
    } finally {
      setRegulationsLoading(false);
    }
  }, []);

  const loadRailDrafts = useCallback(async () => {
    try {
      const rows = await listRemediations();
      setRailDrafts(rows);
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let initialDraft: RemediationResponse | null = null;
    try {
      initialDraft = await getRemediation(params.id);
    } catch {
      initialDraft = null;
    }

    if (!initialDraft) {
      setDrafts([]);
      setRegulation(null);
      setLoading(false);
      return;
    }

    try {
      const reg = await getRegulation(initialDraft.regulation_id);
      setRegulation(reg);
    } catch {
      setRegulation(null);
    }

    try {
      const allDrafts = await listRemediations(initialDraft.regulation_id);
      setDrafts(allDrafts);

      setRailDrafts(allDrafts);

      // Load documents for all drafts
      const docPromises = allDrafts.map((d) =>
        getDocument(d.sopId || d.document_id).catch(() => null)
      );
      const docs = await Promise.all(docPromises);
      const map: Record<string, DocumentResponse> = {};
      docs.forEach((doc) => {
        if (doc) map[doc.id] = doc;
      });
      setDocumentsMap(map);
    } catch {
      setDrafts([initialDraft]);
    }

    void loadRegulations();
    void loadRailDrafts();
    setLoading(false);
  }, [params.id, loadRegulations, loadRailDrafts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDecision(draftId: string, decision: "APPROVED" | "REJECTED" | "UNDER_REVIEW") {
    setSubmittingIds((prev) => ({ ...prev, [draftId]: true }));
    setMessage(null);
    try {
      await submitApprovalDecision(draftId, decision);
      
      // Update local draft status
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id === draftId) {
            return {
              ...d,
              status: decision,
              reviewer_id: "QA Manager", // visually represent the QA Manager signature
              reviewed_at: new Date().toISOString()
            };
          }
          return d;
        })
      );
      
      // Reload regulation to see if its status updated
      if (regulation) {
        getRegulation(regulation.id).then((r) => setRegulation(r)).catch(() => null);
      }
      
      setMessage(`SOP Draft status updated to ${decision.replace(/_/g, " ")}.`);
    } catch (err: any) {
      alert(err.message || "Failed to update draft status.");
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [draftId]: false }));
    }
  }

  async function handleResetDraft(draftId: string) {
    setSubmittingIds((prev) => ({ ...prev, [draftId]: true }));
    setMessage(null);
    try {
      const updated = await resetRemediation(draftId);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
      setMessage("Remediation draft reset to Draft status.");
    } catch (err: any) {
      alert(err.message || "Failed to reset draft.");
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [draftId]: false }));
    }
  }

  async function handleRunAssessment(target: RegulationResponse) {
    setAssessing(true);
    const minimumAnimation = waitForAssessmentAnimation();
    try {
      setImpact(await runImpactAssessment(target.id));
    } catch {
      setImpact(null);
      alert("Failed to run impact assessment.");
    } finally {
      await minimumAnimation;
      setAssessing(false);
    }
  }

  function handleFetchRail() {
    void loadRegulations();
    void loadRailDrafts();
  }

  function handleOpenDraftForRegulation(target: RegulationResponse) {
    const nextDraft = railDrafts.find((item) => item.regulation_id === target.id);
    if (nextDraft) {
      router.push(`/remediation/${nextDraft.id}`);
    } else {
      listRemediations(target.id)
        .then((allDrafts) => {
          if (allDrafts.length > 0) {
            router.push(`/remediation/${allDrafts[0].id}`);
          } else {
            alert("No remediation drafts found for this regulation.");
          }
        })
        .catch(() => {
          alert("Failed to load drafts for this regulation.");
        });
    }
  }

  function openEditModal(draft: RemediationResponse) {
    setEditingDraft(draft);
    setEditText(draft.proposedRevision || draft.proposed_text || "");
    setEditComments(draft.comments || "");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingDraft) return;
    setSavingEdit(true);
    try {
      const updated = await updateRemediation(editingDraft.id, editText, editComments);
      setDrafts((prev) => prev.map((d) => (d.id === editingDraft.id ? updated : d)));
      setMessage("Draft revision and comments updated.");
    } catch {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === editingDraft.id
            ? { ...d, proposed_text: editText, proposedRevision: editText, comments: editComments }
            : d
        )
      );
    } finally {
      setSavingEdit(false);
      setEditOpen(false);
      setEditingDraft(null);
    }
  }



  const selectedRegulationId = regulation?.id ?? null;
  const allApproved = drafts.length > 0 && drafts.every((d) => d.status === "APPROVED");

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="px-6 py-6 md:px-10">
          <div className="mx-auto max-w-6xl pb-28">
            <Link
              href="/regulations"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Regulatory Updates
            </Link>

            {/* Regulation Header Context */}
            {regulation && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-[#081024]/40 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                      {regulation.regulatory_authority ?? "FDA"}
                    </span>
                    <h2 className="text-xl font-extrabold text-white">{regulation.title}</h2>
                    <p className="text-sm text-slate-400">
                      Effective Date: {regulation.effective_date ?? "N/A"} | Document:{" "}
                      {regulation.document_number ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <StatusBadge label={regulation.status} />
                  </div>
                </div>
                {regulation.summary && (
                  <p className="mt-4 text-sm leading-6 text-slate-300 bg-slate-950/45 p-4 rounded-lg border border-slate-850">
                    <strong className="text-slate-200">Regulation Summary:</strong> {regulation.summary}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-extrabold text-white">Remediation Drafts</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Each affected SOP must be updated, reviewed, and approved independently.
                </p>
              </div>

              {allApproved && (
                <Link
                  href={`/tasks?regulation_id=${regulation?.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/50"
                >
                  <ClipboardList className="h-4 w-4" />
                  View Implementation Tasks
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {message && (
              <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                {message}
              </div>
            )}

            {assessing ? (
              <AssessmentLoadingView />
            ) : loading ? (
              <div className="mt-8 flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading remediation drafts...
              </div>
            ) : drafts.length === 0 ? (
              <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                No remediation drafts have been generated for this case. Run Impact Assessment first.
              </div>
            ) : (
              <div className="mt-8 space-y-10">
                {drafts.map((draftItem) => {
                  const doc = documentsMap[draftItem.sopId || draftItem.document_id] || null;
                  const isSubmitting = submittingIds[draftItem.id] || false;
                  return (
                    <DraftCard
                      key={draftItem.id}
                      draft={draftItem}
                      document={doc}
                      regulation={regulation}
                      isSubmitting={isSubmitting}
                      onApprove={() => void handleDecision(draftItem.id, "APPROVED")}
                      onReject={() => void handleDecision(draftItem.id, "REJECTED")}
                      onSubmitForReview={() => void handleDecision(draftItem.id, "UNDER_REVIEW")}
                      onEdit={() => openEditModal(draftItem)}
                      onReset={() => void handleResetDraft(draftItem.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <RegulationRail
        regulations={regulations}
        selectedId={selectedRegulationId}
        loading={regulationsLoading}
        impact={impact}
        currentDraft={drafts[0] || null}
        railDrafts={railDrafts}
        assessing={assessing}
        onFetch={handleFetchRail}
        onOpenDraft={handleOpenDraftForRegulation}
        onRun={(target) => void handleRunAssessment(target)}
      />

      {/* Edit proposed text & comment modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Proposed Revision & Reviewer Notes"
        description="Modify the GxP policy revisions and add electronic signature review notes."
        widthClassName="max-w-4xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="h-10 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Revisions
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Proposed SOP Revision Text
            </label>
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              className="min-h-[280px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm leading-6 text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Reviewer Notes / Comments (GxP Audit Log)
            </label>
            <textarea
              value={editComments}
              onChange={(event) => setEditComments(event.target.value)}
              placeholder="Provide context or instructions for revision..."
              className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface DraftCardProps {
  draft: RemediationResponse;
  document: DocumentResponse | null;
  regulation: RegulationResponse | null;
  isSubmitting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSubmitForReview: () => void;
  onEdit: () => void;
  onReset: () => void;
}

function DraftCard({
  draft,
  document,
  regulation,
  isSubmitting,
  onApprove,
  onReject,
  onSubmitForReview,
  onEdit,
  onReset
}: DraftCardProps) {
  const currentStatus = (draft.status || "Draft").toUpperCase();
  const isApproved = currentStatus === "APPROVED";
  const isRejected = currentStatus === "REJECTED";
  const isUnderReview = currentStatus === "UNDER_REVIEW" || currentStatus === "PENDING_REVIEW";
  
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#081024]/60 backdrop-blur-sm shadow-md">
      {/* SOP Info Header */}
      <div className="border-b border-slate-800 bg-[#0f1b3a]/50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold uppercase text-slate-100 tracking-wider">
            {document ? document.filename : "Standard Operating Procedure"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Document ID: {draft.sopId || draft.document_id} | Version: {document?.version ?? 1}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge label={draft.status} />
        </div>
      </div>

      {/* Content Comparison Grid */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        <div className="p-6 bg-[#040914]/20">
          <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Current SOP Text</p>
          <div className="whitespace-pre-line text-sm leading-7 text-slate-300 font-mono bg-slate-950/40 p-4 rounded-lg border border-slate-900/60 min-h-[220px]">
            {draft.currentContent || draft.original_text}
          </div>
        </div>
        <div className="p-6 bg-[#0c1630]/20">
          <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Proposed Revision</p>
          <div className="whitespace-pre-line text-sm leading-7 text-emerald-300 font-mono bg-slate-950/40 p-4 rounded-lg border border-slate-900/60 min-h-[220px]">
            {draft.proposedRevision || draft.proposed_text}
          </div>
        </div>
      </div>

      {/* Metadata and Reviewer Notes */}
      <div className="border-t border-slate-800 p-6 space-y-4 bg-[#0a1228]/40">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Reason for Revision</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {draft.explanation || "Updates policy to align with FDA GxP requirements."}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Citations</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {regulation?.title || "FDA regulation guidelines"}
            </p>
          </div>
        </div>

        {draft.comments && (
          <div className="rounded-lg border border-slate-800 bg-[#020613]/50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Reviewer Notes</p>
            <p className="mt-2 text-sm italic leading-5 text-slate-300">&ldquo;{draft.comments}&rdquo;</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between border-t border-slate-800/60 pt-4 gap-4">
          <p className="text-xs text-slate-500">
            Created: {formatDateTime(draft.created_at)}
            {draft.reviewed_at && ` | Reviewed: ${formatDateTime(draft.reviewed_at)}`}
          </p>
          {isApproved && draft.reviewer_id && (
            <p className="text-xs font-medium text-emerald-400">
              Approved by: {draft.reviewer_id} (Electronic Signature Confirmed)
            </p>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="border-t border-slate-800 bg-[#040815]/90 px-6 py-4 flex flex-wrap items-center justify-end gap-3">
        {isSubmitting ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 font-semibold py-1">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Executing electronic signature...
          </div>
        ) : (
          <>
            {isApproved && (
              <>
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/20 px-4 text-xs font-bold text-red-400 hover:bg-red-950/40 transition"
                >
                  Reset
                </button>
              </>
            )}

            {isRejected && (
              <>
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
                >
                  Reset to Draft
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500 transition"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </button>
              </>
            )}

            {(currentStatus === "DRAFT" || currentStatus === "NEEDS_REVISION") && (
              <>
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-800 bg-blue-900/20 px-4 text-xs font-bold text-blue-400 hover:bg-blue-900/40 transition"
                >
                  Submit for Review
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-750 px-4 text-xs font-bold text-white hover:bg-red-650 transition"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200 hover:bg-slate-850 transition"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </button>
              </>
            )}

            {isUnderReview && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-750 px-4 text-xs font-bold text-white hover:bg-red-650 transition"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200 hover:bg-slate-850 transition"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RegulationRail({
  regulations,
  selectedId,
  loading,
  impact,
  currentDraft,
  railDrafts,
  assessing,
  onFetch,
  onOpenDraft,
  onRun,
}: {
  regulations: RegulationResponse[];
  selectedId: string | null;
  loading: boolean;
  impact: ImpactResponse | null;
  currentDraft: RemediationResponse | null;
  railDrafts: RemediationResponse[];
  assessing: boolean;
  onFetch: () => void;
  onOpenDraft: (regulation: RegulationResponse) => void;
  onRun: (regulation: RegulationResponse) => void;
}) {
  return (
    <aside className="hidden w-shell-rail flex-shrink-0 overflow-y-auto border-l border-slate-850 bg-[#020613] px-6 py-6 xl:block">
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
        {regulations.map((item) => {
          const active = item.id === selectedId;
          const remediationDraft =
            railDrafts.find((draft) => draft.regulation_id === item.id) ??
            (currentDraft?.regulation_id === item.id ? currentDraft : null);
          const analyzed = hasCompletedAssessment(item, impact, remediationDraft);
          const isClosed = normalizedStatus(item.status) === "closed";
          const isUnopened =
            !analyzed &&
            ["not_analyzed", "pending_analysis", ""].includes(normalizedStatus(item.status));
          const badgeLabel = isClosed ? "Closed" : analyzed ? "Active" : "Pending";
          const badgeTone = isClosed ? "emerald" : analyzed ? "blue" : "amber";
          return (
            <article
              key={item.id}
              className={clsx(
                "rounded-lg border bg-slate-900/50 p-4 transition border-slate-800",
                active && "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.35)] bg-slate-900/90"
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDraft(item)}
                disabled={!analyzed}
                aria-pressed={active}
                className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-75"
                title={
                  isUnopened ? "Run impact assessment before opening remediation drafts." : undefined
                }
              >
                <h2 className="line-clamp-3 text-xs font-extrabold uppercase leading-5 text-white">
                  {item.title}
                </h2>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <Link2 className="h-3 w-3" />
                  {hostFor(item.source_url)}
                </p>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <StatusBadge label={badgeLabel} tone={badgeTone} />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRun(item);
                  }}
                  disabled={assessing || isClosed}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[10px] font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {assessing && active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 fill-white" />
                  )}
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
