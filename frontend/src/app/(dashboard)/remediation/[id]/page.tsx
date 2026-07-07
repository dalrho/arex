"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import ApprovalActionBar from "@/components/approvals/ApprovalActionBar";
import RedlineDiffViewer from "@/components/remediation/RedlineDiffViewer";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";
import { PageHeader, PrimaryButton, ToolbarButton, WorkbenchCard } from "@/components/ui/Workbench";
import {
  getDocument,
  getRegulation,
  getRemediation,
  listApprovalRecords,
  submitApprovalDecision,
  updateRemediation,
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type {
  ApprovalRecordResponse,
  DocumentResponse,
  RegulationResponse,
  RemediationResponse,
} from "@/types/api";

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

  // Audit trail modal
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecords, setAuditRecords] = useState<ApprovalRecordResponse[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Request Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function openAuditTrail() {
    setAuditOpen(true);
    setAuditError(null);
    listApprovalRecords()
      .then((records) => setAuditRecords(records.filter((r) => r.item_id === params.id)))
      .catch((err) =>
        setAuditError(err instanceof Error ? err.message : "Failed to load audit records.")
      );
  }

  function openEditModal() {
    if (!draft) return;
    setEditText(draft.proposed_text);
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateRemediation(params.id, editText);
      setEditOpen(false);
      setDecisionSuccess("Edit saved. The change was logged in the audit trail as EDITED.");
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save edit.");
    } finally {
      setSavingEdit(false);
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
    <div className="space-y-4">
      <PageHeader
        eyebrow="Remediations / Review"
        title="Remediation Review"
        description="Review AI-drafted SOP changes and provide human approval."
        actions={
          <>
            <BackLink />
            <ToolbarButton type="button" onClick={openAuditTrail}>
              <ScrollText className="h-4 w-4" />
              View Audit Trail
            </ToolbarButton>
          </>
        }
      />

      <WorkbenchCard className="grid gap-0 overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
        <div className="border-b border-slate-200 p-4 sm:border-r lg:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Status</p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge label={draft.status.replace("_", " ")} />
          </div>
        </div>
        <div className="min-w-0 border-b border-slate-200 p-4 sm:border-r lg:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Regulatory source</p>
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
        <div className="min-w-0 border-b border-slate-200 p-4 sm:border-r lg:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Controlled document</p>
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
        <div className="border-b border-slate-200 p-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Reviewed</p>
          <p className="mt-1 text-sm text-slate-600">
            {draft.reviewed_at ? formatDateTime(draft.reviewed_at) : "Awaiting review"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Audit Trail ID</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            AT-{draft.id.slice(0, 8).toUpperCase()}
          </p>
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <RedlineDiffViewer
          originalText={draft.original_text}
          proposedText={draft.proposed_text}
          diffContent={draft.diff_content}
        />

        <aside className="space-y-4 xl:sticky xl:top-5">
          <WorkbenchCard
            title="Evidence"
            action={<StatusBadge label="2 citations" tone="blue" />}
          >
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
              <Link
                href={`/regulations/${draft.regulation_id}`}
                className="inline-block text-sm font-semibold text-blue-700 hover:underline"
              >
                View Risk Assessment
              </Link>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Electronic Signature Required">
            <div className="flex gap-3 p-4 text-sm text-slate-600">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">QA sign-off gate</p>
                <p className="mt-1 leading-5">
                  Your electronic signature is required to approve this remediation.
                </p>
              </div>
            </div>
          </WorkbenchCard>

          <WorkbenchCard>
            <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
              <div className="p-4">
                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-2 text-xs font-semibold text-slate-700">Part 11 audit</p>
              </div>
              <div className="p-4">
                <FileText className="mx-auto h-5 w-5 text-blue-600" />
                <p className="mt-2 text-xs font-semibold text-slate-700">Versioned SOP</p>
              </div>
            </div>
          </WorkbenchCard>
        </aside>
      </div>

      <ApprovalActionBar
        status={draft.status}
        busy={submitting}
        onDecision={handleDecision}
        onRequestEdit={openEditModal}
      />

      <Modal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Audit Trail"
        description={`Immutable events recorded for draft ${params.id.slice(0, 8).toUpperCase()}.`}
        widthClassName="max-w-2xl"
      >
        {auditError ? (
          <p className="py-4 text-sm text-red-600">{auditError}</p>
        ) : auditRecords === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit records...
          </div>
        ) : auditRecords.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No audit events have been recorded for this draft yet. Events are written when the draft
            is edited, approved, or rejected.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditRecords.map((record) => (
              <div key={record.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {record.status === "EDITED" ? "Draft edited" : `Decision: ${record.status}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(record.timestamp)} · Reviewer {record.reviewer_id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <StatusBadge
                  label={record.status}
                  tone={
                    record.status === "APPROVED"
                      ? "emerald"
                      : record.status === "REJECTED"
                        ? "red"
                        : "amber"
                  }
                />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Request Edit"
        description="Modify the AI-proposed text before sign-off. The edit is logged in the audit trail."
        widthClassName="max-w-2xl"
        footer={
          <>
            <ToolbarButton type="button" onClick={() => setEditOpen(false)}>
              Cancel
            </ToolbarButton>
            <PrimaryButton
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit || !editText.trim()}
            >
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
              Save Edit
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          {editError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {editError}
            </div>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Proposed text
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={14}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs leading-5 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </Modal>
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
