"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Filter,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  StatCard,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import {
  getCurrentUser,
  listDocuments,
  listRegulations,
  listRemediations,
  submitApprovalDecision,
  updateRemediation,
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { AuthUser, DocumentResponse, RegulationResponse, RemediationResponse } from "@/types/api";

function reviewerDisplay(user: AuthUser | null): { name: string; initials: string } {
  if (!user) return { name: "Unassigned reviewer", initials: "??" };
  const local = user.email.split("@")[0] ?? user.email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : local.slice(0, 2).toUpperCase();
  return { name: local, initials };
}

type StatusFilter = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "all";

/**
 * Fallback when diff_content is missing: find the first line that differs
 * between the original and proposed texts and return an excerpt of each,
 * centered on that line, so the visible snippet always includes the change.
 */
function excerptAroundFirstDifference(
  original: string,
  proposed: string,
  contextLines = 2
): { original: string; proposed: string } | null {
  const origLines = original.split(/\r?\n/);
  const propLines = proposed.split(/\r?\n/);
  const maxLen = Math.max(origLines.length, propLines.length);

  let diffIndex = -1;
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] ?? "") !== (propLines[i] ?? "")) {
      diffIndex = i;
      break;
    }
  }
  if (diffIndex === -1) return null;

  const slice = (lines: string[]) =>
    lines
      .slice(Math.max(0, diffIndex - contextLines), diffIndex + contextLines + 1)
      .join("\n")
      .trim();

  return { original: slice(origLines), proposed: slice(propLines) };
}

