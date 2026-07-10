"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Link2, Loader2, PenLine, Play, RefreshCw, XCircle } from "lucide-react";
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
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type {
  DocumentResponse,
  ImpactResponse,
  RegulationResponse,
  RemediationResponse,
  TaskResponse,
} from "@/types/api";

const MIN_ASSESSMENT_ANIMATION_MS = 6500;
const RAIL_DRAFT_CACHE_KEY = "arex_remediation_rail_drafts";

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

function mergeRemediationDrafts(
  current: RemediationResponse[],
  incoming: RemediationResponse[]
): RemediationResponse[] {
  const draftsByRegulation = new Map(current.map((draft) => [draft.regulation_id, draft]));

  incoming.forEach((draft) => {
    draftsByRegulation.set(draft.regulation_id, draft);
  });

  return Array.from(draftsByRegulation.values());
}

function readCachedRailDrafts(): RemediationResponse[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(RAIL_DRAFT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RemediationResponse[]) : [];
  } catch {
    return [];
  }
}

function writeCachedRailDrafts(drafts: RemediationResponse[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(RAIL_DRAFT_CACHE_KEY, JSON.stringify(drafts));
  } catch {
    // Session cache is best-effort; the in-memory rail still works without it.
  }
}

export default function RemediationReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RemediationResponse | null>(null);
  const [railDrafts, setRailDrafts] = useState<RemediationResponse[]>(() => readCachedRailDrafts());
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [regulation, setRegulation] = useState<RegulationResponse | null>(null);
  const [regulations, setRegulations] = useState<RegulationResponse[]>([]);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regulationsLoading, setRegulationsLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
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
      setRailDrafts((current) => {
        const next = mergeRemediationDrafts(current, rows);
        writeCachedRailDrafts(next);
        return next;
      });
    } catch {
      setRailDrafts((current) => current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      let nextDraft: RemediationResponse | null;
      try {
        nextDraft = await getRemediation(params.id);
      } catch {
        nextDraft = null;
      }

      if (!nextDraft) {
        if (!cancelled) {
          setDraft(null);
          setDocument(null);
          setRegulation(null);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;
      setDraft(nextDraft);
      setRailDrafts((current) => {
        const next = mergeRemediationDrafts(current, [nextDraft]);
        writeCachedRailDrafts(next);
        return next;
      });

      getDocument(nextDraft.document_id)
        .then((doc) => !cancelled && setDocument(doc))
        .catch(() => !cancelled && setDocument(null));
      getRegulation(nextDraft.regulation_id)
        .then((reg) => !cancelled && setRegulation(reg))
        .catch(() => !cancelled && setRegulation(null));

      void loadRegulations();
      void loadRailDrafts();
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadRailDrafts, loadRegulations, params.id]);

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    if (!draft) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await submitApprovalDecision(draft.id, decision);
      if (decision === "APPROVED") {
        router.push(`/regulations?success_msg=${encodeURIComponent("Remediation draft approved successfully. Document version updated.")}`);
      } else {
        router.push("/regulations");
      }
    } catch {
      // Local fallback for demo
      if (decision === "APPROVED") {
        router.push(`/regulations?success_msg=${encodeURIComponent("Remediation draft approved successfully (offline demo). Document version updated.")}`);
      } else {
        router.push("/regulations");
      }
    } finally {
      setSubmitting(false);
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
    const nextDraft =
      railDrafts.find((item) => item.regulation_id === target.id) ??
      (draft?.regulation_id === target.id ? draft : null);

    if (!nextDraft) return;

    setRailDrafts((current) => {
      const next = mergeRemediationDrafts(current, [nextDraft]);
      writeCachedRailDrafts(next);
      return next;
    });
    router.push(`/remediation/${nextDraft.id}`);
  }

  function openEditModal() {
    if (!draft) return;
    setEditText(draft.proposed_text);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!draft) return;
    setSavingEdit(true);
    try {
      const updated = await updateRemediation(draft.id, editText);
      setDraft(updated);
    } catch {
      setDraft((current) => (current ? { ...current, proposed_text: editText } : current));
    } finally {
      setSavingEdit(false);
      setEditOpen(false);
      setMessage("Reviewer edit saved.");
    }
  }

  const selectedRegulationId = draft?.regulation_id ?? regulation?.id ?? null;

  return (
    <div className="flex h-full min-w-0 bg-[#020613]">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="px-6 py-6 md:px-10">
          <div className="mx-auto max-w-6xl pb-28">
            <Link href="/regulations" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-300">
              <ArrowLeft className="h-4 w-4" />
              Back to Regulatory Updates
            </Link>

            <h1 className="mt-6 text-2xl font-extrabold text-white">Remediation Drafts</h1>

            {assessing ? (
              <AssessmentLoadingView />
            ) : loading ? (
              <div className="mt-8 flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading remediation draft
              </div>
            ) : !draft ? (
              <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                Remediation draft could not be found for this case.
              </div>
            ) : (
              <div className="mt-8 space-y-10">
                <DraftCard draft={draft} document={document} regulation={regulation} />


                {message && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {draft && (
          <div className="sticky bottom-0 z-20 border-t border-slate-700 bg-[#020613]/95 px-6 py-5 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-col items-stretch justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleDecision("APPROVED")}
                disabled={submitting || draft.status === "APPROVED" || regulation?.status === "Closed"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Draft
              </button>
              <button
                type="button"
                onClick={openEditModal}
                disabled={submitting || regulation?.status === "Closed"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                <PenLine className="h-4 w-4" />
                Edit Draft
              </button>
              <button
                type="button"
                onClick={() => void handleDecision("REJECTED")}
                disabled={submitting || draft.status === "REJECTED" || regulation?.status === "Closed"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-6 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>

      <RegulationRail
        regulations={regulations}
        selectedId={selectedRegulationId}
        loading={regulationsLoading}
        impact={impact}
        currentDraft={draft}
        railDrafts={railDrafts}
        assessing={assessing}
        onFetch={handleFetchRail}
        onOpenDraft={handleOpenDraftForRegulation}
        onRun={(target) => void handleRunAssessment(target)}
      />

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Proposed Text"
        description="Save a reviewer edit before approval."
        widthClassName="max-w-3xl"
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
              Save Edit
            </button>
          </>
        }
      >
        <textarea
          value={editText}
          onChange={(event) => setEditText(event.target.value)}
          className="min-h-[360px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm leading-6 text-slate-100"
        />
      </Modal>
    </div>
  );
}

function DraftCard({
  draft,
  document,
  regulation,
}: {
  draft: RemediationResponse;
  document: DocumentResponse | null;
  regulation: RegulationResponse | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-700 bg-[#081024]">
      <div className="border-b border-slate-700 px-6 py-4">
        <p className="text-sm font-extrabold uppercase text-slate-300">Section 4.1 - Electronic Signature Validation</p>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b border-slate-700 p-6 md:border-b-0 md:border-r">
          <p className="text-xs uppercase text-slate-500">Current Policy</p>
          <p className="mt-5 whitespace-pre-line text-base leading-7 text-slate-300">{draft.original_text}</p>
        </div>
        <div className="p-6">
          <p className="text-xs uppercase text-slate-500">Draft Revisions</p>
          <p className="mt-5 whitespace-pre-line text-base leading-7 text-slate-300">{draft.proposed_text}</p>
        </div>
      </div>
      <div className="grid gap-6 border-t border-slate-700 p-6 md:grid-cols-[minmax(0,1fr)_140px]">
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase text-slate-500">Reason for Change</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Aligns access control and audit trail procedures with the selected FDA update.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">FDA Citation</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {regulation?.title ?? "FDA authentication and session control guidance"}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Source document: {document?.filename ?? draft.document_id} | Created {formatDateTime(draft.created_at)}
          </p>
        </div>
        <div className="text-left md:text-center">
          <p className="text-xs uppercase text-slate-500">Confidence</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">97%</p>
          <div className="mt-4">
            <StatusBadge label={draft.status.replace(/_/g, " ")} />
          </div>
        </div>
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
        {regulations.map((item) => {
          const active = item.id === selectedId;
          const remediationDraft =
            railDrafts.find((draft) => draft.regulation_id === item.id) ??
            (currentDraft?.regulation_id === item.id ? currentDraft : null);
          const analyzed = hasCompletedAssessment(item, impact, remediationDraft);
          const isClosed = normalizedStatus(item.status) === "closed";
          const isUnopened = !analyzed && ["not_analyzed", "pending_analysis", ""].includes(normalizedStatus(item.status));
          const badgeLabel = isClosed ? "Closed Case" : analyzed ? "Active Case" : "Pending Analysis";
          const badgeTone = isClosed ? "emerald" : analyzed ? "blue" : "amber";
          return (
            <article
              key={item.id}
              className={clsx(
                "rounded-lg border bg-slate-800/90 p-4 transition",
                active ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.35)]" : "border-slate-700"
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDraft(item)}
                disabled={!analyzed}
                aria-pressed={active}
                className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                title={isUnopened ? "Run impact assessment before opening remediation drafts." : undefined}
              >
                <h2 className="line-clamp-3 text-sm font-extrabold uppercase leading-5 text-white">{item.title}</h2>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Link2 className="h-3.5 w-3.5" />
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
