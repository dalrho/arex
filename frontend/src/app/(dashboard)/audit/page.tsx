"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Search, Shield } from "lucide-react";
import clsx from "clsx";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EmptyState,
  PageHeader,
  StatCard,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { listApprovalRecords, listUsers } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { ApprovalRecordResponse, UserResponse } from "@/types/api";

function statusTone(status: string): "emerald" | "red" | "amber" | "slate" {
  if (status === "APPROVED") return "emerald";
  if (status === "REJECTED") return "red";
  if (status === "EDITED") return "amber";
  return "slate";
}

function reviewerLabel(reviewerId: string, usersById: Map<string, UserResponse>): string {
  const user = usersById.get(reviewerId);
  if (user) return user.email;
  return `User ${reviewerId.slice(0, 8).toUpperCase()}`;
}

function contentPreview(content: unknown): string {
  if (content == null) return "—";
  if (typeof content === "string") {
    return content.length > 240 ? `${content.slice(0, 240)}…` : content;
  }
  try {
    const text = JSON.stringify(content, null, 2);
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch {
    return String(content);
  }
}

/**
 * Audit Trail Page ("/audit")
 * Immutable approval and edit events for the current tenant.
 */
export default function AuditPage() {
  const [records, setRecords] = useState<ApprovalRecordResponse[]>([]);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listApprovalRecords(), listUsers()])
      .then(([approvalRows, userRows]) => {
        approvalRows.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setRecords(approvalRows);
        setUsers(userRows);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load audit trail.")
      )
      .finally(() => setLoading(false));
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => {
      const reviewer = reviewerLabel(record.reviewer_id, usersById).toLowerCase();
      return (
        record.status.toLowerCase().includes(query) ||
        record.item_type.toLowerCase().includes(query) ||
        record.item_id.toLowerCase().includes(query) ||
        reviewer.includes(query)
      );
    });
  }, [records, search, usersById]);

  const approvedCount = records.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = records.filter((r) => r.status === "REJECTED").length;
  const editedCount = records.filter((r) => r.status === "EDITED").length;

  const summary = [
    {
      label: "Total Events",
      value: records.length,
      detail: "Append-only records",
      icon: Shield,
      tone: "blue" as const,
    },
    {
      label: "Approved",
      value: approvedCount,
      detail: "Signed decisions",
      icon: Shield,
      tone: "emerald" as const,
    },
    {
      label: "Rejected / Edited",
      value: rejectedCount + editedCount,
      detail: "Review actions",
      icon: Shield,
      tone: "amber" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail"
        description="Immutable log of approval, rejection, and edit events for compliance review."
      />

      {!loading && !loadError && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <WorkbenchCard>
        <div className="border-b border-slate-200 p-3">
          <ToolbarInput
            icon={Search}
            placeholder="Search by status, item type, reviewer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit trail...
          </div>
        ) : loadError ? (
          <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={records.length === 0 ? "No audit records yet" : "No records match your search"}
            description={
              records.length === 0
                ? "Approve, reject, or edit remediation drafts to create immutable audit entries."
                : "Try a different search term."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Item Type</th>
                  <th className="px-4 py-3">Item ID</th>
                  <th className="px-4 py-3">Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((record) => {
                  const expanded = expandedId === record.id;
                  return (
                    <React.Fragment key={record.id}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50/70"
                        onClick={() => setExpandedId(expanded ? null : record.id)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatDateTime(record.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge label={record.status} tone={statusTone(record.status)} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {record.item_type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {record.item_id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {reviewerLabel(record.reviewer_id, usersById)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Original Content
                                </p>
                                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-slate-700">
                                  {contentPreview(record.original_content)}
                                </pre>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Final Content
                                </p>
                                <pre
                                  className={clsx(
                                    "mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5",
                                    record.final_content ? "text-slate-700" : "text-slate-400"
                                  )}
                                >
                                  {contentPreview(record.final_content)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </WorkbenchCard>
    </div>
  );
}