function ProposedChangesCard({ draft }: { draft: RemediationResponse }) {
  const removed = draft.diff_content?.removed?.filter((line) => line.trim()) ?? [];
  const added = draft.diff_content?.added?.filter((line) => line.trim()) ?? [];

  if (removed.length > 0 || added.length > 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">Proposed Changes</p>
          <p className="text-xs font-semibold text-slate-500">
            <span className="text-emerald-700">{added.length} addition{added.length === 1 ? "" : "s"}</span>
            {", "}
            <span className="text-red-700">{removed.length} deletion{removed.length === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {removed.map((line, idx) => (
            <p
              key={`removed-${idx}`}
              className="whitespace-pre-wrap break-words rounded border-l-2 border-red-300 bg-red-50 px-2 py-1 text-[13px] leading-5 text-red-700 line-through decoration-red-400"
            >
              {line}
            </p>
          ))}
          {added.map((line, idx) => (
            <p
              key={`added-${idx}`}
              className="whitespace-pre-wrap break-words rounded border-l-2 border-emerald-400 bg-emerald-50 px-2 py-1 text-[13px] leading-5 text-emerald-800"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  const excerpt = excerptAroundFirstDifference(draft.original_text, draft.proposed_text);

  if (!excerpt) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-bold text-slate-900">Proposed Changes</p>
        <p className="mt-2 text-sm text-slate-500">
          No text changes detected between the original and proposed versions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-bold text-slate-900">Original (As-Is)</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
          {excerpt.original || "\u2014"}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-bold text-slate-900">Proposed (To-Be)</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
          {excerpt.proposed || "\u2014"}
        </p>
      </div>
    </div>
  );
}

/**
 * Approvals Page ("/approvals")
 * Human approval queue: pending remediation drafts awaiting QA sign-off.
 * Review and sign-off happen on the remediation review page.
 */
export default function ApprovalsPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [drafts, setDrafts] = useState<RemediationResponse[]>([]);
  const [documents, setDocuments] = useState<Map<string, DocumentResponse>>(new Map());
  const [regulations, setRegulations] = useState<Map<string, RegulationResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING_REVIEW");
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [deciding, setDeciding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Request Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const load = useCallback(async () => {
    try {
      const [remediations, docs, regs] = await Promise.all([
        listRemediations(),
        listDocuments(),
        listRegulations(),
      ]);
      remediations.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setDrafts(remediations);
      setDocuments(new Map(docs.map((d) => [d.id, d])));
      setRegulations(new Map(regs.map((r) => [r.id, r])));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => drafts.filter((d) => d.status === "PENDING_REVIEW"), [drafts]);
  const approvedCount = drafts.filter((d) => d.status === "APPROVED").length;
  const rejectedCount = drafts.filter((d) => d.status === "REJECTED").length;

  // Synthetic priority mirrors the queue display: newest two pending items are High.
  const priorityFor = useCallback(
    (draft: RemediationResponse) => (pending.indexOf(draft) >= 0 && pending.indexOf(draft) < 2 ? "High" : "Medium"),
    [pending]
  );

  const visible = useMemo(() => {
    let result = statusFilter === "all" ? drafts : drafts.filter((d) => d.status === statusFilter);
    if (riskFilter !== "all") {
      result = result.filter((d) => priorityFor(d) === riskFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((d) => {
        const docName = documents.get(d.document_id)?.filename ?? "";
        const regName = regulations.get(d.regulation_id)?.title ?? "";
        return docName.toLowerCase().includes(query) || regName.toLowerCase().includes(query);
      });
    }
    return result;
  }, [drafts, statusFilter, riskFilter, search, documents, regulations, priorityFor]);

  const selected = visible.find((d) => d.id === selectedId) ?? visible[0] ?? null;
  const selectedDoc = selected ? documents.get(selected.document_id) : undefined;
  const selectedReg = selected ? regulations.get(selected.regulation_id) : undefined;

  const summary = [
    { label: "Pending Review", value: pending.length, detail: "High priority queue", icon: Clock, tone: "blue" as const },
    { label: "Approved Today", value: approvedCount, detail: "This period", icon: CheckCircle2, tone: "emerald" as const },
    { label: "Rejected", value: rejectedCount, detail: "This period", icon: XCircle, tone: "red" as const },
    { label: "Requires Edit", value: drafts.filter((d) => d.status !== "APPROVED" && d.status !== "PENDING_REVIEW" && d.status !== "REJECTED").length, detail: "Needs response", icon: FileText, tone: "amber" as const },
  ];

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    if (!selected) return;
    setDeciding(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await submitApprovalDecision(selected.id, decision);
      setActionSuccess(
        decision === "APPROVED"
          ? "Draft approved and signed. The audit record was written."
          : "Draft rejected. The decision was written to the immutable audit trail."
      );
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to submit decision.");
    } finally {
      setDeciding(false);
    }
  }

  function openEditModal() {
    if (!selected) return;
    setEditText(selected.proposed_text);
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!selected) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateRemediation(selected.id, editText);
      setEditOpen(false);
      setActionSuccess("Edit saved. The change was logged in the audit trail as EDITED.");
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save edit.");
    } finally {
      setSavingEdit(false);
    }
  }

  const selectedIsPending = selected?.status === "PENDING_REVIEW";
  const reviewer = reviewerDisplay(currentUser);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Human Approval Queue"
        description="Review and take action on AI-generated remediation drafts and compliance decisions."
      />

      {!loading && !loadError && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              detail={item.detail}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <WorkbenchCard>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={currentUser?.id ?? "all"}
              disabled
              aria-label="Reviewer filter"
            >
              <option value="all">All Reviewers</option>
              {currentUser && <option value={currentUser.id}>{reviewer.name}</option>}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">All Risk Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
            <ToolbarInput
              icon={Search}
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[240px] flex-1"
            />
            <ToolbarButton
              type="button"
              onClick={() => {
                setStatusFilter("PENDING_REVIEW");
                setRiskFilter("all");
                setSearch("");
              }}
            >
              <Filter className="h-4 w-4" />
              Reset Filters
            </ToolbarButton>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading approval queue...
            </div>
          ) : loadError ? (
            <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
          ) : visible.length === 0 ? (
            <EmptyState
              title="No drafts match the current filters"
              description="New AI-drafted remediations will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Item Type</th>
                    <th className="px-4 py-3">SOP / Document</th>
                    <th className="px-4 py-3">Source Regulation</th>
                    <th className="px-4 py-3">Reviewer</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((draft) => {
                    const doc = documents.get(draft.document_id);
                    const reg = regulations.get(draft.regulation_id);
                    const isSelected = selected?.id === draft.id;
                    return (
                      <tr
                        key={draft.id}
                        onClick={() => setSelectedId(draft.id)}
                        className={clsx(
                          "cursor-pointer",
                          isSelected
                            ? "bg-blue-50/50 shadow-[inset_3px_0_0_#2563eb]"
                            : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={priorityFor(draft)}
                            tone={priorityFor(draft) === "High" ? "red" : "amber"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Remediation Draft
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/remediation/${draft.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {doc?.filename ?? `Draft ${draft.id.slice(0, 8).toUpperCase()}`}
                          </Link>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-sm text-slate-600">
                          <p className="truncate">{reg?.title ?? draft.regulation_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                              {reviewer.initials}
                            </span>
                            <span className="text-sm text-slate-700">{reviewer.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(draft.created_at)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={draft.status.replace("_", " ")}
                            tone={
                              draft.status === "APPROVED"
                                ? "emerald"
                                : draft.status === "REJECTED"
                                  ? "red"
                                  : "blue"
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </WorkbenchCard>

        <aside className="space-y-4">
          <WorkbenchCard>
            {selected ? (
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusBadge label="Remediation Draft" tone="blue" />
                    <h2 className="mt-3 text-lg font-bold text-slate-950">
                      {selectedDoc?.filename ?? `Draft ${selected.id.slice(0, 8).toUpperCase()}`}
                    </h2>
                    <p className="mt-1 text-sm text-blue-700">{selectedReg?.title ?? selected.regulation_id}</p>
                  </div>
                  <StatusBadge
                    label={selected.status.replace("_", " ")}
                    tone={
                      selected.status === "APPROVED"
                        ? "emerald"
                        : selected.status === "REJECTED"
                          ? "red"
                          : "amber"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Assigned to</p>
                    <p className="font-semibold text-slate-900">{reviewer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Submitted</p>
                    <p className="font-semibold text-slate-900">{formatDateTime(selected.created_at)}</p>
                  </div>
                </div>

                <ProposedChangesCard draft={selected} />

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">Electronic Signature</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                      <Lock className="h-3.5 w-3.5" />
                      Required
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Your approval will be captured with an electronic signature in compliance with 21 CFR Part 11.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/remediation/${selected.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-blue-600 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Open Review
                  </Link>
                  <PrimaryButton
                    type="button"
                    disabled={!selectedIsPending || deciding}
                    onClick={() => void handleDecision("APPROVED")}
                  >
                    {deciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Approve
                  </PrimaryButton>
                  <ToolbarButton
                    type="button"
                    disabled={!selectedIsPending || deciding}
                    onClick={() => void handleDecision("REJECTED")}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </ToolbarButton>
                  <ToolbarButton
                    type="button"
                    disabled={!selectedIsPending || deciding}
                    onClick={openEditModal}
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    <Edit3 className="h-4 w-4" />
                    Request Edit
                  </ToolbarButton>
                </div>
                {!selectedIsPending && (
                  <p className="text-xs text-slate-500">
                    This draft has already been {selected.status.toLowerCase().replace("_", " ")}. No
                    further sign-off actions are permitted.
                  </p>
                )}
              </div>
            ) : (
              <EmptyState title="No approval selected" description="Select an item from the queue to review details." />
            )}
          </WorkbenchCard>
        </aside>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Request Edit"
        description="Modify the AI-proposed text before it is submitted for sign-off. The edit is logged in the audit trail."
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
              rows={12}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs leading-5 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
