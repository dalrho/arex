"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, ExternalLink, Loader2, ScrollText, ShieldCheck } from "lucide-react";
import ApprovalActionBar from "@/components/approvals/ApprovalActionBar";
import RedlineDiffViewer from "@/components/remediation/RedlineDiffViewer";
import StatusBadge from "@/components/ui/StatusBadge";
import { PageHeader, ToolbarButton, WorkbenchCard } from "@/components/ui/Workbench";
import { getDocument, getRegulation, getRemediation, submitApprovalDecision } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse, RegulationResponse, RemediationResponse } from "@/types/api";

/**
 * Remediation Review Page ("/remediation/[id]")
 * Side-by-side redline diff of the AI-proposed SOP revision with a
 * floating QA sign-off bar (POST /approvals/remediation/{id}).
 */
export default function RemediationReviewPage({ params }: { params: { id: string } }) {
  const [draft, setDraft] = useState<RemediationResponse | null>(null);
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [regulation, setRegulation] = useState<RegulationResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getRemediation(params.id);
      setDraft(d);
      // Context lookups are best-effort; the review works without them.
      getDocument(d.document_id).then(setDoc).catch(() => setDoc(null));
      getRegulation(d.regulation_id).then(setRegulation).catch(() => setRegulation(null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load remediation draft.");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    setDecisionError(null);
    setDecisionSuccess(null);
    try {
      await submitApprovalDecision(params.id, decision);
      setDecisionSuccess(
        decision === "APPROVED"
          ? "Draft approved. The SOP version was incremented and the audit record was written."
          : "Draft rejected. The decision was written to the immutable audit trail."
      );
      await load();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Failed to submit decision.");
    } finally {
      setSubmitting(false);
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

  if (!draft) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading remediation draft...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Remediations / Review"
        title="Remediation Review"
        description="Review AI-drafted SOP changes and provide human approval."
        actions={
          <>
            <BackLink />
            <ToolbarButton type="button">
              <ScrollText className="h-4 w-4" />
              View Audit Trail
            </ToolbarButton>
          </>
        }
      />

      <WorkbenchCard className="grid grid-cols-2 gap-0 overflow-hidden md:grid-cols-5">
        <div>
          <div className="border-b border-r border-slate-200 p-4 md:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Remediation Status
          </p>
          <div className="mt-1.5">
            <StatusBadge label={draft.status.replace("_", " ")} />
          </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="border-b border-r border-slate-200 p-4 md:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Regulation</p>
          {regulation ? (
            <Link
              href={`/regulations/${regulation.id}`}
              className="mt-1 block text-sm font-medium text-blue-600 hover:underline truncate"
            >
              {regulation.title}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-400 truncate">{draft.regulation_id}</p>
          )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="border-b border-r border-slate-200 p-4 md:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Document</p>
          {doc ? (
            <Link
              href={`/documents/${doc.id}`}
              className="mt-1 block text-sm font-medium text-blue-600 hover:underline truncate"
            >
              {doc.filename} (v{doc.version})
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-400 truncate">{draft.document_id}</p>
          )}
          </div>
        </div>
        <div>
          <div className="border-b border-r border-slate-200 p-4 md:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Reviewed</p>
          <p className="mt-1 text-sm text-slate-600">
            {draft.reviewed_at ? formatDateTime(draft.reviewed_at) : "Awaiting review"}
          </p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Audit Trail ID</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">AT-{draft.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </WorkbenchCard>

      {decisionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {decisionSuccess}
        </div>
      )}
      {decisionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decisionError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <RedlineDiffViewer
          originalText={draft.original_text}
          proposedText={draft.proposed_text}
          diffContent={draft.diff_content}
        />

        <aside className="space-y-4">
          <WorkbenchCard title="Citations">
            <div className="divide-y divide-slate-100">
              {[
                ["CIT-1", "21 CFR 820.180", "Records shall be established and maintained to demonstrate compliance."],
                ["CIT-2", "21 CFR 820.100(a)", "Corrective and preventive action effectiveness shall be verified."],
              ].map(([id, title, detail]) => (
                <div key={id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <StatusBadge label={id} tone="emerald" />
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Agent Rationale">
            <p className="p-4 text-sm leading-6 text-slate-600">
              Updated text explicitly references QMS record requirements and adds verification steps before closure to align with FDA expectations.
            </p>
          </WorkbenchCard>

          <WorkbenchCard title="Change Risk">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Operational impact</span>
                <span className="font-semibold text-slate-900">Low</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Regulatory impact</span>
                <StatusBadge label="Medium" tone="amber" />
              </div>
              <button type="button" className="text-sm font-semibold text-blue-700 hover:underline">
                View Risk Assessment
              </button>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Electronic Signature Required">
            <div className="p-4 text-sm text-slate-600">
              <ShieldCheck className="mb-3 h-5 w-5 text-emerald-600" />
              Your electronic signature is required to approve this remediation.
            </div>
          </WorkbenchCard>
        </aside>
      </div>

      <ApprovalActionBar status={draft.status} busy={submitting} onDecision={handleDecision} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/approvals"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
    >
      <ArrowLeft className="h-4 w-4" /> Back to Approvals
    </Link>
  );
}
