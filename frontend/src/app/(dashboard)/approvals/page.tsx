"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  StatCard,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { listDocuments, listRegulations, listRemediations } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse, RegulationResponse, RemediationResponse } from "@/types/api";

/**
 * Approvals Page ("/approvals")
 * Human approval queue: pending remediation drafts awaiting QA sign-off.
 * Review and sign-off happen on the remediation review page.
 */
export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<RemediationResponse[]>([]);
  const [documents, setDocuments] = useState<Map<string, DocumentResponse>>(new Map());
  const [regulations, setRegulations] = useState<Map<string, RegulationResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRemediations(), listDocuments(), listRegulations()])
      .then(([remediations, docs, regs]) => {
        remediations.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setDrafts(remediations);
        setDocuments(new Map(docs.map((d) => [d.id, d])));
        setRegulations(new Map(regs.map((r) => [r.id, r])));
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load approval queue.")
      )
      .finally(() => setLoading(false));
  }, []);

  const pending = useMemo(() => drafts.filter((d) => d.status === "PENDING_REVIEW"), [drafts]);
  const approvedCount = drafts.filter((d) => d.status === "APPROVED").length;
  const rejectedCount = drafts.filter((d) => d.status === "REJECTED").length;
  const selected = pending[0] ?? drafts[0];
  const selectedDoc = selected ? documents.get(selected.document_id) : undefined;
  const selectedReg = selected ? regulations.get(selected.regulation_id) : undefined;

  const summary = [
    { label: "Pending Review", value: pending.length, detail: "High priority queue", icon: Clock, tone: "blue" as const },
    { label: "Approved Today", value: approvedCount, detail: "This period", icon: CheckCircle2, tone: "emerald" as const },
    { label: "Rejected", value: rejectedCount, detail: "This period", icon: XCircle, tone: "red" as const },
    { label: "Requires Edit", value: drafts.filter((d) => d.status !== "APPROVED" && d.status !== "PENDING_REVIEW").length, detail: "Needs response", icon: FileText, tone: "amber" as const },
  ];

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <WorkbenchCard>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option>All Reviewers</option>
            </select>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option>All Statuses</option>
            </select>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option>All Risk Levels</option>
            </select>
            <ToolbarInput icon={Search} placeholder="Search items..." className="min-w-[240px] flex-1" />
            <ToolbarButton type="button">
              <Filter className="h-4 w-4" />
              Filters
            </ToolbarButton>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading approval queue...
            </div>
          ) : loadError ? (
            <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
          ) : pending.length === 0 ? (
            <EmptyState
              title="No drafts are awaiting review"
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
                  {pending.map((draft, index) => {
                    const doc = documents.get(draft.document_id);
                    const reg = regulations.get(draft.regulation_id);
                    return (
                      <tr key={draft.id} className={index === 0 ? "bg-blue-50/50 shadow-[inset_3px_0_0_#2563eb]" : "hover:bg-slate-50/70"}>
                        <td className="px-4 py-3"><StatusBadge label={index < 2 ? "High" : "Medium"} tone={index < 2 ? "red" : "amber"} /></td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Remediation Draft
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/remediation/${draft.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                            {doc?.filename ?? `Draft ${draft.id.slice(0, 8).toUpperCase()}`}
                          </Link>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-sm text-slate-600">
                          <p className="truncate">{reg?.title ?? draft.regulation_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">AM</span>
                            <span className="text-sm text-slate-700">Alex Morgan</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(draft.created_at)}</td>
                        <td className="px-4 py-3"><StatusBadge label="Pending Review" tone="blue" /></td>
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
                  <StatusBadge label={selected.status.replace("_", " ")} tone="amber" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Assigned to</p>
                    <p className="font-semibold text-slate-900">Alex Morgan</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Submitted</p>
                    <p className="font-semibold text-slate-900">{formatDateTime(selected.created_at)}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">Original (As-Is)</p>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{selected.original_text}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">Proposed (To-Be)</p>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{selected.proposed_text}</p>
                  </div>
                </div>

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
                  <PrimaryButton type="button">
                    <ShieldCheck className="h-4 w-4" />
                    Approve
                  </PrimaryButton>
                  <ToolbarButton type="button" className="border-red-200 text-red-700 hover:bg-red-50">
                    Reject
                  </ToolbarButton>
                  <ToolbarButton type="button" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    Request Edit
                  </ToolbarButton>
                </div>
              </div>
            ) : (
              <EmptyState title="No approval selected" description="Select an item from the queue to review details." />
            )}
          </WorkbenchCard>
        </aside>
      </div>
    </div>
  );
}
