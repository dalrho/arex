"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Link2, Loader2, PenLine, Play, RefreshCw, XCircle } from "lucide-react";
import clsx from "clsx";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getDocument,
  getRegulation,
  getRemediation,
  listRegulations,
  runImpactAssessment,
  submitApprovalDecision,
  updateRemediation,
} from "@/lib/apiClient";
import {
  demoDocuments,
  demoImpactForRegulation,
  demoRegulations,
  demoRemediations,
  demoTasks,
} from "@/lib/demoData";
import { formatDateTime } from "@/lib/format";
import type {
  DocumentResponse,
  ImpactResponse,
  RegulationResponse,
  RemediationResponse,
  TaskResponse,
} from "@/types/api";

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}


function statusFor(regulation: RegulationResponse, impact: ImpactResponse | null): string {
  if (impact?.regulation_id === regulation.id) return "Analysis Complete";
  return regulation.status?.replace(/_/g, " ") || "Pending Analysis";
}

export default function RemediationReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RemediationResponse | null>(null);
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [regulation, setRegulation] = useState<RegulationResponse | null>(null);
  const [regulations, setRegulations] = useState<RegulationResponse[]>(demoRegulations);
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
      setRegulations(rows.length > 0 ? rows : demoRegulations);
    } catch {
      setRegulations(demoRegulations);
    } finally {
      setRegulationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      let nextDraft: RemediationResponse;
      try {
        nextDraft = await getRemediation(params.id);
      } catch {
        nextDraft = demoRemediations.find((item) => item.id === params.id) ?? demoRemediations[0];
      }

      if (cancelled) return;
      setDraft(nextDraft);

      getDocument(nextDraft.document_id)
        .then((doc) => !cancelled && setDocument(doc))
        .catch(
          () =>
            !cancelled &&
            setDocument(demoDocuments.find((doc) => doc.id === nextDraft.document_id) ?? demoDocuments[0])
        );
      getRegulation(nextDraft.regulation_id)
        .then((reg) => !cancelled && setRegulation(reg))
        .catch(
          () =>
            !cancelled &&
            setRegulation(demoRegulations.find((reg) => reg.id === nextDraft.regulation_id) ?? demoRegulations[0])
        );

      void loadRegulations();
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadRegulations, params.id]);

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
    try {
      setImpact(await runImpactAssessment(target.id));
    } catch {
      setImpact(demoImpactForRegulation(target.id));
    } finally {
      setAssessing(false);
    }
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

            {loading || !draft ? (
              <div className="mt-8 flex h-40 items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#081024] text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading remediation draft
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
        assessing={assessing}
        onFetch={() => void loadRegulations()}
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
  assessing,
  onFetch,
  onRun,
}: {
  regulations: RegulationResponse[];
  selectedId: string | null;
  loading: boolean;
  impact: ImpactResponse | null;
  assessing: boolean;
  onFetch: () => void;
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
          const analyzed = impact?.regulation_id === item.id || item.status === "ANALYSIS_COMPLETE";
          const isUnopened = item.status === "Not Analyzed" || item.status === "pending_analysis";
          const isClosed = item.status === "Closed";
          const badgeLabel = isClosed ? "Closed Case" : (isUnopened ? "Unopened" : "Active Case");
          const badgeTone = isClosed ? "emerald" : (isUnopened ? "slate" : "blue");
          return (
            <article
              key={item.id}
              className={clsx(
                "rounded-lg border bg-slate-800/90 p-4 transition",
                active ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.35)]" : "border-slate-700"
              )}
            >
              <h2 className="line-clamp-3 text-sm font-extrabold uppercase leading-5 text-white">{item.title}</h2>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Link2 className="h-3.5 w-3.5" />
                {hostFor(item.source_url)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <StatusBadge label={badgeLabel} tone={badgeTone} />
                <button
                  type="button"
                  onClick={() => onRun(item)}
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
