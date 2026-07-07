"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  FolderPlus,
  HardDrive,
  Loader2,
  MoreVertical,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import DocumentUploader from "@/components/documents/DocumentUploader";
import DocumentVersionTag from "@/components/documents/DocumentVersionTag";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  ToolbarButton,
  ToolbarInput,
  WorkbenchCard,
} from "@/components/ui/Workbench";
import { deleteDocument, listDocuments } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { DocumentResponse } from "@/types/api";

/**
 * Documents Page ("/documents")
 * QMS document library: drag-and-drop uploads plus a revision-controlled list.
 */
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocuments(docs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => doc.filename.toLowerCase().includes(query));
  }, [documents, search]);

  async function handleDelete(doc: DocumentResponse) {
    if (!window.confirm(`Delete "${doc.filename}"? This removes it from the QMS and vector index.`)) {
      return;
    }
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="QMS Document Library"
        description="Central repository for SOPs, Validation Plans, Policies, and Quality Documents."
        actions={
          <>
            <ToolbarButton type="button">
              <FolderPlus className="h-4 w-4" />
              New Folder
            </ToolbarButton>
            <PrimaryButton type="button">
              <UploadCloud className="h-4 w-4" />
              Upload SOP or Policy
            </PrimaryButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <DocumentUploader onUploaded={() => void refresh()} />

          <WorkbenchCard>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3">
              <ToolbarInput
                icon={Search}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="min-w-[240px] flex-1 md:max-w-sm"
              />
              <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <option>All Document Types</option>
              </select>
              <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <option>All Departments</option>
              </select>
              <ToolbarButton type="button">
                <Filter className="h-4 w-4" />
                More Filters
              </ToolbarButton>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents...
              </div>
            ) : loadError ? (
              <div className="px-4 py-16 text-center text-sm text-red-600">{loadError}</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={documents.length === 0 ? "No documents uploaded yet" : "No documents match your search"}
                description={
                  documents.length === 0
                    ? "Upload an SOP or policy above to begin indexing controlled content."
                    : "Adjust the search or filters to widen the document list."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Document Name</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Indexed</th>
                      <th className="px-4 py-3">Last Uploaded</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-blue-600"
                          >
                            <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                            <span className="max-w-xs truncate">{doc.filename}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <DocumentVersionTag version={doc.version} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">Quality Assurance</td>
                        <td className="px-4 py-3">
                          <StatusBadge label="Indexed" tone="emerald" />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(doc.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/documents/${doc.id}`}
                              aria-label={`View ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              aria-label={`Download ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              aria-label={`Delete ${doc.filename}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                  <span>
                    Showing {filtered.length} of {documents.length} documents
                  </span>
                  <span>Rows per page 25</span>
                </div>
              </div>
            )}
          </WorkbenchCard>
        </div>

        <aside className="space-y-5">
          <WorkbenchCard title="Revision Control">
            <div className="space-y-4 p-4 text-sm">
              {[
                ["Documents Updated (30d)", Math.max(18, documents.length)],
                ["Pending Review", 6],
                ["Superseded Documents", 12],
                ["Total Documents", documents.length || 142],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-blue-700">{value}</span>
                </div>
              ))}
              <ToolbarButton type="button" className="w-full justify-between">
                View Revision History
                <ChevronRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Tenant Scope">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Tenant</p>
                  <p className="font-semibold text-blue-700">Acme Medical Devices</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Site</p>
                  <p className="font-semibold text-blue-700">All Sites</p>
                </div>
                <div>
                  <p className="text-slate-500">Document Types</p>
                  <p className="font-semibold text-blue-700">All Types</p>
                </div>
              </div>
              <ToolbarButton type="button" className="w-full justify-between">
                Manage Scope
                <ChevronRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Storage Usage">
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-slate-500" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[34%] rounded-full bg-blue-600" />
                </div>
                <span className="text-xs font-semibold text-slate-600">34%</span>
              </div>
              <p className="text-sm text-slate-500">68.4 GB of 200 GB used</p>
            </div>
          </WorkbenchCard>
        </aside>
      </div>
    </div>
  );
}
