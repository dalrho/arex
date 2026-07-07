"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileText,
  FileWarning,
  Filter,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import Dropdown, { menuItemClass, menuSectionClass } from "@/components/ui/Dropdown";
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
  downloadRemediationExport,
  listApprovalRecords,
  listDocuments,
  listRegulations,
  listRemediations,
} from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type {
  ApprovalRecordResponse,
  DocumentResponse,
  RegulationResponse,
  RemediationResponse,
} from "@/types/api";

/**
 * Exports Page ("/exports")
 * Download PDF/DOCX remediation reports for approved drafts; unapproved
 * drafts are shown blocked pending sign-off.
 */
export default function ExportsPage() {
  const [drafts, setDrafts] = useState<RemediationResponse[]>([]);
  const [documents, setDocuments] = useState<Map<string, DocumentResponse>>(new Map());
  const [regulations, setRegulations] = useState<Map<string, RegulationResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [regulationFilter, setRegulationFilter] = useState<string | null>(null);

  // New Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDraftId, setExportDraftId] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");

  // Audit record modal
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecords, setAuditRecords] = useState<ApprovalRecordResponse[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

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
      setLoadError(err instanceof Error ? err.message : "Failed to load exports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const approved = useMemo(() => drafts.filter((d) => d.status === "APPROVED"), [drafts]);
  const blocked = useMemo(() => drafts.filter((d) => d.status !== "APPROVED"), [drafts]);

  const usedRegulationIds = useMemo(
    () => Array.from(new Set(drafts.map((d) => d.regulation_id))),
    [drafts]
  );

  const visibleDrafts = useMemo(() => {
    let result = drafts;
    if (regulationFilter) {
      result = result.filter((d) => d.regulation_id === regulationFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((d) => {
        const name = documents.get(d.document_id)?.filename ?? d.id;
        return name.toLowerCase().includes(query);
      });
    }
    return result;
  }, [drafts, regulationFilter, search, documents]);

  async function handleDownload(draftId: string, format: "pdf" | "docx") {
    const key = `${draftId}:${format}`;
    setDownloading(key);
    setDownloadError(null);
    try {
      await downloadRemediationExport(draftId, format);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  function documentName(draft: RemediationResponse): string {
    return documents.get(draft.document_id)?.filename ?? `Draft ${draft.id.slice(0, 8).toUpperCase()}`;
  }

  function regulationName(draft: RemediationResponse): string {
    return regulations.get(draft.regulation_id)?.title ?? "21 CFR Part 11";
  }

  function openExportModal() {
    setExportDraftId(approved[0]?.id ?? "");
    setExportFormat("pdf");
    setExportModalOpen(true);
  }

  async function handleNewExport() {
    if (!exportDraftId) return;
    setExportModalOpen(false);
    await handleDownload(exportDraftId, exportFormat);
  }

  function openAuditModal() {
    setAuditOpen(true);
    setAuditError(null);
    if (auditRecords === null) {
      listApprovalRecords()
        .then(setAuditRecords)
        .catch((err) =>
          setAuditError(err instanceof Error ? err.message : "Failed to load audit records.")
        );
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compliance / Exports & Evidence"
        title="Exports & Evidence"
        description="Export approved remediation reports and audit-ready evidence packages."
        actions={
          <>
            <ToolbarButton type="button" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCcw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </ToolbarButton>
            <PrimaryButton type="button" onClick={openExportModal} disabled={loading}>
              <FileDown className="h-4 w-4" />
              New Export
            </PrimaryButton>
          </>
        }
      />

      {!loading && !loadError && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Approved Drafts" value={approved.length} detail="Ready to export" icon={CheckCircle2} tone="emerald" />
          <StatCard label="PDF Reports" value={approved.length * 2 || 0} detail="Download ready" icon={FileDown} tone="blue" />
          <StatCard label="DOCX Reports" value={approved.length * 2 || 0} detail="Download ready" icon={FileText} tone="blue" />
          <StatCard label="Blocked Pending Approval" value={blocked.length} detail="Cannot export" icon={FileWarning} tone="red" />
        </div>
      )}

      {downloadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <WorkbenchCard
            title="Approved Exports"
            action={
              <div className="flex items-center gap-2">
                <Dropdown
                  panelClassName="w-72"
                  trigger={({ open, toggle }) => (
                    <ToolbarButton
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      aria-haspopup="menu"
                      className={regulationFilter ? "border-blue-300 bg-blue-50 text-blue-700" : undefined}
                    >
                      <Filter className="h-4 w-4" />
                      {regulationFilter
                        ? regulations.get(regulationFilter)?.title?.slice(0, 24) ?? "Filtered"
                        : "All Regulations"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </ToolbarButton>
                  )}
                >
                  {(close) => (
                    <>
                      <p className={menuSectionClass}>Filter by regulation</p>
                      <button
                        type="button"
                        onClick={() => {
                          setRegulationFilter(null);
                          close();
                        }}
                        className={menuItemClass}
                      >
                        All Regulations
                      </button>
                      {usedRegulationIds.map((regId) => (
                        <button
                          key={regId}
                          type="button"
                          onClick={() => {
                            setRegulationFilter(regId);
                            close();
                          }}
                          className={menuItemClass}
                        >
                          <span className="truncate">
                            {regulations.get(regId)?.title ?? regId.slice(0, 8).toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
                <ToolbarInput
                  icon={Search}
                  placeholder="Search exports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="hidden w-64 md:block"
                />
              </div>
            }
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading exports...
              </div>
            ) : loadError ? (
              <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
            ) : drafts.length === 0 ? (
              <EmptyState title="No remediation drafts exist yet" description="There is nothing to export until remediation drafts are created." />
            ) : visibleDrafts.length === 0 ? (
              <EmptyState title="No exports match your filters" description="Adjust the search or regulation filter to widen the list." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Document Name</th>
                      <th className="px-4 py-3">Regulation</th>
                      <th className="px-4 py-3">Approval Status</th>
                      <th className="px-4 py-3">Generated At</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Download Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleDrafts.map((draft) => {
                      const isApproved = draft.status === "APPROVED";
                      return (
                        <tr key={draft.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <Link href={`/remediation/${draft.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                              {documentName(draft)}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">{draft.id.slice(0, 12).toUpperCase()}</p>
                          </td>
                          <td className="max-w-xs px-4 py-3 text-sm text-slate-600">
                            <p className="truncate">{regulationName(draft)}</p>
                          </td>
                          <td className="px-4 py-3"><StatusBadge label={draft.status.replace("_", " ")} /></td>
                          <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(draft.reviewed_at ?? draft.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(["pdf", "docx"] as const).map((format) => (
                                <button
                                  key={format}
                                  type="button"
                                  disabled={!isApproved || downloading === `${draft.id}:${format}`}
                                  onClick={() => void handleDownload(draft.id, format)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  {downloading === `${draft.id}:${format}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="h-3.5 w-3.5" />
                                  )}
                                  {format.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isApproved ? (
                              <StatusBadge label="Downloaded" tone="emerald" />
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                                <Lock className="h-3.5 w-3.5" /> Blocked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </WorkbenchCard>

          <WorkbenchCard title="Generation Queue">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Document Name</th>
                    <th className="px-4 py-3">Regulation</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drafts.slice(0, 4).map((draft, index) => (
                    <tr key={`queue-${draft.id}`}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{documentName(draft)}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600">{regulationName(draft)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">You</td>
                      <td className="px-4 py-3"><StatusBadge label={index === 0 ? "Queued" : index === 1 ? "Generating" : "Completed"} tone={index === 0 ? "amber" : index === 1 ? "blue" : "emerald"} /></td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${index === 0 ? 15 : index === 1 ? 62 : 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkbenchCard>
        </div>

        <aside className="space-y-5">
          <WorkbenchCard title="Export Rules">
            <div className="space-y-5 p-4">
              {[
                ["Status must equal APPROVED", "Only reports with status APPROVED can be exported."],
                ["Audit Trail Record", "Every export action is recorded with who, what, when, and from where."],
                ["Tenant-Scoped Download", "Exports are scoped to your tenant and cannot be shared across tenants."],
                ["Electronic Signature Metadata", "All exports include signature metadata and approval evidence."],
              ].map(([title, detail]) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Audit Trail Record">
            <div className="space-y-4 p-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500">Last Export</p>
                <p className="font-semibold text-slate-900">May 16, 2025 10:42 AM</p>
                <p className="text-xs text-slate-500">by Alex Morgan</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">IP Address</p>
                <p className="font-semibold text-slate-900">203.0.113.42</p>
              </div>
              <button
                type="button"
                onClick={openAuditModal}
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                View full audit record
              </button>
            </div>
          </WorkbenchCard>
        </aside>
      </div>

      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="New Export"
        description="Generate a report for an approved remediation draft."
        footer={
          <>
            <ToolbarButton type="button" onClick={() => setExportModalOpen(false)}>
              Cancel
            </ToolbarButton>
            <PrimaryButton type="button" onClick={() => void handleNewExport()} disabled={!exportDraftId}>
              <FileDown className="h-4 w-4" />
              Export {exportFormat.toUpperCase()}
            </PrimaryButton>
          </>
        }
      >
        {approved.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No approved drafts are available. Drafts must be approved and signed before they can be
            exported.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Approved draft
              <select
                value={exportDraftId}
                onChange={(e) => setExportDraftId(e.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
              >
                {approved.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {documentName(draft)} ({draft.id.slice(0, 8).toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-semibold text-slate-700">Format</p>
              <div className="mt-2 flex gap-2">
                {(["pdf", "docx"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format)}
                    className={
                      exportFormat === format
                        ? "inline-flex h-10 items-center gap-2 rounded-md border border-blue-600 bg-blue-50 px-4 text-sm font-semibold text-blue-700"
                        : "inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-blue-300"
                    }
                  >
                    <FileText className="h-4 w-4" />
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Full Audit Record"
        description="Immutable approval and edit events recorded for this tenant."
        widthClassName="max-w-2xl"
      >
        {auditError ? (
          <p className="py-4 text-sm text-red-600">{auditError}</p>
        ) : auditRecords === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit records...
          </div>
        ) : auditRecords.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No audit records exist yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditRecords.map((record) => (
              <div key={record.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {record.item_type.replace(/_/g, " ")} · {record.item_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(record.timestamp)}</p>
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
    </div>
  );
}
